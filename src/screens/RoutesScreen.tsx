import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, BRAZILIAN_STATES } from '../utils/constants';
import { formatRoute, getTimeAgo } from '../utils/helpers';
import type { PreferredRoute } from '../types';

export function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [routes, setRoutes] = useState<PreferredRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const loadRoutes = useCallback(async () => {
    if (!user?.driver) return;
    const { data } = await supabase
      .from('preferred_routes')
      .select('*')
      .eq('driver_id', user.driver.id)
      .order('created_at', { ascending: false });
    setRoutes(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadRoutes();
    setRefreshing(false);
  }

  async function handleToggleActive(route: PreferredRoute) {
    await supabase
      .from('preferred_routes')
      .update({ is_active: !route.is_active })
      .eq('id', route.id);
    setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, is_active: !r.is_active } : r));
  }

  async function handleDelete(routeId: string) {
    Alert.alert('Excluir Rota', 'Tem certeza que deseja excluir esta rota?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('preferred_routes').delete().eq('id', routeId);
          setRoutes(prev => prev.filter(r => r.id !== routeId));
        },
      },
    ]);
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Minhas Rotas</Text>
          <Text style={styles.subtitle}>Rotas onde você prefere trabalhar</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              onToggle={() => handleToggleActive(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="map-outline" size={52} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Nenhuma rota cadastrada</Text>
              <Text style={styles.emptyDesc}>
                Adicione suas rotas preferidas para aparecer nas buscas dos embarcadores.
              </Text>
              <TouchableOpacity style={styles.addEmptyBtn} onPress={() => setShowAdd(true)}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addEmptyBtnText}>Adicionar Rota</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <AddRouteModal
        visible={showAdd}
        driverId={user?.driver?.id || ''}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); loadRoutes(); }}
      />
    </View>
  );
}

function RouteCard({ route, onToggle, onDelete }: {
  route: PreferredRoute;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const priorityColors = { high: COLORS.danger, medium: COLORS.warning, low: COLORS.textSecondary };
  const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  const pColor = priorityColors[route.priority] || COLORS.textSecondary;
  const pLabel = priorityLabels[route.priority] || route.priority;

  return (
    <View style={[cardStyles.card, !route.is_active && cardStyles.inactive]}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.priorityBadge, { backgroundColor: pColor + '20', borderColor: pColor }]}>
          <Text style={[cardStyles.priorityText, { color: pColor }]}>Prioridade {pLabel}</Text>
        </View>
        <View style={cardStyles.actions}>
          <TouchableOpacity onPress={onToggle} style={cardStyles.actionBtn}>
            <Ionicons
              name={route.is_active ? 'toggle' : 'toggle-outline'}
              size={26}
              color={route.is_active ? COLORS.available : COLORS.textLight}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={cardStyles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={cardStyles.route}>{formatRoute(route.origin, route.destination)}</Text>
      <View style={cardStyles.stats}>
        {route.views_count !== undefined && (
          <View style={cardStyles.stat}>
            <Ionicons name="eye-outline" size={13} color={COLORS.textSecondary} />
            <Text style={cardStyles.statText}>{route.views_count} visualizações</Text>
          </View>
        )}
        {route.contacts_count !== undefined && (
          <View style={cardStyles.stat}>
            <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
            <Text style={cardStyles.statText}>{route.contacts_count} contatos</Text>
          </View>
        )}
        {route.minimum_value && (
          <View style={cardStyles.stat}>
            <Ionicons name="cash-outline" size={13} color={COLORS.textSecondary} />
            <Text style={cardStyles.statText}>Mín. R$ {route.minimum_value}</Text>
          </View>
        )}
      </View>
      {!route.is_active && (
        <View style={cardStyles.inactiveBanner}>
          <Text style={cardStyles.inactiveText}>Rota pausada</Text>
        </View>
      )}
    </View>
  );
}

function AddRouteModal({ visible, driverId, onClose, onSaved }: {
  visible: boolean; driverId: string; onClose: () => void; onSaved: () => void;
}) {
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [minValue, setMinValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!originCity.trim() || !originState.trim() || !destCity.trim() || !destState.trim()) {
      Alert.alert('Atenção', 'Preencha origem e destino completos.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('preferred_routes').insert({
      driver_id: driverId,
      origin: { city: originCity.trim(), state: originState.trim().toUpperCase() },
      destination: { city: destCity.trim(), state: destState.trim().toUpperCase() },
      priority,
      is_active: true,
      minimum_value: minValue ? Number(minValue) : null,
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível salvar a rota.');
    } else {
      setOriginCity(''); setOriginState(''); setDestCity(''); setDestState('');
      setMinValue(''); setPriority('medium');
      onSaved();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Nova Rota Preferida</Text>

        <Text style={modalStyles.sectionLabel}>Origem</Text>
        <View style={modalStyles.row}>
          <TextInput
            style={[modalStyles.input, { flex: 2 }]}
            placeholder="Cidade"
            value={originCity}
            onChangeText={setOriginCity}
            placeholderTextColor={COLORS.textLight}
          />
          <TextInput
            style={[modalStyles.input, { flex: 1 }]}
            placeholder="UF"
            value={originState}
            onChangeText={t => setOriginState(t.toUpperCase())}
            maxLength={2}
            autoCapitalize="characters"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={modalStyles.sectionLabel}>Destino</Text>
        <View style={modalStyles.row}>
          <TextInput
            style={[modalStyles.input, { flex: 2 }]}
            placeholder="Cidade"
            value={destCity}
            onChangeText={setDestCity}
            placeholderTextColor={COLORS.textLight}
          />
          <TextInput
            style={[modalStyles.input, { flex: 1 }]}
            placeholder="UF"
            value={destState}
            onChangeText={t => setDestState(t.toUpperCase())}
            maxLength={2}
            autoCapitalize="characters"
            placeholderTextColor={COLORS.textLight}
          />
        </View>

        <Text style={modalStyles.sectionLabel}>Prioridade</Text>
        <View style={modalStyles.priorityRow}>
          {(['high', 'medium', 'low'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[modalStyles.priorityBtn, priority === p && modalStyles.priorityBtnActive]}
              onPress={() => setPriority(p)}
            >
              <Text style={[modalStyles.priorityBtnText, priority === p && modalStyles.priorityBtnTextActive]}>
                {p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={modalStyles.sectionLabel}>Valor Mínimo (opcional)</Text>
        <TextInput
          style={modalStyles.input}
          placeholder="R$ 0,00"
          value={minValue}
          onChangeText={setMinValue}
          keyboardType="numeric"
          placeholderTextColor={COLORS.textLight}
        />

        <View style={modalStyles.btnRow}>
          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
            <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.saveBtnText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: 16, gap: 0, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyDesc: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  addEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  addEmptyBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  inactive: { opacity: 0.6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priorityBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 100, borderWidth: 1,
  },
  priorityText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  route: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  stats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.textSecondary },
  inactiveBanner: {
    backgroundColor: COLORS.textLight + '20',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start',
  },
  inactiveText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 10, backgroundColor: COLORS.surface },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: COLORS.text,
  },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, height: 40, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  priorityBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  priorityBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  priorityBtnTextActive: { color: '#fff' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: {
    flex: 2, height: 50, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
