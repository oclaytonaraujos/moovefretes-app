import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { formatPhone, formatLocation } from '../utils/helpers';
import { CachedAvatar } from './CachedAvatar';

interface ProfileData {
  name: string;
  avatar_url?: string;
  user_type?: string;
  phone?: string;
  is_online?: boolean;
  last_seen?: string;
  rating?: number;
  total_ratings?: number;
}

interface DriverData {
  phone?: string;
  rating?: number;
  completed_trips?: number;
  available?: boolean;
  vehicle_type?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  vehicle_year?: string;
  vehicle_capacity?: number;
  vehicle_types?: string[];
  cnh?: string;
  cnh_category?: string;
  cnh_expiry?: string;
  rntrc?: string;
  current_location?: { city?: string; state?: string };
}

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const USER_TYPE_LABELS: Record<string, string> = {
  transportadora: 'Transportadora',
  embarcador: 'Embarcador',
  agenciador: 'Agenciador',
  caminhoneiro: 'Motorista',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.box}>
      <View style={sectionStyles.header}>
        <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) return null;
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 2) return 'Visto agora mesmo';
  if (m < 60) return `Visto há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Visto há ${h}h`;
  const d = Math.floor(h / 24);
  return `Visto há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export function UserProfileModal({ visible, userId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(false);

  // Registrar visualização
  useEffect(() => {
    if (visible && userId && user?.id && userId !== user.id) {
      supabase
        .from('profile_views')
        .insert({
          viewer_id: user.id,
          target_id: userId,
        })
        .then(({ error }) => {
          if (error) console.error('Error recording profile view:', error);
        });
    }
  }, [visible, userId, user?.id]);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    setProfile(null);
    setDriver(null);

    Promise.all([
      supabase
        .from('profiles')
        .select('name, avatar_url, user_type, phone, is_online, last_seen, rating, total_ratings')
        .eq('id', userId)
        .single(),
      supabase
        .from('drivers')
        .select('phone, rating, completed_trips, available, vehicle_type, vehicle_model, vehicle_plate, vehicle_year, vehicle_capacity, vehicle_types, cnh, cnh_category, cnh_expiry, rntrc, current_location')
        .eq('user_id', userId)
        .maybeSingle(),
    ]).then(([profileRes, driverRes]) => {
      setProfile(profileRes.data || null);
      setDriver(driverRes.data || null);
      setLoading(false);
    });
  }, [visible, userId]);

  const typeLabel = profile?.user_type ? USER_TYPE_LABELS[profile.user_type] || profile.user_type : null;
  const rating = driver?.rating ?? profile?.rating ?? 0;
  const phone = driver?.phone || profile?.phone;
  const hasVehicle = driver && (driver.vehicle_type || driver.vehicle_model || driver.vehicle_plate);
  const hasDocs = driver && (driver.cnh || driver.cnh_category || driver.cnh_expiry || driver.rntrc);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject as any} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : profile ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Avatar + nome */}
              <View style={styles.heroRow}>
                <View style={styles.avatarWrap}>
                  <CachedAvatar uri={profile.avatar_url} name={profile.name} size={80} borderRadius={40} />
                  {profile.is_online && <View style={styles.onlineDot} />}
                </View>
                <Text style={styles.name}>{profile.name}</Text>

                <View style={styles.badgeRow}>
                  {typeLabel && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{typeLabel}</Text>
                    </View>
                  )}
                  {driver?.available != null && (
                    <View style={[styles.statusBadge, { backgroundColor: driver.available ? COLORS.available + '20' : '#6b728020' }]}>
                      <View style={[styles.statusDot, { backgroundColor: driver.available ? COLORS.available : '#6b7280' }]} />
                      <Text style={[styles.statusText, { color: driver.available ? COLORS.available : '#6b7280' }]}>
                        {driver.available ? 'Disponível' : 'Offline'}
                      </Text>
                    </View>
                  )}
                </View>

                {profile.is_online
                  ? <Text style={[styles.lastSeen, { color: COLORS.available }]}>Online agora</Text>
                  : profile.last_seen
                    ? <Text style={styles.lastSeen}>{formatLastSeen(profile.last_seen)}</Text>
                    : null}
              </View>

              {/* Stats */}
              {(rating > 0 || (driver?.completed_trips ?? 0) > 0 || (profile.total_ratings ?? 0) > 0) && (
                <View style={styles.statsRow}>
                  {rating > 0 && (
                    <View style={styles.stat}>
                      <Ionicons name="star" size={18} color="#fbbf24" />
                      <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
                      <Text style={styles.statLabel}>Avaliação</Text>
                    </View>
                  )}
                  {(driver?.completed_trips ?? 0) > 0 && (
                    <>
                      <View style={styles.statDivider} />
                      <View style={styles.stat}>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.available} />
                        <Text style={styles.statValue}>{driver!.completed_trips}</Text>
                        <Text style={styles.statLabel}>Viagens</Text>
                      </View>
                    </>
                  )}
                  {(profile.total_ratings ?? 0) > 0 && (
                    <>
                      <View style={styles.statDivider} />
                      <View style={styles.stat}>
                        <Ionicons name="people" size={18} color={COLORS.primary} />
                        <Text style={styles.statValue}>{profile.total_ratings}</Text>
                        <Text style={styles.statLabel}>Avaliações</Text>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Contato */}
              <Section icon="call-outline" title="Contato">
                {phone && <InfoRow label="Telefone" value={formatPhone(phone)} />}
                {driver?.current_location && (
                  <InfoRow label="Localização" value={formatLocation(driver.current_location)} />
                )}
              </Section>

              {/* Veículo */}
              {hasVehicle && (
                <Section icon="car-sport-outline" title="Veículo">
                  {driver.vehicle_type && <InfoRow label="Tipo" value={driver.vehicle_type} />}
                  {driver.vehicle_model && <InfoRow label="Modelo" value={driver.vehicle_model} />}
                  {driver.vehicle_plate && <InfoRow label="Placa" value={driver.vehicle_plate} />}
                  {driver.vehicle_year && <InfoRow label="Ano" value={String(driver.vehicle_year)} />}
                  {driver.vehicle_capacity && <InfoRow label="Capacidade" value={`${driver.vehicle_capacity} kg`} />}
                  {driver.vehicle_types && driver.vehicle_types.length > 0 && (
                    <View style={styles.tagsRow}>
                      {driver.vehicle_types.map(t => (
                        <View key={t} style={styles.tag}>
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Section>
              )}

              {/* Documentação */}
              {hasDocs && (
                <Section icon="document-text-outline" title="Documentação">
                  {driver.cnh && <InfoRow label="CNH" value={driver.cnh} />}
                  {driver.cnh_category && <InfoRow label="Categoria" value={driver.cnh_category} />}
                  {driver.cnh_expiry && (
                    <InfoRow label="Validade CNH" value={new Date(driver.cnh_expiry).toLocaleDateString('pt-BR')} />
                  )}
                  {driver.rntrc && <InfoRow label="RNTRC" value={driver.rntrc} />}
                </Section>
              )}
            </ScrollView>
          ) : (
            <Text style={styles.error}>Perfil não encontrado</Text>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 4 },
  loader: { paddingVertical: 48 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12 },
  heroRow: { alignItems: 'center', gap: 8 },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.available,
    borderWidth: 2.5, borderColor: COLORS.surface,
  },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  typeBadge: { backgroundColor: COLORS.primary + '15', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  typeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  lastSeen: { fontSize: 12, color: COLORS.textSecondary },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.borderLight },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: COLORS.primary + '15', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  error: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 32 },
  closeBtn: {
    marginHorizontal: 20, marginTop: 8, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
});

const sectionStyles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.background, borderRadius: 14,
    padding: 14, gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right', flex: 1, marginLeft: 12 },
});
