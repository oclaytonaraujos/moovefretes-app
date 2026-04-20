import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { CachedAvatar } from '../components/CachedAvatar';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';
import type { Company } from '../types';

const FAVORITES_KEY = 'favorites_companies';

export const TYPE_LABELS: Record<string, string> = {
  transportadora: 'Transportadora',
  embarcador: 'Embarcador',
  agenciador: 'Agenciador',
};

export const TYPE_COLORS: Record<string, string> = {
  transportadora: COLORS.primary,
  embarcador: COLORS.info,
  agenciador: COLORS.orange,
};

interface FilterState {
  companyTypes: string[];
  verified: 'todos' | 'sim' | 'nao';
  minRating: '' | '2' | '3' | '4';
  city: string;
  onlyFavorites: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  companyTypes: [],
  verified: 'todos',
  minRating: '',
  city: '',
  onlyFavorites: false,
};

function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.companyTypes.length > 0) n++;
  if (f.verified !== 'todos') n++;
  if (f.minRating !== '') n++;
  if (f.city.trim()) n++;
  if (f.onlyFavorites) n++;
  return n;
}

function tryParseAddress(address: any): { city?: string; state?: string } {
  try {
    const parsed = typeof address === 'string' ? JSON.parse(address) : address;
    return { city: parsed?.city, state: parsed?.state };
  } catch { return {}; }
}

function mapRow(row: any, profile?: any, freightStats?: { active: number; completed: number }, ratings?: any[]): Company {
  const ratingList = ratings || [];
  const avgRating = ratingList.length > 0
    ? ratingList.reduce((s: number, r: any) => s + (r.overall_rating || 0), 0) / ratingList.length
    : profile?.rating || 0;
  const addr = tryParseAddress(row.address);
  const logo = row.logo || profile?.avatar_url || null;
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.company_name || row.name || profile?.name || 'Empresa',
    company_type: row.company_type || row.type || 'transportadora',
    cnpj: row.cnpj || undefined,
    phone: row.phone || profile?.phone || undefined,
    email: row.email || profile?.email || undefined,
    logo: logo || undefined,
    city: profile?.city || addr.city,
    state: profile?.state || addr.state,
    verified: row.verification_status === 'verified' || row.verified === true,
    created_at: row.created_at,
    description: row.description || undefined,
    website: row.website || profile?.website || undefined,
    rating: avgRating,
    active_freights: freightStats?.active || 0,
    completed_freights: freightStats?.completed || 0,
    review_count: ratingList.length,
  };
}

