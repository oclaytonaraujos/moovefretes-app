import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import { formatLocation, formatCurrency, getTimeAgo } from '../utils/helpers';
import { CachedAvatar } from './CachedAvatar';
import type { Freight } from '../types';

interface FreightCardProps {
  freight: Freight;
  onPress: () => void;
  showActions?: boolean;
}

function buildWhatsAppMessage(freight: Freight): string {
  const origin = formatLocation(freight.origin);
  const dest = formatLocation(freight.destination);
  const code = freight.title ? `${freight.title}` : '';
  const msg = `Olá! ${code ? `Interesse no frete ${code}` : 'Vi um frete no MooveFretes'}:\n${origin} → ${dest}\nA carga ainda está disponível?`;
  return encodeURIComponent(msg);
}

export function FreightCard({ freight, onPress, showActions }: FreightCardProps) {
  const meta: string[] = [];
  if (freight.cargo_type) meta.push(freight.cargo_type);
  if (freight.vehicle_types && freight.vehicle_types.length > 0) {
    meta.push(freight.vehicle_types.slice(0, 2).join(', '));
  }

  function handleWhatsApp(e: any) {
    e?.stopPropagation?.();
    const phone = (freight.publisher_phone || '').replace(/\D/g, '');
    const msg = buildWhatsAppMessage(freight);
    const url = phone
      ? `https://api.whatsapp.com/send?phone=55${phone}&text=${msg}`
      : `https://wa.me/?text=${msg}`;
    Linking.openURL(url);
  }

  const origin = formatLocation(freight.origin);
  const dest = formatLocation(freight.destination);
  const priceLabel = formatCurrency(freight.price);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Frete de ${origin} para ${dest}, valor ${priceLabel}`}
      accessibilityHint="Toque para ver detalhes do frete"
    >
      <View style={styles.row}>
        <CachedAvatar
          uri={freight.company_logo}
          name={freight.company_name}
          size={56}
          borderRadius={10}
        />

        <View style={styles.middle}>
          <View style={styles.routeItem} accessibilityElementsHidden>
            <View style={styles.dotFilled} />
            <Text style={styles.routeText} numberOfLines={1}>{origin}</Text>
          </View>
          <View style={styles.routeItem} accessibilityElementsHidden>
            <View style={styles.dotHollow} />
            <Text style={styles.routeText} numberOfLines={1}>{dest}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={1} accessibilityElementsHidden>
            {getTimeAgo(freight.created_at)}
            {meta.length > 0 ? `  •  ${meta.join('  •  ')}` : ''}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit accessibilityElementsHidden>
            {priceLabel}
          </Text>
          {showActions && freight.status === 'active' && (
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Contatar via WhatsApp sobre frete de ${origin} para ${dest}`}
            >
              <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
              <Text style={styles.whatsappText}>Enviar Mensagem</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  middle: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dotFilled: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    flexShrink: 0,
  },
  dotHollow: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    flexShrink: 0,
  },
  routeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  meta: {
    fontSize: 10.5,
    color: '#6c757d',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
    maxWidth: 120,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'right',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  whatsappText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '600',
  },
});
