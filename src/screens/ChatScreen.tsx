import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Vibration, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { CachedAvatar } from '../components/CachedAvatar';
import { UserProfileModal } from '../components/UserProfileModal';
import type { Message } from '../types';

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const {
    userId: otherUserId, userName, conversationId: initialConvId, userAvatar,
    source, sourceId, originCity, originState, destinationCity, destinationState,
    initialMessage,
  } = route.params || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConvId || null);
  const [text, setText] = useState<string>(initialMessage || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const getOrCreateConversation = useCallback(async (): Promise<string | null> => {
    if (!user || !otherUserId) return null;
    if (conversationId) return conversationId;

    const participantsFilter =
      `and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`;

    // Look for an existing conversation between these participants
    // For freight/route: scope to the specific source_id; for direct: any existing thread
    const existingQuery = supabase
      .from('conversations')
      .select('id')
      .or(participantsFilter);

    const { data: existing } = source && sourceId
      ? await existingQuery.eq('source_id', sourceId).maybeSingle()
      : await existingQuery.maybeSingle();

    if (existing) {
      setConversationId(existing.id);
      return existing.id;
    }

    // Prepare the payload based on whether it's a freight or route
    // We pass empty strings instead of null to bypass the broken 'sync_conversation_route_data' trigger in Supabase
    const payload: any = {
      participant1_id: user.id,
      participant2_id: otherUserId,
      source: source || 'direct',
      source_id: sourceId || null,
      origin_city: originCity || '',
      origin_state: originState || '',
      destination_city: destinationCity || '',
      destination_state: destinationState || '',
    };

    if (source === 'freight' && sourceId) {
      payload.freight_id = sourceId; // Populate freight_id constraint if needed
    }

    // Try full insert with source context
    const { data: created, error } = await supabase
      .from('conversations')
      .insert(payload)
      .select('id')
      .single();

    if (!error && created) {
      setConversationId(created.id);
      return created.id;
    }

    if (error) {
      console.error('Failed to create full conversation, trying fallback. Error:', error);
    }

    // Fallback: insert with minimal columns but still try to keep source info
    // We pass empty strings instead of null for cities here as well to bypass the trigger again
    const { data: fallback, error: fallbackError } = await supabase
      .from('conversations')
      .insert({ 
        participant1_id: user.id, 
        participant2_id: otherUserId,
        source: source || 'direct',
        source_id: sourceId || null,
        freight_id: source === 'freight' ? sourceId : null,
        origin_city: originCity || '',
        origin_state: originState || '',
        destination_city: destinationCity || '',
        destination_state: destinationState || '',
      })
      .select('id')
      .single();

    if (fallback) {
      setConversationId(fallback.id);
      return fallback.id;
    }
    
    if (fallbackError) {
      console.error('Fallback insert failed too:', fallbackError);
    }
    return null;
  }, [user, otherUserId, conversationId, source, sourceId, originCity, originState, destinationCity, destinationState]);

  const load = useCallback(async () => {
    if (!user || !otherUserId) return;
    const convId = await getOrCreateConversation();
    if (!convId) { setLoading(false); return; }

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoading(false);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', convId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);
  }, [user, otherUserId, getOrCreateConversation]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`chat-conv-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== user.id) {
          setMessages(prev => [...prev, msg]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !user || !otherUserId) return;
    Vibration.vibrate(50);
    const content = text.trim();
    setSending(true);

    let convId = conversationId;
    if (!convId) convId = await getOrCreateConversation();
    if (!convId) { setSending(false); return; }

    setText('');
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id: user.id, content, is_read: false })
      .select()
      .single();

    await supabase.from('conversations').update({ last_message_at: now }).eq('id', convId);

    setSending(false);
    if (!error && data) {
      setMessages(prev => [...prev, data]);
    }
  }

  function formatTime(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(dateString: string) {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  const groupedMessages: (Message | { type: 'separator'; label: string; key: string })[] = [];
  let lastDay = '';
  messages.forEach(msg => {
    const day = new Date(msg.created_at).toDateString();
    if (day !== lastDay) {
      groupedMessages.push({ type: 'separator', label: formatDay(msg.created_at), key: `sep-${day}` });
      lastDay = day;
    }
    groupedMessages.push(msg);
  });

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowProfileModal(true)} activeOpacity={0.8}>
          <CachedAvatar
            uri={userAvatar}
            name={userName}
            size={40}
            borderRadius={20}
          />
          <View style={styles.headerInfoText}>
            {(source === 'freight' || source === 'route') && originCity && destinationCity && (
              <View style={styles.headerRouteRow}>
                <Ionicons
                  name={source === 'freight' ? 'document-text-outline' : 'map-outline'}
                  size={10}
                  color={COLORS.primary}
                />
                <Text style={styles.headerRouteText} numberOfLines={1} ellipsizeMode="tail">
                  {originCity}/{originState}
                </Text>
                <Ionicons name="arrow-forward" size={10} color={COLORS.textSecondary} />
                <Text style={styles.headerRouteText} numberOfLines={1} ellipsizeMode="tail">
                  {destinationCity}/{destinationState}
                </Text>
              </View>
            )}
            <Text style={styles.headerName}>{userName || 'Conversa'}</Text>
            <Text style={styles.headerSub}>MooveFretes</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          keyExtractor={(item, i) => ('key' in item ? item.key : item.id) || String(i)}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => {
            if ('type' in item) {
              return (
                <View style={styles.daySeparator}>
                  <View style={styles.dayLine} />
                  <Text style={styles.dayLabel}>{item.label}</Text>
                  <View style={styles.dayLine} />
                </View>
              );
            }
            const isMine = item.sender_id === user?.id;
            return (
              <View style={[styles.msgWrap, isMine ? styles.msgWrapRight : styles.msgWrapLeft]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                    {item.content}
                  </Text>
                  <View style={styles.bubbleFooter}>
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                      {formatTime(item.created_at)}
                    </Text>
                    {isMine && (
                      <Ionicons
                        name={item.is_read ? 'checkmark-done' : 'checkmark'}
                        size={12}
                        color={item.is_read ? '#fff' : 'rgba(255,255,255,0.6)'}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-outline" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyChatText}>Nenhuma mensagem ainda.{'\n'}Inicie a conversa!</Text>
            </View>
          }
        />
      )}

      <UserProfileModal
        visible={showProfileModal}
        userId={otherUserId || ''}
        onClose={() => setShowProfileModal(false)}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={COLORS.textLight}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerInfoText: { gap: 1, flex: 1 },
  headerRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 },
  headerRouteText: { fontSize: 10, color: COLORS.primary, fontWeight: '600', flexShrink: 1 },
  headerName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary },
  messages: { padding: 12, paddingBottom: 8, gap: 4 },
  daySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  dayLabel: { 
    fontSize: 11, 
    color: COLORS.textLight, 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  msgWrap: { flexDirection: 'row', marginVertical: 4 },
  msgWrapRight: { justifyContent: 'flex-end' },
  msgWrapLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  bubbleTime: { fontSize: 10, color: COLORS.textSecondary },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5, backgroundColor: COLORS.border },
  emptyChat: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyChatText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
