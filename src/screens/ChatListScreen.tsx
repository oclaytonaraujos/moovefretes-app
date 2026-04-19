import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { getTimeAgo } from '../utils/helpers';
import { CachedAvatar } from '../components/CachedAvatar';
import { UserProfileModal } from '../components/UserProfileModal';

type FilterType = 'all' | 'unread' | 'freight' | 'route';

interface ConversationSummary {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage: string;
  lastMessageSenderId: string | null;
  lastMessageRead: boolean;
  lastMessageAt: string;
  unreadCount: number;
  source: string | null;
  originCity: string | null;
  originState: string | null;
  destinationCity: string | null;
  destinationState: string | null;
}

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all',     label: 'Todas',      icon: 'chatbubbles-outline' },
  { key: 'unread',  label: 'Não lidas',  icon: 'ellipse' },
  { key: 'freight', label: 'Fretes',     icon: 'document-text-outline' },
  { key: 'route',   label: 'Rotas',      icon: 'map-outline' },
];

export function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileModal, setProfileModal] = useState<{ userId: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      const convIds = convs.map(c => c.id);
      const otherUserIds = convs.map(c =>
        c.participant1_id === user.id ? c.participant2_id : c.participant1_id
      ).filter(Boolean);

      const [profilesRes, lastMsgsRes, unreadRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, avatar_url, user_type')
          .in('id', otherUserIds),
        supabase
          .from('messages')
          .select('conversation_id, content, sender_id, is_read, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .neq('sender_id', user.id)
          .eq('is_read', false),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));

      const lastMsgMap = new Map<string, { content: string; sender_id: string; is_read: boolean }>();
      (lastMsgsRes.data || []).forEach(msg => {
        if (!lastMsgMap.has(msg.conversation_id)) {
          lastMsgMap.set(msg.conversation_id, {
            content: msg.content,
            sender_id: msg.sender_id,
            is_read: msg.is_read,
          });
        }
      });

      const unreadMap = new Map<string, number>();
      (unreadRes.data || []).forEach(msg => {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      });

      const result: ConversationSummary[] = convs.map(c => {
        const isP1 = c.participant1_id === user.id;
        const otherId = isP1 ? c.participant2_id : c.participant1_id;
        const profile = profileMap.get(otherId);
        const lastMsg = lastMsgMap.get(c.id);
        return {
          conversationId: c.id,
          otherUserId: otherId,
          otherUserName: profile?.name || 'Usuário',
          otherUserAvatar: profile?.avatar_url,
          lastMessage: lastMsg?.content || '',
          lastMessageSenderId: lastMsg?.sender_id || null,
          lastMessageRead: lastMsg?.is_read ?? true,
          lastMessageAt: c.last_message_at || c.created_at,
          unreadCount: unreadMap.get(c.id) || 0,
          source: c.source || null,
          originCity: c.origin_city || null,
          originState: c.origin_state || null,
          destinationCity: c.destination_city || null,
          destinationState: c.destination_state || null,
        };
      });

      setConversations(result);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function formatUnread(count: number) {
    return count > 99 ? '99+' : String(count);
  }

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'unread':  return conversations.filter(c => c.unreadCount > 0);
      case 'freight': return conversations.filter(c => c.source === 'freight');
      case 'route':   return conversations.filter(c => c.source === 'route');
      default:        return conversations;
    }
  }, [conversations, activeFilter]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Mensagens</Text>
          <Text style={styles.subtitle}>Suas conversas</Text>
        </View>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => {
            Alert.alert(
              'Nova Conversa',
              'Para iniciar uma nova conversa, busque por uma empresa e clique no botão de Chat.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Buscar Empresa', onPress: () => navigation.navigate('CompaniesTab') },
              ]
            );
          }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map(f => {
            const active = activeFilter === f.key;
            const badge = f.key === 'unread' && unreadTotal > 0 ? unreadTotal : 0;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {f.label}
                </Text>
                {badge > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{formatUnread(badge)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.conversationId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const isMe = item.lastMessageSenderId === user?.id;
            return (
              <TouchableOpacity
                style={styles.convItem}
                onPress={() => navigation.navigate('Chat', {
                  conversationId: item.conversationId,
                  userId: item.otherUserId,
                  userName: item.otherUserName,
                  userAvatar: item.otherUserAvatar,
                  source: item.source,
                  originCity: item.originCity,
                  originState: item.originState,
                  destinationCity: item.destinationCity,
                  destinationState: item.destinationState,
                })}
                activeOpacity={0.7}
              >
                <TouchableOpacity
                  onPress={() => setProfileModal({ userId: item.otherUserId })}
                  activeOpacity={0.8}
                >
                  <CachedAvatar
                    uri={item.otherUserAvatar}
                    name={item.otherUserName}
                    size={52}
                    borderRadius={26}
                  />
                </TouchableOpacity>

                <View style={[styles.textCol, !item.lastMessage && styles.textColCentered]}>
                  {(item.source === 'freight' || item.source === 'route') && item.originCity && item.destinationCity && (
                    <View style={styles.routeRow}>
                      <Ionicons
                        name={item.source === 'freight' ? 'document-text-outline' : 'map-outline'}
                        size={11}
                        color={COLORS.primary}
                        style={styles.routeIcon}
                      />
                      <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                        {item.originCity}/{item.originState}
                      </Text>
                      <Ionicons name="arrow-forward" size={11} color={COLORS.textSecondary} />
                      <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                        {item.destinationCity}/{item.destinationState}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[styles.convName, item.unreadCount > 0 && styles.convNameUnread]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.otherUserName}
                  </Text>
                  {!!item.lastMessage && (
                    <View style={styles.msgRow}>
                      {isMe && (
                        <Ionicons
                          name={item.lastMessageRead ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={item.lastMessageRead ? COLORS.primary : COLORS.textSecondary}
                          style={styles.checkIcon}
                        />
                      )}
                      <Text
                        style={[styles.convMessage, item.unreadCount > 0 && !isMe && styles.convMessageUnread]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {isMe ? `Você: ${item.lastMessage}` : item.lastMessage}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaCol}>
                  <Text style={styles.convTime}>{getTimeAgo(item.lastMessageAt)}</Text>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{formatUnread(item.unreadCount)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={52} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all' ? 'Sem mensagens' : 'Nenhuma conversa aqui'}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeFilter === 'all'
                  ? 'Suas conversas com embarcadores e transportadoras aparecerão aqui.'
                  : activeFilter === 'unread'
                  ? 'Você não tem mensagens não lidas.'
                  : activeFilter === 'freight'
                  ? 'Conversas iniciadas a partir de fretes aparecerão aqui.'
                  : 'Conversas iniciadas a partir de rotas aparecerão aqui.'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <UserProfileModal
        visible={!!profileModal}
        userId={profileModal?.userId || ''}
        onClose={() => setProfileModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  composeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  filterBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterLabelActive: { color: COLORS.primary },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  routeIcon: { flexShrink: 0 },
  routeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600', flexShrink: 1 },
  textCol: { flex: 1, gap: 2 },
  textColCentered: { justifyContent: 'center' },
  convName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  convNameUnread: { fontWeight: '700', color: COLORS.text },
  msgRow: { flexDirection: 'row', alignItems: 'center' },
  checkIcon: { marginRight: 3, flexShrink: 0 },
  convMessage: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  convMessageUnread: { color: COLORS.text, fontWeight: '600' },
  metaCol: { alignItems: 'flex-end', gap: 6, flexShrink: 0, alignSelf: 'flex-start', paddingTop: 2 },
  convTime: { fontSize: 11, color: COLORS.textSecondary },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 78 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
});
