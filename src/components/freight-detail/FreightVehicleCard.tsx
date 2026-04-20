import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { VehicleChips } from './shared';
import type { Freight } from '../../types';

export function FreightVehicleCard({ freight }: { freight: Freight }) {
  const hasLight  = (freight.selectedLightVehicles?.length ?? 0) > 0;
  const hasMedium = (freight.selectedMediumVehicles?.length ?? 0) > 0;
  const hasHeavy  = (freight.selectedHeavyVehicles?.length ?? 0) > 0;
  const hasClosed  = (freight.selectedClosedTrailers?.length ?? 0) > 0;
  const hasOpen    = (freight.selectedOpenTrailers?.length ?? 0) > 0;
  const hasSpecial = (freight.selectedSpecialTrailers?.length ?? 0) > 0;

  const hasVehicles = freight.truckType || hasLight || hasMedium || hasHeavy;
  const hasTrailers = hasClosed || hasOpen || hasSpecial;

  if (!hasVehicles && !hasTrailers) return null;

  return (
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

      {hasHeavy  && <VehicleChips title="Veículos Pesados Aceitos"   items={freight.selectedHeavyVehicles!} />}
      {hasMedium && <VehicleChips title="Veículos Médios Aceitos"    items={freight.selectedMediumVehicles!} />}
      {hasLight  && <VehicleChips title="Veículos Leves Aceitos"     items={freight.selectedLightVehicles!} />}

      {hasVehicles && hasTrailers && <View style={styles.divider} />}

      {hasTrailers && <Text style={styles.trailerLabel}>Carrocerias Aceitas</Text>}
      {hasClosed  && <VehicleChips title="Carrocerias Fechadas Aceitas"  items={freight.selectedClosedTrailers!} />}
      {hasOpen    && <VehicleChips title="Carrocerias Abertas Aceitas"   items={freight.selectedOpenTrailers!} />}
      {hasSpecial && <VehicleChips title="Carrocerias Especiais Aceitas" items={freight.selectedSpecialTrailers!} />}
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
  highlightBox: {
    backgroundColor: '#EBF0FF',
    borderWidth: 1, borderColor: COLORS.primary + '30',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  highlightLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  highlightValue: { fontSize: 14, fontWeight: '700', color: COLORS.primaryDark },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  trailerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
});
