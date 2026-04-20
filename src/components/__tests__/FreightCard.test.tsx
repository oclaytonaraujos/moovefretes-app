import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FreightCard } from '../FreightCard';
import type { Freight } from '../../types';

const mockFreight: Freight = {
  id: 'test-123',
  title: 'FRT001',
  freight_code: '#FRT001',
  description: '',
  status: 'active',
  origin: { city: 'São Paulo', state: 'SP' },
  destination: { city: 'Curitiba', state: 'PR' },
  cargo_type: 'Geral',
  weight: 5000,
  vehicle_types: ['Carreta'],
  body_types: [],
  price: 3500,
  distance_km: 410,
  scheduled_date: null,
  deadline_date: null,
  accepted_driver_id: null,
  accepted_driver_name: null,
  company_id: 'company-1',
  company_name: 'Transportadora ABC',
  company_logo: null,
  publisher_phone: '11987654321',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  responsibleContacts: [],
  selectedLightVehicles: [],
  selectedMediumVehicles: [],
  selectedHeavyVehicles: ['Carreta'],
  selectedClosedTrailers: [],
  selectedOpenTrailers: [],
  selectedSpecialTrailers: [],
  needsCover: false,
  needsTracker: false,
  isInsured: false,
  hasAdditionalCargo: false,
};

describe('FreightCard', () => {
  it('renderiza origem e destino no accessibilityLabel do card', () => {
    const { getByLabelText } = render(
      <FreightCard freight={mockFreight} onPress={jest.fn()} />
    );
    // Textos ficam em elementos com accessibilityElementsHidden; a rota completa
    // está no accessibilityLabel do card pai para leitores de tela.
    const card = getByLabelText(/São Paulo, SP/i);
    expect(card).toBeTruthy();
    expect(card.props.accessibilityLabel).toMatch(/Curitiba, PR/i);
  });

  it('chama onPress ao tocar no card', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <FreightCard freight={mockFreight} onPress={onPress} />
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exibe botão de WhatsApp quando showActions=true e status=active', () => {
    const { getByLabelText } = render(
      <FreightCard freight={mockFreight} onPress={jest.fn()} showActions />
    );
    expect(getByLabelText(/Contatar via WhatsApp/i)).toBeTruthy();
  });

  it('não exibe botão de WhatsApp quando showActions=false', () => {
    const { queryByLabelText } = render(
      <FreightCard freight={mockFreight} onPress={jest.fn()} showActions={false} />
    );
    expect(queryByLabelText(/Contatar via WhatsApp/i)).toBeNull();
  });

  it('tem accessibilityLabel descritivo com origem, destino e valor', () => {
    const { getByLabelText } = render(
      <FreightCard freight={mockFreight} onPress={jest.fn()} />
    );
    expect(getByLabelText(/São Paulo, SP.*Curitiba, PR/i)).toBeTruthy();
  });
});
