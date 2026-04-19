import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, AVAILABILITY_LABELS, FREIGHT_STATUS_LABELS, FREIGHT_STATUS_COLORS } from '../utils/constants';
import { getAvailabilityColor } from '../utils/helpers';

interface StatusBadgeProps {
  type: 'availability' | 'freight';
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ type, status, size = 'md' }: StatusBadgeProps) {
  const isSmall = size === 'sm';

  if (type === 'availability') {
    const color = getAvailabilityColor(status);
    const label = AVAILABILITY_LABELS[status] || status;
    return (
      <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.text, { color, fontSize: isSmall ? 11 : 12 }]}>{label}</Text>
      </View>
    );
  }

  const color = FREIGHT_STATUS_COLORS[status] || COLORS.textLight;
  const label = FREIGHT_STATUS_LABELS[status] || status;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.text, { color, fontSize: isSmall ? 11 : 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
  },
});
