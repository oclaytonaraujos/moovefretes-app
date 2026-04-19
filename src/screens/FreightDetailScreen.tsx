import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  Share, Alert, Clipboard, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../utils/constants';
import { StatusBadge } from '../components/StatusBadge';
import { CachedAvatar } from '../components/CachedAvatar';
import { formatLocation, formatCurrency, formatWeight, formatDistance, getTimeAgo } from '../utils/helpers';
import type { Freight } from '../types';

// Gerar código de frete no padrão placa brasileira
function generateFreightCode(id: string): string {
  const chars = id.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const letters = chars.replace(/[0-9]/g, '');
  const numbers = chars.replace(/[A-Z]/g, '');
  const l1 = letters[0] || 'A';
  const l2 = letters[1] || 'B';
  const l3 = letters[2] || 'C';
  const n1 = numbers[0] || '1';
  const l4 = letters[3] || 'D';
  const n2 = numbers[1] || '2';
  const n3 = numbers[2] || '3';
  return `#${l1}${l2}${l3}${n1}${l4}${n2}${n3}`;
}

function getUrgencyText(urgency?: string) {
  switch (urgency) {
    case 'urgent': return 'Urgente';
    case 'scheduled': return 'Agendado';
    default: return 'Normal';
  }
}

function getPaymentIncludedLabel(item: string) {
  switch (item) {
    case 'fuel': return 'Combustível';
    case 'tolls': return 'Pedágios';
    case 'taxes': return 'Impostos';
    case 'insurance': return 'Seguro';
    default: return item;
  }
}

