import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/helpers';
import { InfoCell, sharedStyles } from './shared';
import type { Freight } from '../../types';

function getPaymentIncludedLabel(item: string) {
  const labels: Record<string, string> = {
    fuel: 'Combustível',
    tolls: 'Pedágios',
    taxes: 'Impostos',
    insurance: 'Seguro',
  };
  return labels[item] ?? item;
}

export function FreightPaymentCard({ freight }: { freight: Freight }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Informações de Valor e Pagamento</Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceLabelWhite}>Valor do Frete</Text>
        <Text style={styles.priceValue}>{formatCurrency(freight.price)}</Text>
      </View>

      <View style={sharedStyles.infoGrid}>
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
          {Array.isArray(freight.paymentIncluded) && freight.paymentIncluded.length > 0
            ? freight.paymentIncluded.map(getPaymentIncludedLabel).join(', ')
            : 'Pagamento Separado'}
        </Text>
      </View>
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
  priceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, padding: 16, marginBottom: 14,
  },
  priceLabelWhite: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#fff' },
  infoCellFull: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    marginTop: 8, width: '100%',
  },
  infoCellLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  infoCellValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
});
