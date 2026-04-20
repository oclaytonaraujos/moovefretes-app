import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COLORS, AVAILABILITY_LABELS } from '../utils/constants';
import { formatLocation, formatCurrency, mapSupabaseFreight, fetchPublisherProfiles, getAvailabilityColor, getSupabaseAvatarUrl } from '../utils/helpers';
import { FreightCard } from '../components/FreightCard';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';
import type { Freight } from '../types';

function getExpirationInfo(lastUpdated?: string): { expired: boolean; text: string } | null {
  if (!lastUpdated) return null;
  const expires = new Date(new Date(lastUpdated).getTime() + 24 * 60 * 60 * 1000);
  const diffMs = expires.getTime() - Date.now();
  if (diffMs <= 0) return { expired: true, text: 'Expirado' };
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { expired: false, text: h > 0 ? `${h}h restantes` : `${m}min restantes` };
}

export function HomeScreen() {
  const { user, updateDriverAvailability, updateDriverLocation } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFreight, setActiveFreight] = useState<Freight | null>(null);
  const [recentFreights, setRecentFreights] = useState<Freight[]>([]);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    monthlyEarnings: 0,
    completedTrips: 0,
    rating: 0,
    nearbyFreights: 0,
    unreadMessages: 0,
    profileViews: 0,
    cnhDaysLeft: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const driver = user?.driver;
  const profile = user?.profile;
  const currentStatus = driver?.available ? 'available' : 'offline';
  const statusColor = getAvailabilityColor(currentStatus);
  const expiration = getExpirationInfo(driver?.current_location?.lastUpdated);
  const locationLabel = driver?.current_location?.city
    ? `${driver.current_location.city}, ${driver.current_location.state}`
    : 'Sem localização';

  const load = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fretes em andamento e recentes
      const [activeRes, recentRes] = await Promise.all([
        supabase
          .from('freights')
          .select('*')
          .eq('accepted_driver_id', user.id)
          .in('status', ['contracted', 'in-transit'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('freights')
          .select('*')
          .eq('accepted_driver_id', user.id)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(3),
      ]);

      const allRows = [...(activeRes.data ? [activeRes.data] : []), ...(recentRes.data || [])];
      const profiles = await fetchPublisherProfiles(supabase, allRows);
      setActiveFreight(activeRes.data ? mapSupabaseFreight(activeRes.data, profiles.get(activeRes.data.publisher_id)) : null);
      const recent = (recentRes.data || []).map(row => mapSupabaseFreight(row, profiles.get(row.publisher_id)));
      setRecentFreights(recent);

      // 2. Ganhos do Mês
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyFreights } = await supabase
        .from('freights')
        .select('value_estimate')
        .eq('accepted_driver_id', user.id)
        .eq('status', 'completed')
        .gte('updated_at', startOfMonth.toISOString());

      const monthlyEarnings = (monthlyFreights || []).reduce((sum, f) => sum + (Number(f.value_estimate) || 0), 0);

      // 3. Fretes Próximos (Cidade Atual)
      let nearbyFreights = 0;
      if (driver?.current_location?.city) {
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .eq('origin_city', driver.current_location.city)
          .eq('origin_state', driver.current_location.state);
        nearbyFreights = count || 0;
      }

      // 4. Mensagens Não Lidas
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

      // 5. CNH Expiry
      let cnhDaysLeft = null;
      if (driver?.cnh_expiry) {
        const expiry = new Date(driver.cnh_expiry);
        const diff = expiry.getTime() - Date.now();
        cnhDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      // 6. Visualizações de Perfil
      const { count: profileViews } = await supabase
        .from('profile_views')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', user.id);

      const completedTrips = driver?.completed_trips || 0;
      const totalEarnings = profile?.total_earnings ?? recent.reduce((s: number, f: Freight) => s + (Number(f.price) || 0), 0);

      setStats({
        totalEarnings,
        monthlyEarnings,
        completedTrips,
        rating: profile?.rating || driver?.rating || 0,
        nearbyFreights,
        unreadMessages,
        profileViews: profileViews || 0,
        cnhDaysLeft,
      });
    } finally {
      setLoading(false);
    }
  }, [user, driver, profile]);

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

  const firstName = (profile?.name || driver?.name || '').split(' ')[0];

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('ProfileTab')} activeOpacity={0.8}>
            {profile?.avatar_url && !avatarError
              ? <Image source={{ uri: getSupabaseAvatarUrl(profile.avatar_url) }} style={styles.avatarImg} onError={() => setAvatarError(true)} />
              : <Text style={styles.avatarInitial}>{(firstName || 'M')[0].toUpperCase()}</Text>}
          </TouchableOpacity>
          <Text style={styles.greeting}>{greeting()}, {firstName || 'Motorista'}</Text>
          <TouchableOpacity
            style={styles.availabilityBtn}
            onPress={() => setShowAvailabilityModal(true)}
            activeOpacity={0.75}
          >
            <Ionicons 
              name={currentStatus === 'available' ? 'checkmark-circle' : currentStatus === 'busy' ? 'time' : 'moon'} 
              size={13} 
              color={statusColor} 
            />
            <View style={styles.btnDivider} />
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.locationBtnText} numberOfLines={1}>{locationLabel}</Text>
            {expiration && !expiration.expired && (
              <>
                <View style={styles.btnDivider} />
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.expirationBtnText}>{expiration.text}</Text>
              </>
            )}
            {expiration?.expired && (
              <>
                <View style={styles.btnDivider} />
                <Ionicons name="warning-outline" size={11} color="#fca5a5" />
                <Text style={styles.expiredBtnText}>Expirado</Text>
              </>
            )}
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
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
              <View style={styles.mainEarningsCard}>
                <View style={styles.earningsIcon}>
                  <Ionicons name="wallet-outline" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={styles.monthlyLabel}>Ganhos do Mês</Text>
                  <Text style={styles.monthlyValue}>{formatCurrency(stats.monthlyEarnings)}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.earningsDetailBtn}
                  onPress={() => navigation.navigate('ProfileTab')}
                >
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statsGridRow}>
                  <MiniStatCard 
                    icon="chatbubbles" 
                    color={COLORS.primary} 
                    label="Mensagens" 
                    value={stats.unreadMessages > 0 ? `${stats.unreadMessages} novas` : 'Lidas'} 
                    onPress={() => navigation.navigate('ChatTab')}
                  />
                  <MiniStatCard 
                    icon="search" 
                    color={COLORS.primary} 
                    label="Fretes Perto" 
                    value={stats.nearbyFreights > 0 ? `${stats.nearbyFreights} na área` : 'Buscar'} 
                    onPress={() => navigation.navigate('FreightsTab', { screen: 'FreightsList', params: { originCity: driver?.current_location?.city } })}
                  />
                </View>
                <View style={styles.statsGridRow}>
                  <MiniStatCard
                    icon="star"
                    color={COLORS.primary}
                    label="Avaliação"
                    value={stats.rating > 0 ? stats.rating.toFixed(1) : '-'}
                  />
                  <MiniStatCard
                    icon="eye"
                    color={COLORS.primary}
                    label="Visitas"
                    value={stats.profileViews > 0 ? `${stats.profileViews} visitas` : 'Sem visitas'}
                  />
                </View>
                {stats.cnhDaysLeft !== null && stats.cnhDaysLeft < 30 && (
                  <View style={styles.statsGridRow}>
                    <MiniStatCard 
                      icon="warning" 
                      color={COLORS.primary} 
                      label="CNH Vence em" 
                      value={`${stats.cnhDaysLeft} dias`} 
                      onPress={() => navigation.navigate('ProfileTab')}
                    />
                  </View>
                )}
              </View>
            </View>

            {activeFreight && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Frete em Andamento</Text>
                <ActiveFreightCard freight={activeFreight} onPress={() => navigation.navigate('FreightDetail', { freight: activeFreight })} />
              </View>
            )}

            {recentFreights.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Últimas Viagens</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('FreightsTab')}>
                    <Text style={styles.seeAll}>Ver tudo</Text>
                  </TouchableOpacity>
                </View>
                {recentFreights.map(f => (
                  <FreightCard key={f.id} freight={f} onPress={() => navigation.navigate('FreightDetail', { freight: f })} />
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acesso Rápido</Text>
              <View style={{ gap: 10 }}>
                <View style={styles.quickActionsRow}>
                  <QuickAction icon="map-outline" label="Minhas Rotas" onPress={() => navigation.navigate('RoutesTab')} color={COLORS.primary} />
                  <QuickAction icon="chatbubbles-outline" label="Mensagens" onPress={() => navigation.navigate('ChatTab')} color={COLORS.primary} />
                </View>
                <View style={styles.quickActionsRow}>
                  <QuickAction icon="person-outline" label="Meu Perfil" onPress={() => navigation.navigate('ProfileTab')} color={COLORS.primary} />
                  <QuickAction icon="search-outline" label="Ver Fretes" onPress={() => navigation.navigate('FreightsTab')} color={COLORS.primary} />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <LocationAvailabilityModal
        visible={showAvailabilityModal}
        currentStatus={currentStatus}
        currentCity={driver?.current_location?.city || ''}
        currentState={driver?.current_location?.state || ''}
        expiration={expiration}
        onClose={() => setShowAvailabilityModal(false)}
        onChangeStatus={updateDriverAvailability}
        onSaveLocation={updateDriverLocation}
      />
    </View>
  );
}

function StatCard({ icon, iconColor, label, value, small }: {
  icon: string; iconColor: string; label: string; value: string; small?: boolean;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[statStyles.value, small && { fontSize: 13 }]} numberOfLines={1}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function ActiveFreightCard({ freight, onPress }: { freight: Freight; onPress: () => void }) {
  const progress = freight.status === 'in-transit' ? 60 : 20;
  return (
    <TouchableOpacity style={activeStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={activeStyles.badge}>
        <View style={activeStyles.dot} />
        <Text style={activeStyles.badgeText}>
          {freight.status === 'in-transit' ? 'Em Trânsito' : 'Contratado'}
        </Text>
      </View>
      <View style={activeStyles.route}>
        <View style={activeStyles.locationRow}>
          <Ionicons name="radio-button-on" size={14} color="#fff" />
          <Text style={activeStyles.locationText}>{formatLocation(freight.origin)}</Text>
        </View>
        <View style={activeStyles.progressBar}>
          <View style={[activeStyles.progressFill, { width: `${progress}%` as any, backgroundColor: '#fff' }]} />
        </View>
        <View style={activeStyles.locationRow}>
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={activeStyles.locationText}>{formatLocation(freight.destination)}</Text>
        </View>
      </View>
      {freight.price && (
        <View style={activeStyles.footer}>
          <Text style={activeStyles.price}>{formatCurrency(freight.price)}</Text>
          <Text style={activeStyles.company}>{freight.company_name || 'Embarcador'}</Text>
        </View>
      )}
    </TouchableOpacity>
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

type Status = 'available' | 'busy' | 'offline';

function LocationAvailabilityModal({
  visible, currentStatus, currentCity, currentState, expiration, onClose, onChangeStatus, onSaveLocation,
}: {
  visible: boolean;
  currentStatus: Status;
  currentCity: string;
  currentState: string;
  expiration: { expired: boolean; text: string } | null;
  onClose: () => void;
  onChangeStatus: (s: Status) => Promise<void>;
  onSaveLocation: (loc: { city: string; state: string }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState(currentCity);
  const [stateUF, setStateUF] = useState(currentState);
  const [changingStatus, setChangingStatus] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    if (visible) {
      setCity(currentCity);
      setStateUF(currentState);
    }
  }, [visible, currentCity, currentState]);

  async function handleStatusChange(s: Status) {
    if (s === currentStatus) return;
    setChangingStatus(true);
    await onChangeStatus(s);
    setChangingStatus(false);
  }

  async function handleSaveLocation() {
    if (!city.trim() || !stateUF.trim()) return;
    setSavingLocation(true);
    await onSaveLocation({ city: city.trim(), state: stateUF.trim().toUpperCase() });
    setSavingLocation(false);
    onClose();
  }

  const statusOptions: { status: Status; icon: string; desc: string }[] = [
    { status: 'available', icon: 'checkmark-circle', desc: 'Pronto para receber fretes' },
    { status: 'busy', icon: 'time', desc: 'Já estou em uma entrega' },
    { status: 'offline', icon: 'moon', desc: 'Não quero receber fretes agora' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={modalStyles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={modalStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Localização (primeiro) ── */}
            <Text style={modalStyles.sectionTitle}>Minha Localização</Text>

            {expiration && (
              <View style={[modalStyles.expirationRow, expiration.expired && modalStyles.expirationRowExpired]}>
                <Ionicons
                  name={expiration.expired ? 'warning-outline' : 'time-outline'}
                  size={13}
                  color={expiration.expired ? COLORS.danger : COLORS.textSecondary}
                />
                <Text style={[modalStyles.expirationRowText, expiration.expired && { color: COLORS.danger }]}>
                  {expiration.expired
                    ? 'Localização expirada — atualize para ser encontrado'
                    : `Válida por mais ${expiration.text}`}
                </Text>
              </View>
            )}

            <CityAutocompleteInput
              placeholder="Digite sua cidade atual"
              value={city}
              onSelect={(cityName, stateCode) => {
                setCity(cityName);
                setStateUF(stateCode);
              }}
            />

            <TouchableOpacity
              style={[modalStyles.saveBtn, (!city.trim() || !stateUF.trim()) && { opacity: 0.45 }]}
              onPress={handleSaveLocation}
              disabled={savingLocation || !city.trim() || !stateUF.trim()}
            >
              {savingLocation
                ? <ActivityIndicator color="#fff" />
                : <Text style={modalStyles.saveBtnText}>Atualizar Localização</Text>}
            </TouchableOpacity>

            {/* ── Status (segundo) ── */}
            <View style={modalStyles.divider} />
            <Text style={modalStyles.sectionTitle}>Meu Status</Text>

            {statusOptions.map(opt => {
              const color = getAvailabilityColor(opt.status);
              const isSelected = opt.status === currentStatus;
              return (
                <TouchableOpacity
                  key={opt.status}
                  style={[modalStyles.option, isSelected && { backgroundColor: color + '15', borderColor: color + '40' }]}
                  onPress={() => handleStatusChange(opt.status)}
                  disabled={changingStatus}
                >
                  <View style={[modalStyles.optionIcon, { backgroundColor: color + '20' }]}>
                    {changingStatus && isSelected
                      ? <ActivityIndicator size="small" color={color} />
                      : <Ionicons name={opt.icon as any} size={20} color={color} />}
                  </View>
                  <View style={modalStyles.optionText}>
                    <Text style={[modalStyles.optionLabel, { color }]}>{AVAILABILITY_LABELS[opt.status]}</Text>
                    <Text style={modalStyles.optionDesc}>{opt.desc}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={18} color={color} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    alignItems: 'flex-start',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: COLORS.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', marginBottom: 10,
  },
  avatarImg: { 
    width: 80, height: 80, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.primaryDark 
  },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  headerLeft: { flex: 1, gap: 6, marginRight: 12 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  availabilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },

  btnDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2 },
  locationBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '500', flexShrink: 1 },
  expirationBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  expiredBtnText: { fontSize: 11, color: '#fca5a5', fontWeight: '600' },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  summaryContainer: { gap: 12 },
  mainEarningsCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  earningsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  monthlyValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  earningsDetailBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: { gap: 10 },
  statsGridRow: { flexDirection: 'row', gap: 10 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  // Mini cards
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
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
});

const activeStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, gap: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  route: { gap: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginLeft: 22 },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { color: '#fff', fontWeight: '800', fontSize: 18 },
  company: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
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

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  scrollContent: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  expirationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  expirationRowExpired: { backgroundColor: '#fef2f2' },
  expirationRowText: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  saveBtn: {
    height: 50, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
  optionLabel: { fontWeight: '700', fontSize: 14 },
  optionDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
