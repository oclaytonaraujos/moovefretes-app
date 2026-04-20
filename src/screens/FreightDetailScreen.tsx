import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../utils/constants';
import { StatusBadge } from '../components/StatusBadge';
import { CachedAvatar } from '../components/CachedAvatar';
import { formatLocation, formatDistance, getTimeAgo } from '../utils/helpers';
import { FreightPaymentCard } from '../components/freight-detail/FreightPaymentCard';
import { FreightVehicleCard } from '../components/freight-detail/FreightVehicleCard';
import { FreightCargoCard } from '../components/freight-detail/FreightCargoCard';
import { FreightContactsCard } from '../components/freight-detail/FreightContactsCard';
import { FreightDimensionsCard } from '../components/freight-detail/FreightDimensionsCard';
import type { Freight } from '../types';

function generateFreightCode(id: string): string {
  const chars = id.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const letters = chars.replace(/[0-9]/g, '');
  const numbers = chars.replace(/[A-Z]/g, '');
  return `#${letters[0]||'A'}${letters[1]||'B'}${letters[2]||'C'}${numbers[0]||'1'}${letters[3]||'D'}${numbers[1]||'2'}${numbers[2]||'3'}`;
}

export function FreightDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const freight: Freight = route.params?.freight;

  if (!freight) return null;

  const freightCode = freight.freight_code || generateFreightCode(freight.id);

  function handleWhatsApp() {
    Vibration.vibrate(40);
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const msg = encodeURIComponent(
      `*Olá, tenho interesse no frete ${freightCode}.*\n\n📦 *Frete ${freightCode}:*\n${origin} → ${dest}\nProduto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\n*A carga ainda está disponível?* 🚚`
    );
    let phone = (freight.publisher_phone || '').replace(/\D/g, '');
    if (phone.length <= 11) phone = `55${phone}`;
    Linking.openURL(`https://wa.me/${phone || ''}?text=${msg}`);
  }

  function handleShareWhatsApp() {
    Vibration.vibrate(40);
    const msg = encodeURIComponent(
      `🚚 *Frete ${freightCode} disponível*\n\n📦 ${formatLocation(freight.origin)} → ${formatLocation(freight.destination)}\n\n🏢 Empresa: ${freight.company_name || 'Empresa'}`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`);
  }

  function handleOpenMaps() {
    const { city, state } = freight.destination;
    Linking.openURL(`https://maps.google.com/?q=${city},${state},Brasil`);
  }

  function handleChat() {
    Vibration.vibrate(40);
    navigation.navigate('ChatTab', {
      screen: 'Chat',
      params: {
        userId: freight.company_id,
        userName: freight.company_name || 'Embarcador',
        source: 'freight',
        sourceId: freight.id,
        originCity: freight.origin?.city,
        originState: freight.origin?.state,
        destinationCity: freight.destination?.city,
        destinationState: freight.destination?.state,
        initialMessage: `Olá, tenho interesse no frete ${freightCode}.\n\n📦 ${formatLocation(freight.origin)} → ${formatLocation(freight.destination)}\nProduto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\nA carga ainda está disponível? 🚚`,
      },
    });
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode} numberOfLines={1}>{freightCode}</Text>
          <StatusBadge type="freight" status={freight.status} size="sm" />
        </View>
        <TouchableOpacity onPress={handleShareWhatsApp} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Publisher */}
        <View style={styles.publisherRow}>
          <CachedAvatar uri={freight.company_logo} name={freight.company_name} size={48} borderRadius={12} />
          <View style={styles.publisherInfo}>
            {!!freight.company_name && (
              <>
                <Text style={styles.publisherLabel}>Publicado por</Text>
                <Text style={styles.publisherName}>{freight.company_name}</Text>
              </>
            )}
            <Text style={styles.publisherDate}>
              {new Date(freight.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconWrap}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Origem (Coleta)</Text>
              <Text style={styles.routeCity}>{formatLocation(freight.origin)}</Text>
              {!!freight.pickupDate && (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.dateText}>Data: {new Date(freight.pickupDate).toLocaleDateString('pt-BR')}</Text>
                </View>
              )}
            </View>
            {!!freight.distance_km && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>{formatDistance(freight.distance_km)}</Text>
              </View>
            )}
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeIconWrap, { backgroundColor: COLORS.danger + '15' }]}>
              <Ionicons name="navigate" size={20} color={COLORS.danger} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Destino (Entrega)</Text>
              <Text style={styles.routeCity}>{formatLocation(freight.destination)}</Text>
              {!!(freight.deliveryDate || freight.deadline_date) && (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.dateText}>
                    {freight.deliveryDate ? 'Data' : 'Prazo'}: {new Date(freight.deliveryDate || freight.deadline_date || '').toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.mapsBtn} onPress={handleOpenMaps}>
              <Ionicons name="navigate" size={14} color={COLORS.primary} />
              <Text style={styles.mapsBtnText}>Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FreightPaymentCard freight={freight} />
        <FreightVehicleCard freight={freight} />
        <FreightCargoCard freight={freight} />

        {!!freight.observations && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Observações sobre a Carga</Text>
            </View>
            <Text style={styles.observationsText}>{freight.observations}</Text>
          </View>
        )}

        <FreightContactsCard freight={freight} freightCode={freightCode} />
        <FreightDimensionsCard freight={freight} />

        <Text style={styles.timeAgo}>Publicado {getTimeAgo(freight.created_at)}</Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={15} color={COLORS.primary} />
          <Text style={styles.chatBtnText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={15} color="#fff" />
          <Text style={styles.whatsappBtnText}>Enviar Mensagem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  headerCode: { fontSize: 17, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  publisherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  publisherInfo: { flex: 1, gap: 2 },
  publisherLabel: { fontSize: 11, color: COLORS.textSecondary },
  publisherName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  publisherDate: { fontSize: 12, color: COLORS.textLight },
  routeCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  routeCity: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  routeDivider: { width: 2, height: 24, backgroundColor: COLORS.border, marginLeft: 19, marginVertical: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dateText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  distanceBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  distanceText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  mapsBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  observationsText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  timeAgo: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  bottomBar: {
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    flex: 1, height: 38, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 2, height: 38, borderRadius: 10, backgroundColor: '#25D366',
  },
  whatsappBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