export function FreightDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const freight: Freight = route.params?.freight;

  if (!freight) return null;

  const freightCode = freight.freight_code || generateFreightCode(freight.id);

  // WhatsApp - Enviar interesse no frete
  function handleWhatsApp() {
    Vibration.vibrate(40);
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const msg = encodeURIComponent(
      `*Olá, tenho interesse no frete ${freightCode}.*\n\n📦 *Frete ${freightCode}:*\n${origin} → ${dest}\nProduto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\n*A carga ainda está disponível?* 🚚`
    );
    
    let phone = (freight.publisher_phone || '').replace(/\D/g, '');
    if (phone) {
      // Garantir código do país (55 para Brasil)
      if (phone.length <= 11) phone = `55${phone}`;
      const url = `https://wa.me/${phone}?text=${msg}`;
      Linking.openURL(url);
    } else {
      // Fallback para compartilhamento se não houver telefone
      const url = `https://wa.me/?text=${msg}`;
      Linking.openURL(url);
    }
  }

  // Compartilhar frete via WhatsApp
  function handleShareWhatsApp() {
    Vibration.vibrate(40);
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const msg = encodeURIComponent(
      `🚚 *Frete ${freightCode} disponível*\n\n📦 ${origin} → ${dest}\n\n🏢 Empresa: ${freight.company_name || 'Empresa'}`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`);
  }

  // Abrir mapa
  function handleOpenMaps() {
    const { city, state } = freight.destination;
    Linking.openURL(`https://maps.google.com/?q=${city},${state},Brasil`);
  }

  // Chat
  function handleChat() {
    Vibration.vibrate(40);
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const initialMessage =
      `Olá, tenho interesse no frete ${freightCode}.\n\n` +
      `📦 Frete ${freightCode}:\n` +
      `${origin} → ${dest}\n` +
      `Produto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\n` +
      `A carga ainda está disponível? 🚚`;
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
        initialMessage,
      },
    });
  }

  // Copiar telefone
  function handleCopyPhone(phone: string) {
    Vibration.vibrate(40);
    Clipboard.setString(phone);
    Alert.alert('Copiado!', 'Número copiado para a área de transferência.');
  }

  // WhatsApp para contato responsável
  function handleContactWhatsApp(contactPhone: string) {
    Vibration.vibrate(50);
    let phone = contactPhone.replace(/\D/g, '');
    if (!phone) return;
    
    // Garantir código do país (55 para Brasil)
    if (phone.length <= 11) phone = `55${phone}`;
    
    const origin = formatLocation(freight.origin);
    const dest = formatLocation(freight.destination);
    const msg = encodeURIComponent(
      `*Olá, tenho interesse no frete ${freightCode}.*\n\n📦 *Frete ${freightCode}:*\n${origin} → ${dest}\nProduto: ${freight.product || freight.cargo_type || 'Não especificado'}\n\n*A carga ainda está disponível?* 🚚`
    );
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
  }

  // Dados de veículos e carrocerias
  const hasLightVehicles = freight.selectedLightVehicles && freight.selectedLightVehicles.length > 0;
  const hasMediumVehicles = freight.selectedMediumVehicles && freight.selectedMediumVehicles.length > 0;
  const hasHeavyVehicles = freight.selectedHeavyVehicles && freight.selectedHeavyVehicles.length > 0;
  const hasClosedTrailers = freight.selectedClosedTrailers && freight.selectedClosedTrailers.length > 0;
  const hasOpenTrailers = freight.selectedOpenTrailers && freight.selectedOpenTrailers.length > 0;
  const hasSpecialTrailers = freight.selectedSpecialTrailers && freight.selectedSpecialTrailers.length > 0;
  const hasVehicleData = freight.truckType || hasLightVehicles || hasMediumVehicles || hasHeavyVehicles;
  const hasTrailerData = hasClosedTrailers || hasOpenTrailers || hasSpecialTrailers;
  const hasRequirements = freight.needsCover || freight.needsTracker || freight.isInsured;
  const hasContacts = freight.responsibleContacts && freight.responsibleContacts.length > 0;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
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
        
        {/* Publisher Info */}
        <View style={styles.publisherRow}>
          <CachedAvatar
            uri={freight.company_logo}
            name={freight.company_name}
            size={48}
            borderRadius={12}
          />
          <View style={styles.publisherInfo}>
            {freight.company_name && (
              <>
                <Text style={styles.publisherLabel}>Publicado por</Text>
                <Text style={styles.publisherName}>{freight.company_name}</Text>
              </>
            )}
            <Text style={styles.publisherDate}>
              {new Date(freight.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Route Card */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconWrap}>
              <Ionicons name="location" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Origem (Coleta)</Text>
              <Text style={styles.routeCity}>{formatLocation(freight.origin)}</Text>
              {freight.pickupDate && (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.dateText}>
                    Data: {new Date(freight.pickupDate).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              )}
            </View>
            {freight.distance_km && (
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
              {(freight.deliveryDate || freight.deadline_date) && (
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

        {/* ========== 1. Valor e Pagamento ========== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Informações de Valor e Pagamento</Text>
          </View>

          {/* Valor do Frete */}
          <View style={styles.priceCard}>
            <Text style={styles.priceLabelWhite}>Valor do Frete</Text>
            <Text style={styles.priceValue}>{formatCurrency(freight.price)}</Text>
          </View>

          <View style={styles.infoGrid}>
            <InfoCell label="Tipo de Valor" value={
              freight.freightValueType
                ? (freight.freightValueType === 'known' ? 'Valor Informado' : 'A Negociar')
                : 'Não informado'
            } />
            <InfoCell label="Como Calcular o Frete" value={freight.valueCalculation || 'Não informado'} />
            <InfoCell label="Forma de Pagamento" value={freight.paymentMethod || 'Não informado'} />
            <InfoCell label="Pagamento Antecipado" value={freight.advancePayment || 'Não informado'} />
          </View>

          <View style={styles.infoCellFull}>
            <Text style={styles.infoCellLabel}>Incluído no Pagamento</Text>
            <Text style={styles.infoCellValue}>
              {freight.paymentIncluded && Array.isArray(freight.paymentIncluded) && freight.paymentIncluded.length > 0
                ? freight.paymentIncluded.map(getPaymentIncludedLabel).join(', ')
                : 'Pagamento Separado'}
            </Text>
          </View>
        </View>

        {/* ========== 2. Veículos e Carrocerias ========== */}
        {(hasVehicleData || hasTrailerData) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bus-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Tipos de Veículos e Carrocerias Aceitos</Text>
            </View>

            {freight.truckType && (
              <View style={styles.highlightBox}>
                <Text style={styles.highlightLabel}>Tipo de Veículo Principal</Text>
                <Text style={styles.highlightValue}>{freight.truckType}</Text>
              </View>
            )}

            {hasHeavyVehicles && (
              <VehicleSection title="Veículos Pesados Aceitos" items={freight.selectedHeavyVehicles!} />
            )}
            {hasMediumVehicles && (
              <VehicleSection title="Veículos Médios Aceitos" items={freight.selectedMediumVehicles!} />
            )}
            {hasLightVehicles && (
              <VehicleSection title="Veículos Leves Aceitos" items={freight.selectedLightVehicles!} />
            )}

            {(hasVehicleData && hasTrailerData) && <View style={styles.sectionDivider} />}

            <Text style={styles.trailerSectionLabel}>Carrocerias Aceitas</Text>
            {hasClosedTrailers && (
              <VehicleSection title="Carrocerias Fechadas Aceitas" items={freight.selectedClosedTrailers!} />
            )}
            {hasOpenTrailers && (
              <VehicleSection title="Carrocerias Abertas Aceitas" items={freight.selectedOpenTrailers!} />
            )}
            {hasSpecialTrailers && (
              <VehicleSection title="Carrocerias Especiais Aceitas" items={freight.selectedSpecialTrailers!} />
            )}
          </View>
        )}

        {/* ========== 3. Dados da Carga ========== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Dados da Carga</Text>
          </View>

          <View style={styles.infoGrid}>
            {freight.product && (
              <InfoCell label="Produto Transportado" value={freight.product} />
            )}
            {freight.species && (
              <InfoCell label="Espécie da Carga" value={freight.species} />
            )}
            <InfoCell label="Tipo de Carga" value={freight.cargo_type || 'Carga geral'} />
            {freight.occupancyType && (
              <InfoCell label="Ocupação do Veículo" value={freight.occupancyType === 'completa' ? 'Carga Completa' : 'Carga Complemento'} />
            )}
            {freight.weight != null && (
              <InfoCell label="Peso Total" value={formatWeight(freight.weight)} />
            )}
            {freight.volumes != null && (
              <InfoCell label="Volumes" value={`${freight.volumes} ${freight.volumeUnit || 'unidades'}`} />
            )}
            {freight.category && (
              <InfoCell label="Categoria" value={freight.category} />
            )}
            {freight.urgencyType && (
              <InfoCell
                label="Urgência"
                value={getUrgencyText(freight.urgencyType)}
                valueStyle={freight.urgencyType === 'urgent' ? { color: COLORS.danger, fontWeight: '700' as any } : undefined}
              />
            )}
            {freight.urgencyType === 'scheduled' && freight.scheduledDate && (
              <InfoCell label="Data Agendada" value={
                new Date(freight.scheduledDate).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'long', year: 'numeric'
                })
              } />
            )}
          </View>

          {/* Requisitos da Carga */}
          {hasRequirements && (
            <View style={styles.requirementsSection}>
              <Text style={styles.requirementsTitle}>Requisitos da Carga</Text>
              <View style={styles.badgeRow}>
                {freight.needsCover && <Badge label="Necessita Lona" />}
                {freight.needsTracker && <Badge label="Requer Rastreador" />}
                {freight.isInsured && <Badge label="Carga Segurada" />}
              </View>
            </View>
          )}

          {/* Carga Adicional */}
          {freight.hasAdditionalCargo && freight.additionalCargoDetails && (
            <View style={styles.requirementsSection}>
              <Text style={styles.requirementsTitle}>Carga Adicional</Text>
              <View style={styles.infoCell}>
                <Text style={styles.infoCellValue}>{freight.additionalCargoDetails}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ========== 4. Observações ========== */}
        {freight.observations && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Observações sobre a Carga</Text>
            </View>
            <Text style={styles.observationsText}>{freight.observations}</Text>
          </View>
        )}

        {/* ========== 5. Contatos Responsáveis ========== */}
        {hasContacts && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Contato responsável pelo frete</Text>
            </View>
            {freight.responsibleContacts!.map((contact, idx) => (
              <View
                key={contact.id || idx.toString()}
                style={[
                  styles.contactCard,
                  contact.isMainContact && styles.contactCardMain,
                ]}
              >
                <View style={styles.contactAvatar}>
                  <Ionicons name="person" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  {contact.phone && <Text style={styles.contactDetail}>{contact.phone}</Text>}
                  {contact.email && <Text style={styles.contactDetail}>{contact.email}</Text>}
                </View>
                {contact.phone && (
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={styles.contactActionBtn}
                      onPress={() => handleCopyPhone(contact.phone)}
                    >
                      <Ionicons name="copy-outline" size={16} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.contactActionBtn, { backgroundColor: '#25D366' + '15' }]}
                      onPress={() => handleContactWhatsApp(contact.phone)}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ========== 6. Dimensões e Medidas ========== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="resize-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Dimensões e Medidas</Text>
          </View>
          <View style={styles.infoGrid}>
            <InfoCell label="Comprimento" value={freight.length ? String(freight.length) : 'Não informado'} />
            <InfoCell label="Largura" value={freight.width ? String(freight.width) : 'Não informado'} />
            <InfoCell label="Altura" value={freight.height ? String(freight.height) : 'Não informado'} />
            <InfoCell label="Peso Cúbico" value={freight.cubicWeight ? String(freight.cubicWeight) : 'Não informado'} />
            <InfoCell label="Metros Cúbicos Totais" value={freight.totalCubicMeters ? String(freight.totalCubicMeters) : 'Não informado'} />
          </View>
        </View>



        <Text style={styles.timeAgo}>Publicado {getTimeAgo(freight.created_at)}</Text>
      </ScrollView>

      {/* Bottom CTA */}
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

/* ========== Sub-components ========== */

function InfoCell({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function VehicleSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.vehicleSection}>
      <Text style={styles.vehicleSectionTitle}>{title}</Text>
      <View style={styles.badgeRow}>
        {items.map((item, idx) => (
          <Badge key={idx} label={item} />
        ))}
      </View>
    </View>
  );
}

/* ========== Styles ========== */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 10,
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

  // Publisher
  publisherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  publisherInfo: { flex: 1, gap: 2 },
  publisherLabel: { fontSize: 11, color: COLORS.textSecondary },
  publisherName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  publisherDate: { fontSize: 12, color: COLORS.textLight },

  // Route Card
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
  routeDivider: {
    width: 2, height: 24, backgroundColor: COLORS.border,
    marginLeft: 19, marginVertical: 6,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dateText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  distanceBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  distanceText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  mapsBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // Cards
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },

  // Price Card
  priceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, padding: 16, marginBottom: 14,
  },
  priceLabelWhite: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#fff' },

  // Info Grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    minWidth: '45%', flex: 1,
  },
  infoCellFull: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    marginTop: 8, width: '100%',
  },
  infoCellLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  infoCellValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  // Highlight Box
  highlightBox: {
    backgroundColor: '#EBF0FF',
    borderWidth: 1, borderColor: COLORS.primary + '30',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  highlightLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  highlightValue: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },

  // Vehicle Sections
  vehicleSection: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    marginBottom: 8,
  },
  vehicleSectionTitle: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 8 },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  trailerSectionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  // Requirements
  requirementsSection: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  requirementsTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },

  // Observations
  observationsText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },

  // Contacts
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12,
    marginBottom: 8,
  },
  contactCardMain: {
    backgroundColor: '#EBF0FF',
    borderWidth: 1, borderColor: COLORS.primary + '25',
  },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  contactDetail: { fontSize: 12, color: COLORS.textSecondary },
  contactActions: { flexDirection: 'row', gap: 6 },
  contactActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Company
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companyName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },

  // Time Ago
  timeAgo: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginTop: 4 },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    flex: 1, height: 38, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 2, height: 38, borderRadius: 10,
    backgroundColor: '#25D366',
  },
  whatsappBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
