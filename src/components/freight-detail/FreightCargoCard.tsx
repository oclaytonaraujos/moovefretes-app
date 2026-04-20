import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { formatWeight } from '../../utils/helpers';
import { InfoCell, Badge, sharedStyles } from './shared';
import type { Freight } from '../../types';

function getUrgencyText(urgency?: string) {
  if (urgency === 'urgent') return 'Urgente';
  if (urgency === 'scheduled') return 'Agendado';
  return 'Normal';
}

export function FreightCargoCard({ freight }: { freight: Freight }) {
  const hasRequirements = freight.needsCover || freight.needsTracker || freight.isInsured;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Dados da Carga</Text>
      </View>

      <View style={sharedStyles.infoGrid}>
        {!!freight.product && <InfoCell label="Produto Transportado" value={freight.product} />}
        {!!freight.species && <InfoCell label="Espécie da Carga" value={freight.species} />}
        <InfoCell label="Tipo de Carga" value={freight.cargo_type || 'Carga geral'} />
        {!!freight.occupancyType && (
          <InfoCell label="Ocupação do Veículo" value={freight.occupancyType === 'completa' ? 'Carga Completa' : 'Carga Complemento'} />
        )}
        {freight.weight != null && <InfoCell label="Peso Total" value={formatWeight(freight.weight)} />}
        {freight.volumes != null && (
          <InfoCell label="Volumes" value={`${freight.volumes} ${freight.volumeUnit || 'unidades'}`} />
        )}
        {!!freight.category && <InfoCell label="Categoria" value={freight.category} />}
        {!!freight.urgencyType && (
          <InfoCell
            label="Urgência"
            value={getUrgencyText(freight.urgencyType)}
            valueStyle={freight.urgencyType === 'urgent' ? { color: COLORS.danger, fontWeight: '700' as const } : undefined}
          />
        )}
        {freight.urgencyType === 'scheduled' && !!freight.scheduledDate && (
          <InfoCell label="Data Agendada" value={
            new Date(freight.scheduledDate).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })
          } />
        )}
      </View>

      {hasRequirements && (
        <View style={sharedStyles.requirementsSection}>
          <Text style={sharedStyles.requirementsTitle}>Requisitos da Carga</Text>
          <View style={sharedStyles.badgeRow}>
            {freight.needsCover    && <Badge label="Necessita Lona" />}
            {freight.needsTracker  && <Badge label="Requer Rastreador" />}
            {freight.isInsured     && <Badge label="Carga Segurada" />}
          </View>
        </View>
      )}

      {freight.hasAdditionalCargo && !!freight.additionalCargoDetails && (
        <View style={sharedStyles.requirementsSection}>
          <Text style={sharedStyles.requirementsTitle}>Carga Adicional</Text>
          <Text style={styles.additionalText}>{freight.additionalCargoDetails}</Text>
        </View>
      )}
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
  additionalText: { fontSize: 13, color: COLORS.textSecondary },
});
