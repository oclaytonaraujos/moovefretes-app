import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AVAILABILITY_LABELS } from '../utils/constants';
import { getAvailabilityColor } from '../utils/helpers';

type Status = 'available' | 'busy' | 'offline';

interface AvailabilityToggleProps {
  current: Status;
  onChange: (status: Status) => Promise<void>;
}

export function AvailabilityToggle({ current, onChange }: AvailabilityToggleProps) {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const color = getAvailabilityColor(current);
  const label = AVAILABILITY_LABELS[current] || current;

  const options: { status: Status; icon: string; desc: string }[] = [
    { status: 'available', icon: 'checkmark-circle', desc: 'Pronto para receber fretes' },
    { status: 'busy', icon: 'time', desc: 'Já estou em uma entrega' },
    { status: 'offline', icon: 'moon', desc: 'Não quero receber fretes agora' },
  ];

  async function handleSelect(status: Status) {
    setShowModal(false);
    if (status === current) return;
    setLoading(true);
    await onChange(status);
    setLoading(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.toggle, { borderColor: color, backgroundColor: color + '15' }]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <Text style={[styles.label, { color }]}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={color} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowModal(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Meu Status</Text>
            {options.map(opt => {
              const optColor = getAvailabilityColor(opt.status);
              const isSelected = opt.status === current;
              return (
                <TouchableOpacity
                  key={opt.status}
                  style={[styles.option, isSelected && { backgroundColor: optColor + '15' }]}
                  onPress={() => handleSelect(opt.status)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: optColor + '20' }]}>
                    <Ionicons name={opt.icon as any} size={20} color={optColor} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: optColor }]}>
                      {AVAILABILITY_LABELS[opt.status]}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={optColor} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontWeight: '700',
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontWeight: '700',
    fontSize: 14,
  },
  optionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
