import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { useFreights } from '../hooks/useFreights';
import { FreightCard } from '../components/FreightCard';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';
import type { Freight } from '../types';

const HEAVY_VEHICLES = ['Carreta', 'Carreta LS', 'Vanderléia', 'Bitrem', 'Rodotrem'];
const MEDIUM_VEHICLES = ['Truck', 'Bitruck'];
const LIGHT_VEHICLES = ['Fiorino', 'VLC', '3/4', 'Toco'];
const OPEN_TRAILERS = ['Graneleiro', 'Grade Baixa', 'Prancha', 'Caçamba', 'Plataforma'];
const CLOSED_TRAILERS = ['Sider', 'Baú', 'Baú Frigorífico', 'Baú Refrigerado'];
const SPECIAL_TRAILERS = ['Silo', 'Cegonheiro', 'Gaiola', 'Tanque', 'Munck'];

interface FilterState {
  originCity: string;
  destinationCity: string;
  vehicleTypes: string[];
  bodyTypes: string[];
  hasTracker: 'sim' | 'nao' | 'ambos';
  hasPrice: 'sim' | 'nao' | 'ambos';
  occupancy: 'completa' | 'complemento' | 'ambos';
}

const DEFAULT_FILTERS: FilterState = {
  originCity: '',
  destinationCity: '',
  vehicleTypes: [],
  bodyTypes: [],
  hasTracker: 'ambos',
  hasPrice: 'ambos',
  occupancy: 'ambos',
};

function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.originCity.trim()) n++;
  if (f.destinationCity.trim()) n++;
  if (f.vehicleTypes.length > 0) n++;
  if (f.bodyTypes.length > 0) n++;
  if (f.hasTracker !== 'ambos') n++;
  if (f.hasPrice !== 'ambos') n++;
  if (f.occupancy !== 'ambos') n++;
  return n;
}

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter(v => v !== item) : [...list, item];
}

