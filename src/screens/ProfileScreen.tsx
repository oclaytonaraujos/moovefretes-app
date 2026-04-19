import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { StatusBadge } from '../components/StatusBadge';
import { formatPhone, getSupabaseAvatarUrl, formatLocation } from '../utils/helpers';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshDriver } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const driver = user?.driver;
  const profile = user?.profile;
  const avatarUrl = getSupabaseAvatarUrl(profile?.avatar_url);

  async function handleSignOut() {
    Alert.alert('Sair', 'Tem certeza que deseja sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  const currentStatus = driver?.available ? 'available' : 'offline';

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Meu Perfil</Text>
          <Text style={styles.subtitle}>Gerencie seus dados</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowEditModal(true)}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={36} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name || driver?.name || 'Motorista'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <StatusBadge type="availability" status={currentStatus} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <ProfileStat
              icon="star"
              iconColor={COLORS.gold}
              value={(driver?.rating || 0).toFixed(1)}
              label="Avaliação"
            />
            <View style={styles.statDivider} />
            <ProfileStat
              icon="checkmark-circle"
              iconColor={COLORS.available}
              value={String(driver?.completed_trips || 0)}
              label="Viagens"
            />
            <View style={styles.statDivider} />
            <ProfileStat
              icon="people"
              iconColor={COLORS.primary}
              value={String(profile?.total_ratings || 0)}
              label="Avaliações"
            />
          </View>
        </View>

        {/* Vehicle Info */}
        {(driver?.vehicle_model || driver?.vehicle_type || driver?.vehicle_plate) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car-sport-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Veículo</Text>
            </View>
            <View style={styles.infoGrid}>
              {driver?.vehicle_type && <InfoRow label="Tipo" value={driver.vehicle_type} />}
              {driver?.vehicle_model && <InfoRow label="Modelo" value={driver.vehicle_model} />}
              {driver?.vehicle_plate && <InfoRow label="Placa" value={driver.vehicle_plate} />}
              {driver?.vehicle_year && <InfoRow label="Ano" value={driver.vehicle_year} />}
              {driver?.vehicle_capacity && <InfoRow label="Capacidade" value={`${driver.vehicle_capacity} kg`} />}
            </View>
            {driver?.vehicle_types && driver.vehicle_types.length > 0 && (
              <View style={styles.tagsRow}>
                {driver.vehicle_types.map(t => <Tag key={t} label={t} />)}
              </View>
            )}
          </View>
        )}

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Documentação</Text>
          </View>
          <View style={styles.infoGrid}>
            {driver?.cnh && <InfoRow label="CNH" value={driver.cnh} />}
            {driver?.cnh_category && <InfoRow label="Categoria" value={driver.cnh_category} />}
            {driver?.cnh_expiry && (
              <InfoRow label="Validade CNH" value={new Date(driver.cnh_expiry).toLocaleDateString('pt-BR')} />
            )}
            {driver?.rntrc && <InfoRow label="RNTRC" value={driver.rntrc} />}
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Contato</Text>
          </View>
          {driver?.phone && <InfoRow label="Telefone" value={formatPhone(driver.phone)} />}
          <InfoRow label="E-mail" value={user?.email || '-'} />
          {driver?.current_location && (
            <View style={styles.locationRow}>
              <View style={{ flex: 1 }}>
                <InfoRow label="Localização Atual" value={formatLocation(driver.current_location)} />
              </View>
              <TouchableOpacity style={styles.updateLocBtn} onPress={() => setShowLocationModal(true)}>
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.updateLocText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          <SettingItem icon="notifications-outline" label="Notificações" onPress={() => {}} />
          <SettingItem icon="shield-outline" label="Privacidade" onPress={() => {}} />
          <SettingItem icon="help-circle-outline" label="Ajuda e Suporte" onPress={() => {}} />
          <SettingItem icon="information-circle-outline" label="Sobre o App" onPress={() => {}} />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.signOutText}>Sair da Conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MooveFretes Motorista v1.0.0</Text>
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        driver={driver}
        profile={profile}
        userId={user?.id || ''}
        onClose={() => setShowEditModal(false)}
        onSaved={() => { setShowEditModal(false); refreshDriver(); }}
      />

      <UpdateLocationModal
        visible={showLocationModal}
        userId={user?.id || ''}
        onClose={() => setShowLocationModal(false)}
        onSaved={() => { setShowLocationModal(false); refreshDriver(); }}
      />
    </View>
  );
}

function ProfileStat({ icon, iconColor, value, label }: { icon: string; iconColor: string; value: string; label: string }) {
  return (
    <View style={pStatStyles.item}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={pStatStyles.value}>{value}</Text>
      <Text style={pStatStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={tagStyles.tag}>
      <Text style={tagStyles.label}>{label}</Text>
    </View>
  );
}

function SettingItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={settingStyles.item} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={COLORS.textSecondary} />
      <Text style={settingStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function EditProfileModal({ visible, driver, profile, userId, onClose, onSaved }: any) {
  const [name, setName] = useState(profile?.name || driver?.name || '');
  const [phone, setPhone] = useState(driver?.phone || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      supabase.from('profiles').update({ name }).eq('id', userId),
      supabase.from('drivers').update({ name, phone }).eq('user_id', userId),
    ]);
    setSaving(false);
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={editStyles.container}>
        <View style={editStyles.handle} />
        <Text style={editStyles.title}>Editar Perfil</Text>
        <Text style={editStyles.label}>Nome completo</Text>
        <TextInput
          style={editStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="Seu nome"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={editStyles.label}>Telefone</Text>
        <TextInput
          style={editStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.textLight}
        />
        <View style={editStyles.btnRow}>
          <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose}>
            <Text style={editStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={editStyles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={editStyles.saveText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function UpdateLocationModal({ visible, userId, onClose, onSaved }: any) {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!city.trim() || !state.trim()) return;
    setSaving(true);
    const location = { city: city.trim(), state: state.trim().toUpperCase(), lastUpdated: new Date().toISOString() };
    await supabase.from('drivers').update({ current_location: location }).eq('user_id', userId);
    setSaving(false);
    setCity(''); setState('');
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={editStyles.container}>
        <View style={editStyles.handle} />
        <Text style={editStyles.title}>Atualizar Localização</Text>
        <Text style={editStyles.label}>Cidade</Text>
        <TextInput style={editStyles.input} value={city} onChangeText={setCity} placeholder="Sua cidade atual" placeholderTextColor={COLORS.textLight} />
        <Text style={editStyles.label}>Estado (UF)</Text>
        <TextInput style={editStyles.input} value={state} onChangeText={t => setState(t.toUpperCase())} placeholder="SP" maxLength={2} autoCapitalize="characters" placeholderTextColor={COLORS.textLight} />
        <View style={editStyles.btnRow}>
          <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose}>
            <Text style={editStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={editStyles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={editStyles.saveText}>Atualizar</Text>}
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
    paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  editBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16, gap: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  profileTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    paddingTop: 16,
  },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.borderLight },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoGrid: { gap: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updateLocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary,
  },
  updateLocText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.danger + '40',
    backgroundColor: COLORS.danger + '08',
  },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textLight },
});

const pStatStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 11, color: COLORS.textSecondary },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right', flex: 1, marginLeft: 12 },
});

const tagStyles = StyleSheet.create({
  tag: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});

const settingStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  label: { flex: 1, fontSize: 14, color: COLORS.text },
});

const editStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 10, backgroundColor: COLORS.surface },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, height: 46, fontSize: 14, color: COLORS.text,
  },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: {
    flex: 2, height: 50, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
