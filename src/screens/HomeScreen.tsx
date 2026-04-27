import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COLORS } from '../utils/constants';
import { formatCurrency, getSupabaseAvatarUrl } from '../utils/helpers';
import type { Freight } from '../types';

export function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    activeFreights: 0,
    connectedDrivers: 0,
    monthlyRevenue: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  const profile = user?.profile;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Active Freights
      const { count: activeFreightsCount } = await supabase
        .from('freights')
        .select('*', { count: 'exact', head: true })
        .eq('publisher_id', user.id)
        .neq('status', 'cancelled')
        .neq('status', 'inactive');

      // 2. Connected Drivers
      const { count: connectedDriversCount } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true });

      // 3. Unread Messages
      const { data: myConvs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

      let unreadMessages = 0;
      if (myConvs && myConvs.length > 0) {
        const convIds = myConvs.map(c => c.id);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .neq('sender_id', user.id)
          .eq('is_read', false);
        unreadMessages = count || 0;
      }

      setStats({
        activeFreights: activeFreightsCount || 0,
        connectedDrivers: connectedDriversCount || 0,
        monthlyRevenue: 0, // Mock for now or implement total_earnings logic
        unreadMessages,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const firstName = (profile?.name || 'Transportadora').split(' ')[0];

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
            {profile?.avatar_url && !avatarError
              ? <Image source={{ uri: getSupabaseAvatarUrl(profile.avatar_url) }} style={styles.avatarImg} onError={() => setAvatarError(true)} />
              : <Text style={styles.avatarInitial}>{(firstName || 'T')[0].toUpperCase()}</Text>}
          </TouchableOpacity>
          <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.summaryContainer}>
              <View style={styles.statsGrid}>
                <View style={styles.statsGridRow}>
                  <MiniStatCard
                    icon="document-text"
                    color={COLORS.primary}
                    label="Fretes Ativos"
                    value={`${stats.activeFreights}`}
                    onPress={() => navigation.navigate('FreightsTab')}
                  />
                  <MiniStatCard
                    icon="car-sport"
                    color={COLORS.primary}
                    label="Motoristas"
                    value={`${stats.connectedDrivers}`}
                    onPress={() => navigation.navigate('DriversTab')}
                  />
                </View>
                <View style={styles.statsGridRow}>
                  <MiniStatCard
                    icon="trending-up"
                    color={COLORS.primary}
                    label="Receita Mês"
                    value={formatCurrency(stats.monthlyRevenue)}
                  />
                  <MiniStatCard
                    icon="chatbubble-ellipses"
                    color={COLORS.primary}
                    label="Mensagens"
                    value={stats.unreadMessages > 0 ? `${stats.unreadMessages} novas` : 'Lidas'}
                    onPress={() => navigation.navigate('ChatTab')}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ações Rápidas</Text>
              <View style={{ gap: 10 }}>
                <View style={styles.quickActionsRow}>
                  <QuickAction icon="add-circle" label="Criar Frete" onPress={() => navigation.navigate('CreateFreight')} color={COLORS.primary} />
                  <QuickAction icon="people-circle" label="Motoristas" onPress={() => navigation.navigate('DriversTab')} color={COLORS.primary} />
                </View>
                <View style={styles.quickActionsRow}>
                  <QuickAction icon="chatbubble-ellipses" label="Mensagens" onPress={() => navigation.navigate('ChatTab')} color={COLORS.primary} />
                  <QuickAction icon="person-circle" label="Meu Perfil" onPress={() => navigation.navigate('ProfileTab')} color={COLORS.primary} />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MiniStatCard({ icon, color, label, value, onPress }: {
  icon: string; color: string; label: string; value: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={statStyles.miniCard}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[statStyles.miniIconWrap, { backgroundColor: color + '12' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={statStyles.miniContent}>
        <Text style={statStyles.miniLabel}>{label}</Text>
        <Text style={[statStyles.miniValue, { color: color === COLORS.textSecondary ? COLORS.text : color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={qaStyles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[qaStyles.icon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={qaStyles.label}>{label}</Text>
    </TouchableOpacity>
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
  avatar: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: COLORS.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImg: {
    width: 60, height: 60, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.primaryDark
  },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerLeft: { flex: 1, gap: 4, marginRight: 12 },
  greeting: { fontSize: 20, fontWeight: '800', color: '#fff' },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  summaryContainer: { gap: 12 },
  statsGrid: { gap: 10 },
  statsGridRow: { flexDirection: 'row', gap: 10 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
});

const statStyles = StyleSheet.create({
  miniCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniContent: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  miniValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
});

const qaStyles = StyleSheet.create({
  item: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
});
