import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS, ALL_VEHICLE_TYPES } from '../utils/constants';
import { CachedAvatar } from '../components/CachedAvatar';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';
import type { Driver } from '../types';

const FAVORITES_KEY = 'favorites_drivers';

interface FilterState {
  vehicleTypes: string[];
  availability: 'todos' | 'disponivel' | 'ocupado';
  minRating: '' | '2' | '3' | '4';
  city: string;
  onlyFavorites: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  vehicleTypes: [],
  availability: 'todos',
  minRating: '',
  city: '',
  onlyFavorites: false,
};

function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.vehicleTypes.length > 0) n++;
  if (f.availability !== 'todos') n++;
  if (f.minRating !== '') n++;
  if (f.city.trim()) n++;
  if (f.onlyFavorites) n++;
  return n;
}

function mapRow(row: any, profile?: any, ratings?: any[]): Driver {
  const ratingList = ratings || [];
  const avgRating = ratingList.length > 0
    ? ratingList.reduce((s: number, r: any) => s + (r.overall_rating || 0), 0) / ratingList.length
    : profile?.rating || row.rating || 0;
  return {
    ...row,
    id: row.id,
    user_id: row.user_id,
    name: row.name || profile?.name || 'Motorista',
    phone: row.phone || profile?.phone || undefined,
    profile_image: row.profile_image || profile?.avatar_url || undefined,
    rating: avgRating,
    review_count: ratingList.length,
    current_location: row.current_location || undefined,
    available: row.available,
  };
}

