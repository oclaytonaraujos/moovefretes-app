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
import { getSupabaseAvatarUrl, formatPhone } from '../utils/helpers';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshCompany } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);

  const company = user?.company;
  const profile = user?.profile;
  const avatarUrl = getSupabaseAvatarUrl(profile?.avatar_url || company?.logo);

  async function handleSignOut() {
    Alert.alert('Sair', 'Tem certeza que deseja sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.title}>Meu Perfil</Text>
          <Text style={styles.subtitle}>Gerencie os dados da empresa</Text>
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
                <Ionicons name="business" size={36} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{company?.company_name || profile?.name || 'Transportadora'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              {!!company?.verified && (
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                   <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                   <Text style={{ fontSize: 12, color: COLORS.success, fontWeight: '600' }}>Verificada</Text>
                 </View>
              )}
            </View>
          </View>
        </View>

        {/* Company Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Dados da Empresa</Text>
          </View>
          <View style={styles.infoGrid}>
            <InfoRow label="Razão Social" value={company?.company_name || '-'} />
            <InfoRow label="CNPJ" value={company?.cnpj || '-'} />
            <InfoRow label="Tipo" value={company?.company_type === 'agenciador' ? 'Agenciador' : company?.company_type === 'embarcador' ? 'Embarcador' : 'Transportadora'} />
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Contato</Text>
          </View>
          {!!company?.phone && <InfoRow label="Telefone" value={formatPhone(company.phone)} />}
          <InfoRow label="E-mail" value={company?.email || user?.email || '-'} />
          {!!(company?.address?.city && company?.address?.state) && (
             <InfoRow label="Sede" value={`${company.address.city} - ${company.address.state}`} />
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

        <Text style={styles.version}>MooveFretes Transportadora v1.0.0</Text>
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        company={company}
        profile={profile}
        userId={user?.id || ''}
        onClose={() => setShowEditModal(false)}
        onSaved={() => { setShowEditModal(false); refreshCompany(); }}
      />
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

function SettingItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={settingStyles.item} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={COLORS.textSecondary} />
      <Text style={settingStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

function EditProfileModal({ visible, company, profile, userId, onClose, onSaved }: any) {
  const [name, setName] = useState(company?.company_name || profile?.name || '');
  const [phone, setPhone] = useState(company?.phone || profile?.phone || '');
  const [city, setCity] = useState(company?.address?.city || profile?.city || '');
  const [state, setState] = useState(company?.address?.state || profile?.state || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      supabase.from('profiles').update({ name, phone, city, state }).eq('id', userId),
      supabase.from('companies').update({ company_name: name, phone, address: { city, state } }).eq('user_id', userId),
    ]);
    setSaving(false);
    onSaved();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={editStyles.container}>
        <View style={editStyles.handle} />
        <Text style={editStyles.title}>Editar Dados da Empresa</Text>
        <Text style={editStyles.label}>Razão Social / Nome</Text>
        <TextInput
          style={editStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nome da Empresa"
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
        <Text style={editStyles.label}>Cidade</Text>
        <TextInput
          style={editStyles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Cidade"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={editStyles.label}>Estado (UF)</Text>
        <TextInput
          style={editStyles.input}
          value={state}
          onChangeText={setState}
          placeholder="SP"
          maxLength={2}
          autoCapitalize="characters"
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
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoGrid: { gap: 2 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.danger + '40',
    backgroundColor: COLORS.danger + '08',
  },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textLight },
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