export function CompaniesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  useAuth(); // keep auth context active
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  const toggleFavorite = useCallback(async (companyId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) { setCompanies([]); return; }

      const userIds = rows.map((r: any) => r.user_id).filter(Boolean);

      const [profilesRes, freightsRes, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, phone, avatar_url, rating, city, state').in('id', userIds),
        supabase.from('freights').select('publisher_id, status').in('publisher_id', userIds),
        supabase.from('ratings').select('target_id, overall_rating').in('target_id', userIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

      const freightStats = new Map<string, { active: number; completed: number }>();
      for (const f of (freightsRes.data || [])) {
        if (!freightStats.has(f.publisher_id)) freightStats.set(f.publisher_id, { active: 0, completed: 0 });
        const s = freightStats.get(f.publisher_id)!;
        if (f.status === 'active') s.active++;
        if (f.status === 'completed') s.completed++;
      }

      const ratingsMap = new Map<string, any[]>();
      for (const r of (ratingsRes.data || [])) {
        if (!ratingsMap.has(r.target_id)) ratingsMap.set(r.target_id, []);
        ratingsMap.get(r.target_id)!.push(r);
      }

      setCompanies(rows.map((row: any) => mapRow(
        row,
        profileMap.get(row.user_id),
        freightStats.get(row.user_id),
        ratingsMap.get(row.user_id) || [],
      )));
    } catch {
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    loadCompanies().then(() => setLoading(false));
  }, [loadFavorites, loadCompanies]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadCompanies();
    setRefreshing(false);
  }

  const filtered = useMemo(() => companies.filter(c => {
    if (filters.onlyFavorites && !favorites.has(c.id)) return false;
    if (filters.companyTypes.length > 0 && !filters.companyTypes.includes(c.company_type)) return false;
    if (filters.verified === 'sim' && !c.verified) return false;
    if (filters.verified === 'nao' && c.verified) return false;
    if (filters.minRating !== '' && (c.rating || 0) < Number(filters.minRating)) return false;
    if (filters.city.trim() && !c.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
    return true;
  }), [companies, filters, favorites]);

  const activeCount = countActiveFilters(filters);

  function openFilter() { setPending(filters); setShowFilter(true); }
  function applyFilters() { setFilters(pending); setShowFilter(false); }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Empresas</Text>
          <Text style={styles.subtitle}>Transportadoras, embarcadores e agenciadores</Text>
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
          if (key === 'companyTypes') {
            setFilters(prev => ({ ...prev, companyTypes: prev.companyTypes.filter(v => v !== val) }));
          } else if (key === 'verified') {
            setFilters(prev => ({ ...prev, verified: 'todos' }));
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
            <CompanyCard
              company={item}
              onPress={() => navigation.navigate('CompanyDetail', { company: item })}
              onChat={() => navigation.navigate('Chat', {
                userId: item.user_id,
                userName: item.name,
                userAvatar: item.logo,
              })}
              onWhatsApp={() => {
                if (item.phone) Linking.openURL(`https://wa.me/55${item.phone.replace(/\D/g, '')}`);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={52} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Nenhuma empresa encontrada</Text>
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
              <FilterSection title="Tipo de Empresa">
                <View style={styles.chipRow}>
                  {(['transportadora', 'embarcador', 'agenciador'] as const).map(t => {
                    const active = pending.companyTypes.includes(t);
                    const color = TYPE_COLORS[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
                        onPress={() => setPending(p => ({
                          ...p,
                          companyTypes: p.companyTypes.includes(t)
                            ? p.companyTypes.filter(x => x !== t)
                            : [...p.companyTypes, t],
                        }))}
                      >
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{TYPE_LABELS[t]}</Text>
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

              <FilterSection title="Verificação">
                <View style={styles.radioRow}>
                  {(['todos', 'sim', 'nao'] as const).map(opt => (
                    <RadioOpt
                      key={opt}
                      label={opt === 'todos' ? 'Todas' : opt === 'sim' ? 'Verificadas' : 'Não verificadas'}
                      selected={pending.verified === opt}
                      onPress={() => setPending(p => ({ ...p, verified: opt }))}
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

              <FilterSection title="Favoritas" last>
                <View style={styles.radioRow}>
                  <RadioOpt 
                    label="Mostrar apenas favoritas" 
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

function CompanyCard({ company, onPress, onChat, onWhatsApp }: {
  company: Company;
  onPress: () => void;
  onChat: () => void;
  onWhatsApp: () => void;
}) {
  const typeColor = TYPE_COLORS[company.company_type] || COLORS.primary;
  const typeLabel = TYPE_LABELS[company.company_type] || company.company_type;
  const rating = company.rating || 0;
  const location = [company.city?.toUpperCase(), company.state?.toUpperCase()].filter(Boolean).join(' - ');

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={cardStyles.row}>
        {/* Avatar */}
        <CachedAvatar uri={company.logo} name={company.name} size={56} borderRadius={8} />

        {/* Info */}
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{company.name}</Text>
            {company.verified && (
              <Ionicons name="checkmark-circle" size={15} color={COLORS.info} />
            )}
          </View>

          <View style={[cardStyles.typeBadge, { backgroundColor: typeColor + '1A' }]}>
            <Text style={[cardStyles.typeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>

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
              {company.review_count ?? 0} {(company.review_count ?? 0) === 1 ? 'avaliação' : 'avaliações'}
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
    filters.companyTypes.forEach(t => items.push({ key: 'companyTypes', val: t, label: TYPE_LABELS[t] || t }));
    if (filters.city.trim()) items.push({ key: 'city', label: `Cidade: ${filters.city}` });
    if (filters.verified !== 'todos') items.push({ key: 'verified', label: filters.verified === 'sim' ? 'Verificadas' : 'Não verificadas' });
    if (filters.minRating !== '') items.push({ key: 'minRating', label: `${filters.minRating}+ ★` });
    if (filters.onlyFavorites) items.push({ key: 'onlyFavorites', label: 'Favoritas' });
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
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: { fontSize: 11, fontWeight: '500' },
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
  favBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