export function DriversScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [drivers, setDrivers] = useState<(Driver & { review_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const originCity = route.params?.originCity;
    if (originCity) setFilters(prev => ({ ...prev, city: originCity }));
  }, [route.params?.originCity]);

  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const loadDrivers = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) { setDrivers([]); return; }

      const userIds = rows.map((r: any) => r.user_id).filter(Boolean);

      const [profilesRes, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, phone, avatar_url, rating').in('id', userIds),
        supabase.from('ratings').select('target_id, overall_rating').in('target_id', userIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

      const ratingsMap = new Map<string, any[]>();
      for (const r of (ratingsRes.data || [])) {
        if (!ratingsMap.has(r.target_id)) ratingsMap.set(r.target_id, []);
        ratingsMap.get(r.target_id)!.push(r);
      }

      setDrivers(rows.map((row: any) => mapRow(
        row,
        profileMap.get(row.user_id),
        ratingsMap.get(row.user_id) || [],
      )));
    } catch {
      setDrivers([]);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    loadDrivers().then(() => setLoading(false));
  }, [loadFavorites, loadDrivers]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDrivers();
    setRefreshing(false);
  }

  const filtered = useMemo(() => drivers.filter(d => {
    if (filters.onlyFavorites && !favorites.has(d.id)) return false;
    if (filters.vehicleTypes.length > 0) {
      const driverTypes = d.vehicle_types?.length ? d.vehicle_types : (d.vehicle_type ? [d.vehicle_type] : []);
      if (!filters.vehicleTypes.some(t => driverTypes.includes(t))) return false;
    }
    if (filters.availability === 'disponivel' && !d.available) return false;
    if (filters.availability === 'ocupado' && d.available) return false;
    if (filters.minRating !== '' && (d.rating || 0) < Number(filters.minRating)) return false;
    if (filters.city.trim()) {
      const driverCity = d.current_location?.city || '';
      if (!driverCity.toLowerCase().includes(filters.city.toLowerCase())) return false;
    }
    return true;
  }), [drivers, filters, favorites]);

  const activeCount = countActiveFilters(filters);

  function openFilter() { setPending(filters); setShowFilter(true); }
  function applyFilters() { setFilters(pending); setShowFilter(false); }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Motoristas</Text>
          <Text style={styles.subtitle}>Encontre motoristas disponíveis na rede</Text>
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={openFilter}>
          <Ionicons name="options-outline" size={20} color="#fff" />
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <AppliedFiltersBar
        filters={filters}
        onRemove={(key, val) => {
          if (key === 'vehicleTypes') {
            setFilters(prev => ({ ...prev, vehicleTypes: prev.vehicleTypes.filter(v => v !== val) }));
          } else if (key === 'availability') {
            setFilters(prev => ({ ...prev, availability: 'todos' }));
          } else if (key === 'onlyFavorites') {
            setFilters(prev => ({ ...prev, onlyFavorites: false }));
          } else {
            setFilters(prev => ({ ...prev, [key]: '' }));
          }
        }}
        onClearAll={() => setFilters(DEFAULT_FILTERS)}
      />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <DriverCard
              driver={item}
              onPress={() => navigation.navigate('DriverDetail', { driver: item })}
              onChat={() => navigation.navigate('Chat', {
                userId: item.user_id,
                userName: item.name,
                userAvatar: item.profile_image,
              })}
              onWhatsApp={() => {
                if (item.phone) Linking.openURL(`https://wa.me/55${item.phone.replace(/\D/g, '')}`);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Nenhum motorista encontrado</Text>
              <Text style={styles.emptyDesc}>
                {activeCount > 0 ? 'Tente ajustar os filtros.' : 'Verifique mais tarde.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showFilter} animationType="slide" transparent onRequestClose={() => setShowFilter(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowFilter(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setPending(DEFAULT_FILTERS)}>
                <Text style={styles.clearText}>Limpar tudo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <FilterSection title="Tipo de Veículo">
                <View style={styles.chipRow}>
                  {ALL_VEHICLE_TYPES.map(t => {
                    const active = pending.vehicleTypes.includes(t);
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                        onPress={() => setPending(p => ({
                          ...p,
                          vehicleTypes: p.vehicleTypes.includes(t)
                            ? p.vehicleTypes.filter(x => x !== t)
                            : [...p.vehicleTypes, t],
                        }))}
                      >
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FilterSection>

              <FilterSection title="Cidade">
                <CityAutocompleteInput
                  placeholder="Filtrar por cidade"
                  value={pending.city}
                  onSelect={city => setPending(p => ({ ...p, city }))}
                />
              </FilterSection>

              <FilterSection title="Disponibilidade">
                <View style={styles.radioRow}>
                  {(['todos', 'disponivel', 'ocupado'] as const).map(opt => (
                    <RadioOpt
                      key={opt}
                      label={opt === 'todos' ? 'Todos' : opt === 'disponivel' ? 'Disponíveis' : 'Ocupados'}
                      selected={pending.availability === opt}
                      onPress={() => setPending(p => ({ ...p, availability: opt }))}
                    />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title="Avaliação mínima">
                <View style={styles.radioRow}>
                  {([['', 'Todas'], ['4', '4+ ★'], ['3', '3+ ★'], ['2', '2+ ★']] as [string, string][]).map(([val, label]) => (
                    <RadioOpt
                      key={val}
                      label={label}
                      selected={pending.minRating === val}
                      onPress={() => setPending(p => ({ ...p, minRating: val as FilterState['minRating'] }))}
                    />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title="Favoritos" last>
                <View style={styles.radioRow}>
                  <RadioOpt
                    label="Mostrar apenas favoritos"
                    selected={pending.onlyFavorites}
                    onPress={() => setPending(p => ({ ...p, onlyFavorites: !p.onlyFavorites }))}
                  />
                </View>
              </FilterSection>
            </ScrollView>

            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyText}>Aplicar Filtros</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FilterSection({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.section, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RadioOpt({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.radioOpt, selected && styles.radioOptActive]} onPress={onPress}>
      <View style={[styles.radioDot, selected && styles.radioDotActive]} />
      <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DriverCard({ driver, onPress, onChat, onWhatsApp }: {
  driver: Driver & { review_count?: number };
  onPress: () => void;
  onChat: () => void;
  onWhatsApp: () => void;
}) {
  const location = driver.current_location?.city
    ? [driver.current_location.city.toUpperCase(), driver.current_location.state?.toUpperCase()].filter(Boolean).join(' - ')
    : null;
  const vehicleLabel = driver.vehicle_model || driver.vehicle_type || null;
  const rating = driver.rating || 0;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.row}>
        {/* Avatar */}
        <CachedAvatar uri={driver.profile_image} name={driver.name} size={56} borderRadius={28} />

        {/* Info */}
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{driver.name}</Text>
            <View style={[cardStyles.statusDot, { backgroundColor: driver.available ? COLORS.success : COLORS.textLight }]} />
          </View>

          {!!vehicleLabel && (
            <View style={cardStyles.vehicleBadge}>
              <Text style={cardStyles.vehicleText}>{vehicleLabel}</Text>
            </View>
          )}

          {location ? (
            <View style={cardStyles.locationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={cardStyles.locationText}>{location}</Text>
            </View>
          ) : null}

          <View style={cardStyles.ratingRow}>
            <Ionicons name="star" size={12} color="#facc15" />
            <Text style={cardStyles.ratingValue}>{rating > 0 ? rating.toFixed(1) : '0.0'}</Text>
            <Ionicons name="star-outline" size={12} color={COLORS.textLight} />
            <Text style={cardStyles.ratingCount}>
              {driver.review_count ?? 0} {(driver.review_count ?? 0) === 1 ? 'avaliação' : 'avaliações'}
            </Text>
          </View>
        </View>

        {/* Right: actions */}
        <View style={cardStyles.rightCol}>
          <View style={cardStyles.buttonsGroup}>
            <TouchableOpacity style={cardStyles.chatBtn} onPress={onChat}>
              <Ionicons name="chatbubble-outline" size={14} color="#fff" />
              <Text style={cardStyles.chatBtnText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={cardStyles.whatsappBtn} onPress={onWhatsApp}>
              <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
              <Text style={cardStyles.whatsappBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  clearText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  modalContent: { paddingHorizontal: 20, paddingBottom: 8 },
  section: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipLabelActive: { color: '#fff', fontWeight: '600' },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radioOpt: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
    backgroundColor: COLORS.background,
  },
  radioOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  radioDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.border },
  radioDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  radioLabelActive: { color: COLORS.primary, fontWeight: '600' },
  applyBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  appliedFiltersBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  appliedFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  appliedFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    gap: 6,
  },
  appliedFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

function AppliedFiltersBar({ filters, onRemove, onClearAll }: {
  filters: FilterState;
  onRemove: (key: keyof FilterState, val?: string) => void;
  onClearAll: () => void;
}) {
  const active = useMemo(() => {
    const items: { key: keyof FilterState; label: string; val?: string }[] = [];
    filters.vehicleTypes.forEach(t => items.push({ key: 'vehicleTypes', val: t, label: t }));
    if (filters.city.trim()) items.push({ key: 'city', label: `Cidade: ${filters.city}` });
    if (filters.availability !== 'todos') items.push({ key: 'availability', label: filters.availability === 'disponivel' ? 'Disponíveis' : 'Ocupados' });
    if (filters.minRating !== '') items.push({ key: 'minRating', label: `${filters.minRating}+ ★` });
    if (filters.onlyFavorites) items.push({ key: 'onlyFavorites', label: 'Favoritos' });
    return items;
  }, [filters]);

  if (active.length === 0) return null;

  return (
    <View style={styles.appliedFiltersBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appliedFiltersScroll}>
        {active.length > 1 && (
          <TouchableOpacity
            style={[styles.appliedFilterChip, { backgroundColor: COLORS.danger + '12', borderColor: COLORS.danger + '30' }]}
            onPress={onClearAll}
          >
            <Text style={[styles.appliedFilterLabel, { color: COLORS.danger }]}>Limpar Todos</Text>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        )}
        {active.map((item, idx) => (
          <TouchableOpacity key={`${item.key}-${item.val}-${idx}`} style={styles.appliedFilterChip} onPress={() => onRemove(item.key, item.val)}>
            <Text style={styles.appliedFilterLabel}>{item.label}</Text>
            <Ionicons name="close-circle" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  vehicleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.primary + '1A',
  },
  vehicleText: { fontSize: 11, fontWeight: '500', color: COLORS.primary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 13, color: COLORS.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  ratingCount: { fontSize: 12, color: COLORS.textSecondary },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 80,
  },
  buttonsGroup: {
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    width: 110,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  chatBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    width: 110,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#fff',
  },
  whatsappBtnText: { color: '#16a34a', fontSize: 13, fontWeight: '500' },
});
