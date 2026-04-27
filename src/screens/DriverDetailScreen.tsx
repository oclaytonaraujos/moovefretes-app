import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert, Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../utils/constants';
import { formatPhone, getTimeAgo } from '../utils/helpers';
import { CachedAvatar } from '../components/CachedAvatar';
import type { Driver, Rating } from '../types';

const FAVORITES_KEY = 'favorites_drivers';
type Tab = 'overview' | 'ratings' | 'about';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'ratings', label: 'Avaliações' },
  { key: 'about', label: 'Sobre' },
];

export function DriverDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const driver: Driver = route.params?.driver;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
      if (stored) setIsFavorite((JSON.parse(stored) as string[]).includes(driver.id));
    }).catch(() => {});
  }, [driver.id]);

  const toggleFavorite = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      const favs: string[] = stored ? JSON.parse(stored) : [];
      const next = favs.includes(driver.id) ? favs.filter(id => id !== driver.id) : [...favs, driver.id];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setIsFavorite(!isFavorite);
    } catch {}
  }, [driver.id, isFavorite]);

  const loadDetails = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ratings')
        .select('*')
        .eq('target_id', driver.user_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setRatings(data as Rating[]);
      }
    } finally {
      setLoading(false);
    }
  }, [driver.user_id]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.overall_rating, 0) / ratings.length
    : driver.rating || 0;

  function handleWhatsApp() {
    if (!driver.phone) { Alert.alert('Telefone não disponível'); return; }
    Vibration.vibrate(40);
    Linking.openURL(`https://wa.me/55${driver.phone.replace(/\D/g, '')}`);
  }

  function handleCall() {
    if (!driver.phone) { Alert.alert('Telefone não disponível'); return; }
    Vibration.vibrate(40);
    Linking.openURL(`tel:${driver.phone}`);
  }

  function handleChat() {
    Vibration.vibrate(40);
    navigation.navigate('Chat', { userId: driver.user_id, userName: driver.name, userAvatar: driver.profile_image });
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{driver.name}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleFavorite}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? '#f87171' : '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'overview' && (
            <OverviewTab driver={driver} avgRating={avgRating} ratingCount={ratings.length} />
          )}
          {activeTab === 'ratings' && (
            <RatingsTab ratings={ratings} avgRating={avgRating} />
          )}
          {activeTab === 'about' && (
            <AboutTab driver={driver} />
          )}
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={15} color={COLORS.primary} />
          <Text style={styles.chatBtnText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chatBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={15} color={COLORS.primary} />
          <Text style={styles.chatBtnText}>Ligar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={15} color="#fff" />
          <Text style={styles.whatsappBtnText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OverviewTab({ driver, avgRating, ratingCount }: { driver: Driver; avgRating: number; ratingCount: number }) {
  return (
    <>
      <View style={ovStyles.card}>
        <View style={ovStyles.avatarRow}>
          <CachedAvatar uri={driver.profile_image} name={driver.name} size={60} borderRadius={12} />
          <View style={ovStyles.info}>
            <Text style={ovStyles.name}>{driver.name}</Text>
            {!!driver.current_location?.city && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                <Text style={ovStyles.sub}>
                  {driver.current_location.city} - {driver.current_location.state}
                </Text>
              </View>
            )}
            {avgRating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Stars rating={avgRating} size={12} />
                <Text style={ovStyles.ratingTxt}>{avgRating.toFixed(1)} ({ratingCount})</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={ovStyles.statsRow}>
        <StatCard icon="checkmark-circle" color={COLORS.primary} value={String(driver.completed_trips || 0)} label="Viagens" />
        <StatCard icon="star" color={COLORS.gold} value={avgRating > 0 ? avgRating.toFixed(1) : '-'} label="Avaliação" />
        <StatCard icon="car" color={COLORS.info} value={driver.vehicle_type || '-'} label="Veículo" />
      </View>

      <View style={ovStyles.infoCard}>
        <Text style={ovStyles.infoTitle}>Veículo</Text>
        {!!driver.vehicle_plate && <InfoRow icon="barcode-outline" label="Placa" value={driver.vehicle_plate} />}
        {!!driver.vehicle_model && <InfoRow icon="car-sport-outline" label="Modelo" value={driver.vehicle_model} />}
        {!!driver.vehicle_capacity && <InfoRow icon="cube-outline" label="Capacidade" value={`${driver.vehicle_capacity} kg`} />}
        {!driver.vehicle_plate && !driver.vehicle_model && (
          <Text style={ovStyles.noInfo}>Veículo não especificado</Text>
        )}
      </View>
    </>
  );
}

function StatCard({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={ovStyles.statCard}>
      <View style={[ovStyles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={ovStyles.statValue}>{value}</Text>
      <Text style={ovStyles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ovStyles.infoRow}>
      <Ionicons name={icon as any} size={15} color={COLORS.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={ovStyles.infoLabel}>{label}</Text>
        <Text style={ovStyles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function RatingsTab({ ratings, avgRating }: { ratings: Rating[]; avgRating: number }) {
  if (ratings.length === 0) {
    return (
      <View style={emptyStyles.wrap}>
        <Ionicons name="star-outline" size={48} color={COLORS.textLight} />
        <Text style={emptyStyles.title}>Nenhuma avaliação</Text>
        <Text style={emptyStyles.desc}>Este motorista ainda não recebeu avaliações.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {ratings.map(r => (
        <View key={r.id} style={ratStyles.card}>
          <View style={ratStyles.cardHeader}>
            <CachedAvatar name={'Usuário'} size={36} borderRadius={18} />
            <View style={{ flex: 1 }}>
              <Text style={ratStyles.evaluatorName}>{'Usuário'}</Text>
            </View>
            <Stars rating={r.overall_rating} size={12} />
          </View>
          {!!r.comment && <Text style={ratStyles.comment}>{r.comment}</Text>}
          <Text style={ratStyles.date}>{getTimeAgo(r.created_at)}</Text>
        </View>
      ))}
    </View>
  );
}

function AboutTab({ driver }: { driver: Driver }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={aboutStyles.card}>
        <Text style={aboutStyles.title}>Dados do Motorista</Text>
        <AboutRow label="CNH" value={driver.cnh_category || '-'} />
        <AboutRow label="RNTRC" value={driver.rntrc || '-'} />
        <AboutRow label="Membro desde" value={new Date(driver.created_at).toLocaleDateString('pt-BR')} />
        <AboutRow label="Viagens concluídas" value={String(driver.completed_trips || 0)} last />
      </View>
    </View>
  );
}

function AboutRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[aboutStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={aboutStyles.label}>{label}</Text>
      <Text style={aboutStyles.value}>{value}</Text>
    </View>
  );
}

function Stars({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color={COLORS.gold} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 3 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },
  content: { padding: 16, gap: 12, paddingBottom: 100 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1.5, height: 38, borderRadius: 10, backgroundColor: '#25D366',
  },
  whatsappBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

const ovStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  avatarRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  info: { flex: 1, gap: 5 },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  sub: { fontSize: 12, color: COLORS.textSecondary },
  ratingTxt: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center' },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  noInfo: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8 },
});

const ratStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evaluatorName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  comment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  date: { fontSize: 11, color: COLORS.textLight },
});

const aboutStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
});

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});
