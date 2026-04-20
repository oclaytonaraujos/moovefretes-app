import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { InfoCell, sharedStyles } from './shared';
import type { Freight } from '../../types';

export function FreightDimensionsCard({ freight }: { freight: Freight }) {
  const hasAny = freight.length || freight.width || freight.height || freight.cubicWeight || freight.totalCubicMeters;
  if (!hasAny) return null;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="resize-outline" size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Dimensões e Medidas</Text>
      </View>
      <View style={sharedStyles.infoGrid}>
        <InfoCell label="Comprimento"         value={freight.length           ? String(freight.length)           : 'Não informado'} />
        <InfoCell label="Largura"             value={freight.width            ? String(freight.width)            : 'Não informado'} />
        <InfoCell label="Altura"              value={freight.height           ? String(freight.height)           : 'Não informado'} />
        <InfoCell label="Peso Cúbico"         value={freight.cubicWeight      ? String(freight.cubicWeight)      : 'Não informado'} />
        <InfoCell label="Metros Cúbicos Totais" value={freight.totalCubicMeters ? String(freight.totalCubicMeters) : 'Não informado'} />
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
});
