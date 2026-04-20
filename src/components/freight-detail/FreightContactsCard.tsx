import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Clipboard, Vibration, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { formatLocation } from '../../utils/helpers';
import type { Freight } from '../../types';

interface Props {
  freight: Freight;
  freightCode: string;
}

export function FreightContactsCard({ freight, freightCode }: Props) {
  const contacts = freight.responsibleContacts;
  if (!contacts || contacts.length === 0) return null;

  function handleCopyPhone(phone: string) {
    Vibration.vibrate(40);
    Clipboard.setString(phone);
    Alert.alert('Copiado!', 'Número copiado para a área de transferência.');
  }

  function handleWhatsApp(contactPhone: string) {
    Vibration.vibrate(50);
    let phone = contactPhone.replace(/\D/g, '');
    if (!phone) return;
    if (phone.length <= 11) phone = `55${phone}`;
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const msg = encodeURIComponent(
      `*Olá, tenho interesse no frete ${freightCode}.*\n\n📦 *Frete ${freightCode}:*\n${origin} → ${dest}\nProduto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\n*A carga ainda está disponível?* 🚚`
    );
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
  }

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="call-outline" size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Contato responsável pelo frete</Text>
      </View>

      {contacts.map((contact, idx) => (
        <View
          key={contact.id || String(idx)}
          style={[styles.contactCard, contact.isMainContact && styles.contactCardMain]}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{contact.name}</Text>
            {!!contact.phone && <Text style={styles.detail}>{contact.phone}</Text>}
            {!!contact.email && <Text style={styles.detail}>{contact.email}</Text>}
          </View>
          {!!contact.phone && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopyPhone(contact.phone)}>
                <Ionicons name="copy-outline" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.whatsappBtn]} onPress={() => handleWhatsApp(contact.phone)}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  contactCardMain: { backgroundColor: '#EBF0FF', borderWidth: 1, borderColor: COLORS.primary + '25' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  detail: { fontSize: 12, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  whatsappBtn: { backgroundColor: '#25D36615' },
});
