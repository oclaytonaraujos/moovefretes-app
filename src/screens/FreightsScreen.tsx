import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FREIGHT_STATUS_LABELS, FREIGHT_STATUS_COLORS } from '../utils/constants';
import { useFreights, useAllFreights } from '../hooks/useFreights';
import { FreightCard } from '../components/FreightCard';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';
import { formatCurrency, formatLocation } from '../utils/helpers';
import { supabase } from '../lib/supabase';
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

type StatusFilter = 'all' | 'active' | 'scheduled' | 'inactive';

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

function buildShareMessage(freight: Freight): string {
  const origin = formatLocation(freight.origin);
  const dest = formatLocation(freight.destination);
  const price = formatCurrency(freight.price);
  return `🚚 *Frete disponível no MooveFretes*\n\n📦 ${origin} → ${dest}\n${freight.cargo_type ? freight.cargo_type + '\n' : ''}💰 ${price}\n\nVeja no MooveFretes:\nhttps://moovefretes.com.br`;
}

export function FreightsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const route = useRoute<any>();

  // Shared states
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('all');

  // All-freights filter states
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<FilterState>(DEFAULT_FILTERS);

  // Mine-tab specific states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [actionsFreight, setActionsFreight] = useState<Freight | null>(null);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    const originCity = route.params?.originCity;
    if (originCity) setFilters(prev => ({ ...prev, originCity }));
  }, [route.params?.originCity]);

  const mineQuery = useFreights(user?.id ?? null);
  const allQuery = useAllFreights();

  const activeQuery = activeTab === 'mine' ? mineQuery : allQuery;
  const { data, isLoading: loading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, isRefetching, error: queryError } = activeQuery;

  const allItems: Freight[] = data?.pages.flatMap(p => p.items) ?? [];

  // ── Mine-tab data ──────────────────────────────────────────────
  const mineData = useMemo(() => {
    const active   = allItems.filter(f => f.status === 'active');
    const scheduled = allItems.filter(f => f.status === 'scheduled');
    const inactive  = allItems.filter(f => f.status === 'inactive' || f.status === 'draft' || f.status === 'cancelled');
    const completed = allItems.filter(f => f.status === 'completed' || f.status === 'contracted' || f.status === 'in-transit');
    const filtered  = allItems.filter(f => {
      const isCompleted = f.status === 'completed' || f.status === 'contracted' || f.status === 'in-transit';
      if (isCompleted) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active')   return f.status === 'active';
      if (statusFilter === 'scheduled') return f.status === 'scheduled';
      if (statusFilter === 'inactive')  return f.status === 'inactive' || f.status === 'draft' || f.status === 'cancelled';
      return true;
    });
    return { active, scheduled, inactive, completed, filtered };
  }, [allItems, statusFilter]);

  // ── All-tab data (filtered) ─────────────────────────────────────
  const filteredAll = useMemo(() => allItems.filter((f: Freight) => {
    if (filters.originCity.trim() && !f.origin?.city?.toLowerCase().includes(filters.originCity.toLowerCase())) return false;
    if (filters.destinationCity.trim() && !f.destination?.city?.toLowerCase().includes(filters.destinationCity.toLowerCase())) return false;
    if (filters.vehicleTypes.length > 0) {
      const all = [...(f.selectedLightVehicles || []), ...(f.selectedMediumVehicles || []), ...(f.selectedHeavyVehicles || []), ...(f.vehicle_types || [])];
      if (!filters.vehicleTypes.some(v => all.some(a => a.toLowerCase().includes(v.toLowerCase())))) return false;
    }
    if (filters.bodyTypes.length > 0) {
      const all = [...(f.selectedClosedTrailers || []), ...(f.selectedOpenTrailers || []), ...(f.selectedSpecialTrailers || []), ...(f.body_types || [])];
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
  }), [allItems, filters]);

  const activeFilterCount = countActiveFilters(filters);

  // ── Mutations ───────────────────────────────────────────────────
  async function handleToggleStatus(freight: Freight) {
    const isActive = freight.status === 'active' || freight.status === 'scheduled';
    const newStatus = isActive ? 'inactive' : 'active';
    const label = isActive ? 'Desativar' : 'Reativar';
    Alert.alert(
      `${label} Frete`,
      `Deseja ${label.toLowerCase()} este frete?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            setMutating(true);
            try {
              await supabase.from('freights').update({ status: newStatus }).eq('id', freight.id);
              await mineQuery.refetch();
            } catch {
              Alert.alert('Erro', 'Não foi possível atualizar o frete.');
            } finally {
              setMutating(false);
            }
          },
        },
      ]
    );
  }

  async function handleCompleteFreight(freight: Freight) {
    Alert.alert(
      'Concluir Frete',
      'Deseja marcar este frete como concluído?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          onPress: async () => {
            setMutating(true);
            try {
              await supabase.from('freights').update({ status: 'completed' }).eq('id', freight.id);
              await mineQuery.refetch();
            } catch {
              Alert.alert('Erro', 'Não foi possível concluir o frete.');
            } finally {
              setMutating(false);
            }
          },
        },
      ]
    );
  }

  async function handleDeleteFreight(freight: Freight) {
    Alert.alert(
      'Excluir Frete',
      'Esta ação não pode ser desfeita. Deseja excluir este frete?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setMutating(true);
            try {
              await supabase.from('freights').delete().eq('id', freight.id);
              await mineQuery.refetch();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir o frete.');
            } finally {
              setMutating(false);
            }
          },
        },
      ]
    );
  }

  function handleShareWhatsApp(freight: Freight) {
    const msg = buildShareMessage(freight);
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  }

  function openAction(freight: Freight) { setActionsFreight(freight); }
  function closeAction() { setActionsFreight(null); }

  async function handleRefresh() { await refetch(); }
  function openFilter() { setPending(filters); setShowFilter(true); }
  function applyFilters() { setFilters(pending); setShowFilter(false); }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Fretes</Text>
          <Text style={styles.subtitle}>Gerencie e encontre fretes</Text>
        </View>
        {activeTab === 'all' && (
          <TouchableOpacity style={styles.filterBtn} onPress={openFilter}>
            <Ionicons name="options-outline" size={20} color="#fff" />
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Todos os Fretes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>Meus Fretes</Text>
        </TouchableOpacity>
      </View>

      {/* ── ALL FREIGHTS TAB ── */}
      {activeTab === 'all' && (
        <>
          <AppliedFiltersBar
            filters={filters}
            onRemove={(key, val) => {
              if (key === 'vehicleTypes' || key === 'bodyTypes') {
                setFilters(prev => ({ ...prev, [key]: (prev[key] as string[]).filter(v => v !== val) }));
              } else if (key === 'hasTracker' || key === 'hasPrice' || key === 'occupancy') {
                setFilters(prev => ({ ...prev, [key]: 'ambos' }));
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
              data={filteredAll}
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
              ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color={COLORS.primary} style={{ paddingVertical: 16 }} /> : null}
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
                      {activeFilterCount > 0 ? 'Tente ajustar os filtros.' : 'Verifique mais tarde.'}
                    </Text>
                  </View>
                )
              }
            />
          )}
        </>
      )}

      {/* ── MY FREIGHTS TAB ── */}
      {activeTab === 'mine' && (
        <View style={styles.flex}>
          {/* Status filter chips */}
          <View style={styles.statusBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroll}>
              {([
                ['all',       'Todos',          null],
                ['active',    'Ativos',         mineData.active.length],
                ['scheduled', 'Agendados',      mineData.scheduled.length],
                ['inactive',  'Desativados',    mineData.inactive.length],
              ] as [StatusFilter, string, number | null][]).map(([key, label, count]) => {
                const active = statusFilter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                    onPress={() => setStatusFilter(key)}
                  >
                    <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                      {label}{count !== null ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={mineData.filtered}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
              renderItem={({ item }) => (
                <MyFreightCard
                  freight={item}
                  onPress={() => navigation.navigate('FreightDetail', { freight: item })}
                  onAction={() => openAction(item)}
                />
              )}
              ListFooterComponent={
                mineData.completed.length > 0 ? (
                  <CompletedSection
                    freights={mineData.completed}
                    expanded={showCompleted}
                    onToggle={() => setShowCompleted(v => !v)}
                    onPress={f => navigation.navigate('FreightDetail', { freight: f })}
                  />
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyTitle}>
                    {statusFilter === 'all' ? 'Você ainda não tem fretes' : 'Nenhum frete neste status'}
                  </Text>
                  <Text style={styles.emptyDesc}>
                    {statusFilter === 'all' ? 'Crie seu primeiro frete.' : 'Altere o filtro de status acima.'}
                  </Text>
                  {statusFilter === 'all' && (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate('CreateFreight')}>
                      <Text style={styles.retryText}>Criar Frete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}

        </View>
      )}

      {/* FAB — visível em ambas as abas */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom - 4 }]}
        onPress={() => navigation.navigate('CreateFreight')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── ACTION SHEET MODAL ── */}
      <Modal visible={!!actionsFreight} animationType="slide" transparent onRequestClose={closeAction}>
        <View style={styles.actionOverlay}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeAction} />
          <View style={[styles.actionSheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.handle} />
          {actionsFreight && (
            <>
              <View style={styles.actionHeader}>
                <View style={styles.actionRouteDot} />
                <Text style={styles.actionTitle} numberOfLines={1}>
                  {formatLocation(actionsFreight.origin)} → {formatLocation(actionsFreight.destination)}
                </Text>
              </View>

              <ActionItem
                icon="people-outline"
                iconColor={COLORS.primary}
                label="Motoristas Indicados"
                onPress={() => {
                  closeAction();
                  navigation.navigate('DriversTab', {
                    screen: 'DriversList',
                    params: { originCity: actionsFreight.origin?.city },
                  });
                }}
              />
              <ActionItem
                icon="logo-whatsapp"
                iconColor="#25D366"
                label="Compartilhar no WhatsApp"
                onPress={() => { closeAction(); handleShareWhatsApp(actionsFreight); }}
              />
              <View style={styles.actionDivider} />
              <ActionItem
                icon={actionsFreight.status === 'inactive' || actionsFreight.status === 'draft' ? 'play-circle-outline' : 'pause-circle-outline'}
                iconColor={actionsFreight.status === 'inactive' || actionsFreight.status === 'draft' ? COLORS.success : COLORS.warning}
                label={actionsFreight.status === 'inactive' || actionsFreight.status === 'draft' ? 'Reativar frete' : 'Desativar frete'}
                onPress={() => { closeAction(); handleToggleStatus(actionsFreight); }}
              />
              {actionsFreight.status !== 'completed' && actionsFreight.status !== 'contracted' && (
                <ActionItem
                  icon="checkmark-circle-outline"
                  iconColor={COLORS.success}
                  label="Concluir frete"
                  onPress={() => { closeAction(); handleCompleteFreight(actionsFreight); }}
                />
              )}
              <View style={styles.actionDivider} />
              <ActionItem
                icon="trash-outline"
                iconColor={COLORS.danger}
                label="Excluir frete"
                labelColor={COLORS.danger}
                onPress={() => { closeAction(); handleDeleteFreight(actionsFreight); }}
              />
            </>
          )}
          </View>
        </View>
      </Modal>

      {/* ── ALL FREIGHTS FILTER MODAL ── */}
      <Modal visible={showFilter} animationType="slide" transparent onRequestClose={() => setShowFilter(false)}>
        <KeyboardAvoidingView style={styles.filterOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <FilterSection title="Origem">
                <CityAutocompleteInput placeholder="Cidade de origem" value={pending.originCity} onSelect={(city) => setPending(p => ({ ...p, originCity: city }))} />
              </FilterSection>
              <FilterSection title="Destino">
                <CityAutocompleteInput placeholder="Cidade de destino" value={pending.destinationCity} onSelect={(city) => setPending(p => ({ ...p, destinationCity: city }))} />
              </FilterSection>
              <FilterSection title="Tipo de Veículo">
                <Text style={styles.groupLabel}>Pesados</Text>
                <ChipGroup items={HEAVY_VEHICLES} selected={pending.vehicleTypes} onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))} />
                <Text style={styles.groupLabel}>Médios</Text>
                <ChipGroup items={MEDIUM_VEHICLES} selected={pending.vehicleTypes} onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))} />
                <Text style={styles.groupLabel}>Leves</Text>
                <ChipGroup items={LIGHT_VEHICLES} selected={pending.vehicleTypes} onToggle={v => setPending(p => ({ ...p, vehicleTypes: toggleItem(p.vehicleTypes, v) }))} />
              </FilterSection>
              <FilterSection title="Tipo de Carroceria">
                <Text style={styles.groupLabel}>Aberta</Text>
                <ChipGroup items={OPEN_TRAILERS} selected={pending.bodyTypes} onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))} />
                <Text style={styles.groupLabel}>Fechada</Text>
                <ChipGroup items={CLOSED_TRAILERS} selected={pending.bodyTypes} onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))} />
                <Text style={styles.groupLabel}>Especial</Text>
                <ChipGroup items={SPECIAL_TRAILERS} selected={pending.bodyTypes} onToggle={v => setPending(p => ({ ...p, bodyTypes: toggleItem(p.bodyTypes, v) }))} />
              </FilterSection>
              <FilterSection title="Rastreador">
                <View style={styles.radioRow}>
                  {(['ambos', 'sim', 'nao'] as const).map(opt => (
                    <RadioOpt key={opt} label={opt === 'ambos' ? 'Todos' : opt === 'sim' ? 'Exige' : 'Não exige'} selected={pending.hasTracker === opt} onPress={() => setPending(p => ({ ...p, hasTracker: opt }))} />
                  ))}
                </View>
              </FilterSection>
              <FilterSection title="Valor">
                <View style={styles.radioRow}>
                  {(['ambos', 'sim', 'nao'] as const).map(opt => (
                    <RadioOpt key={opt} label={opt === 'ambos' ? 'Todos' : opt === 'sim' ? 'Com valor' : 'A combinar'} selected={pending.hasPrice === opt} onPress={() => setPending(p => ({ ...p, hasPrice: opt }))} />
                  ))}
                </View>
              </FilterSection>
              <FilterSection title="Tipo de Carga" last>
                <View style={styles.radioRow}>
                  {(['ambos', 'completa', 'complemento'] as const).map(opt => (
                    <RadioOpt key={opt} label={opt === 'ambos' ? 'Todos' : opt === 'completa' ? 'Completa' : 'Complemento'} selected={pending.occupancy === opt} onPress={() => setPending(p => ({ ...p, occupancy: opt }))} />
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

// ── MyFreightCard ──────────────────────────────────────────────────
function MyFreightCard({ freight, onPress, onAction }: {
  freight: Freight;
  onPress: () => void;
  onAction: () => void;
}) {
  const origin = formatLocation(freight.origin);
  const dest = formatLocation(freight.destination);
  const price = formatCurrency(freight.price);
  const statusLabel = FREIGHT_STATUS_LABELS[freight.status] || freight.status;
  const statusColor = FREIGHT_STATUS_COLORS[freight.status] || COLORS.textLight;

  const metaParts: string[] = [];
  if (freight.cargo_type) metaParts.push(freight.cargo_type);
  if (freight.vehicle_types?.length) metaParts.push(freight.vehicle_types[0]);

  const scheduledDate = freight.scheduled_date || freight.scheduledDate;

  return (
    <TouchableOpacity style={myCard.card} onPress={onPress} activeOpacity={0.85}>
      <View style={myCard.top}>
        {/* Route */}
        <View style={myCard.routeCol}>
          <View style={myCard.routeItem}>
            <View style={myCard.dotFilled} />
            <Text style={myCard.routeText} numberOfLines={1}>{origin}</Text>
          </View>
          <View style={myCard.connector} />
          <View style={myCard.routeItem}>
            <View style={myCard.dotHollow} />
            <Text style={myCard.routeText} numberOfLines={1}>{dest}</Text>
          </View>
        </View>

        {/* Right: price + action */}
        <View style={myCard.rightCol}>
          <TouchableOpacity style={myCard.moreBtn} onPress={onAction} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={myCard.price} numberOfLines={1}>{price}</Text>
        </View>
      </View>

      {/* Bottom row: meta + status badge */}
      <View style={myCard.bottom}>
        <View style={myCard.metaRow}>
          {metaParts.length > 0 && (
            <Text style={myCard.metaText} numberOfLines={1}>{metaParts.join('  •  ')}</Text>
          )}
          {freight.status === 'scheduled' && scheduledDate && (
            <View style={myCard.scheduledRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.info} />
              <Text style={myCard.scheduledText}>
                {new Date(scheduledDate).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}
          {freight.accepted_driver_name && (
            <View style={myCard.driverRow}>
              <Ionicons name="person-outline" size={12} color={COLORS.success} />
              <Text style={myCard.driverText} numberOfLines={1}>{freight.accepted_driver_name}</Text>
            </View>
          )}
        </View>
        <View style={[myCard.statusBadge, { backgroundColor: statusColor + '1A' }]}>
          <Text style={[myCard.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── CompletedSection ───────────────────────────────────────────────
function CompletedSection({ freights, expanded, onToggle, onPress }: {
  freights: Freight[];
  expanded: boolean;
  onToggle: () => void;
  onPress: (f: Freight) => void;
}) {
  return (
    <View style={completed.container}>
      <TouchableOpacity style={completed.toggle} onPress={onToggle} activeOpacity={0.85}>
        <View style={completed.toggleLeft}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={completed.toggleLabel}>Fretes Concluídos</Text>
          <Text style={completed.toggleCount}>({freights.length})</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {expanded && freights.map(f => (
        <TouchableOpacity key={f.id} style={completed.row} onPress={() => onPress(f)} activeOpacity={0.8}>
          <View style={completed.rowLeft}>
            <Text style={completed.rowRoute} numberOfLines={1}>
              {formatLocation(f.origin)} → {formatLocation(f.destination)}
            </Text>
            {f.cargo_type && <Text style={completed.rowMeta}>{f.cargo_type}</Text>}
          </View>
          <Text style={completed.rowPrice}>{formatCurrency(f.price)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── ActionItem ─────────────────────────────────────────────────────
function ActionItem({ icon, iconColor, label, labelColor, onPress }: {
  icon: any;
  iconColor: string;
  label: string;
  labelColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[styles.actionLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Sub-components ──────────────────────────────────────────────────
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
          <TouchableOpacity key={item} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggle(item)}>
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
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

function AppliedFiltersBar({ filters, onRemove, onClearAll }: {
  filters: FilterState;
  onRemove: (key: keyof FilterState, val?: string) => void;
  onClearAll: () => void;
}) {
  const active = useMemo(() => {
    const items: { key: keyof FilterState; label: string; val?: string }[] = [];
    if (filters.originCity.trim()) items.push({ key: 'originCity', label: `Origem: ${filters.originCity}` });
    if (filters.destinationCity.trim()) items.push({ key: 'destinationCity', label: `Destino: ${filters.destinationCity}` });
    filters.vehicleTypes.forEach(v => items.push({ key: 'vehicleTypes', val: v, label: v }));
    filters.bodyTypes.forEach(b => items.push({ key: 'bodyTypes', val: b, label: b }));
    if (filters.hasTracker !== 'ambos') items.push({ key: 'hasTracker', label: filters.hasTracker === 'sim' ? 'Com rastreador' : 'Sem rastreador' });
    if (filters.hasPrice !== 'ambos') items.push({ key: 'hasPrice', label: filters.hasPrice === 'sim' ? 'Com valor' : 'A combinar' });
    if (filters.occupancy !== 'ambos') items.push({ key: 'occupancy', label: filters.occupancy === 'completa' ? 'Carga Completa' : 'Complemento' });
    return items;
  }, [filters]);

  if (active.length === 0) return null;

  return (
    <View style={styles.appliedFiltersBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appliedFiltersScroll}>
        {active.length > 1 && (
          <TouchableOpacity style={[styles.appliedFilterChip, { backgroundColor: COLORS.danger + '12', borderColor: COLORS.danger + '30' }]} onPress={onClearAll}>
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

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
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
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  statusBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  statusScroll: { paddingHorizontal: 16, gap: 8 },
  statusChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  statusChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  statusChipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  retryBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  // Action sheet
  actionOverlay: { flex: 1, justifyContent: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  actionSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 8,
  },
  actionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  actionRouteDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  actionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  actionLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  actionDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
  // Filter modal
  filterOverlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
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
  groupLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
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
  radioDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.border },
  radioDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500', flex: 1 },
  radioLabelActive: { color: COLORS.primary, fontWeight: '600' },
  applyBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 14,
    height: 50, alignItems: 'center', justifyContent: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  appliedFiltersBar: {
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10,
  },
  appliedFiltersScroll: { paddingHorizontal: 16, gap: 8 },
  appliedFilterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary + '12', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '30', gap: 6,
  },
  appliedFilterLabel: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});

const myCard = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeCol: { flex: 1, gap: 4 },
  routeItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotFilled: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, flexShrink: 0 },
  dotHollow: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: COLORS.primary, flexShrink: 0 },
  connector: { width: 1, height: 8, backgroundColor: COLORS.border, marginLeft: 4 },
  routeText: { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 1 },
  rightCol: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  moreBtn: { padding: 2 },
  bottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 10, gap: 8,
  },
  metaRow: { flex: 1, gap: 3 },
  metaText: { fontSize: 11, color: COLORS.textSecondary },
  scheduledRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduledText: { fontSize: 11, color: COLORS.info, fontWeight: '500' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverText: { fontSize: 11, color: COLORS.success, fontWeight: '500', flex: 1 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
});

const completed = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 24 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleCount: { fontSize: 13, color: COLORS.textSecondary },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: 6, opacity: 0.75,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowRoute: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  rowMeta: { fontSize: 11, color: COLORS.textSecondary },
  rowPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flexShrink: 0 },
});