export function FreightsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTERS);

  const driver = user?.driver;

  const {
    data,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
    error: queryError,
  } = useFreights(driver ?? null);

  const freights: Freight[] = data?.pages.flatMap(p => p.items) ?? [];

  async function handleRefresh() {
    await refetch();
  }

  const filtered = useMemo(() => freights.filter((f: Freight) => {
    if (filters.originCity.trim() &&
      !f.origin?.city?.toLowerCase().includes(filters.originCity.toLowerCase())) return false;

    if (filters.destinationCity.trim() &&
      !f.destination?.city?.toLowerCase().includes(filters.destinationCity.toLowerCase())) return false;

    if (filters.vehicleTypes.length > 0) {
      const all = [
        ...(f.selectedLightVehicles || []),
        ...(f.selectedMediumVehicles || []),
        ...(f.selectedHeavyVehicles || []),
        ...(f.vehicle_types || []),
      ];
      if (!filters.vehicleTypes.some(v => all.some(a => a.toLowerCase().includes(v.toLowerCase())))) return false;
    }

    if (filters.bodyTypes.length > 0) {
      const all = [
        ...(f.selectedClosedTrailers || []),
        ...(f.selectedOpenTrailers || []),
        ...(f.selectedSpecialTrailers || []),
        ...(f.body_types || []),
      ];
      if (!filters.bodyTypes.some(b => all.some(a => a.toLowerCase().includes(b.toLowerCase())))) return false;
    }

    if (filters.hasTracker !== 'ambos') {
      const has = f.needsTracker === true;
      if (filters.hasTracker === 'sim' && !has) return false;
      if (filters.hasTracker === 'nao' && has) return false;
    }

    if (filters.hasPrice !== 'ambos') {
      const has = f.price !== null && f.price !== undefined && f.price !== 'A combinar' && f.price !== 0;
      if (filters.hasPrice === 'sim' && !has) return false;
      if (filters.hasPrice === 'nao' && has) return false;
    }

    if (filters.occupancy !== 'ambos') {
      const isComplement = f.occupancyType === 'complemento';
      if (filters.occupancy === 'completa' && isComplement) return false;
      if (filters.occupancy === 'complemento' && !isComplement) return false;
    }

    return true;
  }), [freights, filters]);

  const activeCount = countActiveFilters(filters);

  function openFilter() {
    setPending(filters);
    setShowFilter(true);
  }

  function applyFilters() {
    setFilters(pending);
    setShowFilter(false);
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Fretes Disponíveis</Text>
          <Text style={styles.subtitle}>Encontre seu próximo frete</Text>
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

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <FreightCard
              freight={item}
              onPress={() => navigation.navigate('FreightDetail', { freight: item })}
              showActions
            />
          )}
          ListFooterComponent={
            isFetchingNextPage
              ? <ActivityIndicator size="small" color={COLORS.primary} style={{ paddingVertical: 16 }} />
              : null
          }
          ListEmptyComponent={
            queryError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
                <Text style={styles.emptyTitle}>Erro ao carregar fretes</Text>
                <Text style={styles.emptyDesc}>{(queryError as Error).message}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyTitle}>Nenhum frete encontrado</Text>
                <Text style={styles.emptyDesc}>
                  {activeCount > 0 ? 'Tente ajustar os filtros.' : 'Verifique mais tarde.'}
                </Text>
              </View>
            )
          }
        />
      )}

      <Modal
        visible={showFilter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilter(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowFilter(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setPending(DEFAULT_FILTERS)}>
                <Text style={styles.clearText}>Limpar tudo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <FilterSection title="Origem">
                <CityAutocompleteInput
                  placeholder="Cidade de origem"
                  value={pending.originCity}
                  onSelect={(city) => setPending(p => ({ ...p, originCity: city }))}
                />
              </FilterSection>

              <FilterSection title="Destino">
                <CityAutocompleteInput
                  placeholder="Cidade de destino"
                  value={pending.destinationCity}
                  onSelect={(city) => setPending(p => ({ ...p, destinationCity: city }))}
                />
              </FilterSection>

              <FilterSection title="Tipo de Veículo">
                <Text style={styles.groupLabel}>Pesados</Text>
                <ChipGroup
                  items={HEAVY_VEHICLES}
                  selected={pending.vehicleTypes}
                  onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))}
                />
                <Text style={styles.groupLabel}>Médios</Text>
                <ChipGroup
                  items={MEDIUM_VEHICLES}
                  selected={pending.vehicleTypes}
                  onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))}
                />
                <Text style={styles.groupLabel}>Leves</Text>
                <ChipGroup
                  items={LIGHT_VEHICLES}
                  selected={pending.vehicleTypes}
                  onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))}
                />
              </FilterSection>

              <FilterSection title="Tipo de Carroceria">
                <Text style={styles.groupLabel}>Aberta</Text>
                <ChipGroup
                  items={OPEN_TRAILERS}
                  selected={pending.bodyTypes}
                  onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))}
                />
                <Text style={styles.groupLabel}>Fechada</Text>
                <ChipGroup
                  items={CLOSED_TRAILERS}
                  selected={pending.bodyTypes}
                  onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))}
                />
                <Text style={styles.groupLabel}>Especial</Text>
                <ChipGroup
                  items={SPECIAL_TRAILERS}
                  selected={pending.bodyTypes}
                  onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))}
                />
              </FilterSection>

              <FilterSection title="Rastreador">
                <View style={styles.radioRow}>
                  {(['ambos', 'sim', 'nao'] as const).map(opt => (
                    <RadioOpt
                      key={opt}
                      label={opt === 'ambos' ? 'Todos' : opt === 'sim' ? 'Exige' : 'Não exige'}
                      selected={pending.hasTracker === opt}
                      onPress={() => setPending(p => ({ ...p, hasTracker: opt }))}
                    />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title="Valor">
                <View style={styles.radioRow}>
                  {(['ambos', 'sim', 'nao'] as const).map(opt => (
                    <RadioOpt
                      key={opt}
                      label={opt === 'ambos' ? 'Todos' : opt === 'sim' ? 'Com valor' : 'A combinar'}
                      selected={pending.hasPrice === opt}
                      onPress={() => setPending(p => ({ ...p, hasPrice: opt }))}
                    />
                  ))}
                </View>
              </FilterSection>

              <FilterSection title="Tipo de Carga" last>
                <View style={styles.radioRow}>
                  {(['ambos', 'completa', 'complemento'] as const).map(opt => (
                    <RadioOpt
                      key={opt}
                      label={opt === 'ambos' ? 'Todos' : opt === 'completa' ? 'Completa' : 'Complemento'}
                      selected={pending.occupancy === opt}
                      onPress={() => setPending(p => ({ ...p, occupancy: opt }))}
                    />
                  ))}
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

function ChipGroup({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={styles.chipRow}>
      {items.map(item => {
        const active = selected.includes(item);
        return (
          <TouchableOpacity
            key={item}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(item)}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RadioOpt({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.radioOpt, selected && styles.radioOptActive]}
      onPress={onPress}
    >
      <View style={[styles.radioDot, selected && styles.radioDotActive]} />
      <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 8,
    width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  retryBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal
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
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  groupLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: 10,
    paddingHorizontal: 12, height: 44, gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipLabelActive: { color: '#fff', fontWeight: '600' },
  radioRow: { flexDirection: 'row', gap: 8 },
  radioOpt: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
    backgroundColor: COLORS.background,
  },
  radioOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  radioDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: COLORS.border,
  },
  radioDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500', flex: 1 },
  radioLabelActive: { color: COLORS.primary, fontWeight: '600' },
  applyBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
