import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';

export function InfoCell({ label, value, valueStyle }: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function VehicleChips({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.vehicleSection}>
      <Text style={styles.vehicleSectionTitle}>{title}</Text>
      <View style={styles.badgeRow}>
        {items.map((item, idx) => <Badge key={idx} label={item} />)}
      </View>
    </View>
  );
}

export function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionHeader({ icon, title }: { icon: any; title: string }) {
  const { Ionicons } = require('@expo/vector-icons');
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  requirementsSection: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  requirementsTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  infoCell: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
    minWidth: '45%', flex: 1,
  },
  infoCellLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  infoCellValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  badge: {
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vehicleSection: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  vehicleSectionTitle: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 8 },
});
