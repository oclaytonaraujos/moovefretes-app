import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, FlatList, Switch,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../utils/constants';
import { CityAutocompleteInput } from '../components/CityAutocompleteInput';

// ─── Constantes ────────────────────────────────────────────────────────────────

const LIGHT_VEHICLES = ['Todos os leves', '3/4', 'Fiorino', 'Toco', 'VLC'];
const MEDIUM_VEHICLES = ['Todos os médios', 'Bitruck', 'Truck'];
const HEAVY_VEHICLES = ['Todos os pesados', 'Bitrem', 'Carreta', 'Carreta LS', 'Rodotrem', 'Vanderléia'];
const CLOSED_TRAILERS = ['Baú', 'Baú Frigorífico', 'Baú Refrigerado', 'Sider'];
const OPEN_TRAILERS = ['Caçamba', 'Grade Baixa', 'Graneleiro', 'Plataforma', 'Prancha'];
const SPECIAL_TRAILERS = ['Apenas Cavalo', 'Bug Porta Container', 'Cavaqueira', 'Cegonheiro', 'Gaiola', 'Hopper', 'Munck', 'Silo', 'Tanque'];

const CARGO_TYPE_OPTIONS = [
  'Carga Geral', 'Granel sólido', 'Granel líquido', 'Granel pressurizada', 'Conteiner',
  'Frigorificada ou Aquecida', 'Neogranel', 'Perigosa (Carga Geral)', 'Perigosa (Granel sólido)',
  'Perigosa (Granel liquido)', 'Perigosa (Container)', 'Perigosa (Frigorificada ou Aquecida)',
];
const SPECIES_OPTIONS = [
  'Animais', 'Big Bag', 'Bobina', 'Caixas', 'Container', 'Diversos', 'Fardos',
  'Fracionada', 'Granel', 'Metro Cubico', 'Milheiro', 'Mudança', 'Paletes',
  'Passageiro', 'Sacos', 'Tambor', 'Unidades',
];
const VOLUME_UNIT_OPTIONS = ['Por toneladas', 'Por quilos'];
const VALUE_CALC_OPTIONS = ['Por toneladas', 'Por quilos', 'Total'];
const PAYMENT_OPTIONS = ['À Vista', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Boleto Bancário', 'Transferência', 'Dinheiro'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseBrDate(str: string): string | null {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, day, month, year] = m;
  const d = parseInt(day);
  const m_num = parseInt(month);
  const y = parseInt(year);
  if (d < 1 || d > 31 || m_num < 1 || m_num > 12 || y < 2000) return null;
  return `${year}-${month}-${day}`;
}

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item];
}

// ─── Sub-componentes internos ─────────────────────────────────────────────────

function SectionCard({ children, title, icon, subtitle }: { children: React.ReactNode; title?: string; icon?: string; subtitle?: string }) {
  return (
    <View style={s.card}>
      {title && (
        <View style={s.cardHeader}>
          <View style={s.cardHeaderIcon}>
            <Ionicons name={icon as any} size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{title}</Text>
            {subtitle ? <Text style={s.cardSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function FieldLabel({ children, optional, style }: { children: string; optional?: boolean; style?: any }) {
  return (
    <Text style={[s.label, style]}>
      {children}
      {optional ? <Text style={s.labelOptional}> (opcional)</Text> : null}
    </Text>
  );
}

function InputBox({ value, onChangeText, placeholder, keyboardType, multiline, maxLength, style, icon, returnKeyType, onSubmitEditing }: any) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={[
      s.inputBox, 
      multiline && s.inputBoxMulti, 
      isFocused && s.inputBoxFocused,
      style
    ]}>
      {icon && <Ionicons name={icon} size={18} color={isFocused ? COLORS.primary : COLORS.textLight} style={{ marginRight: 10 }} />}
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType={returnKeyType || (multiline ? 'default' : 'done')}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={!multiline}
      />
    </View>
  );
}

function InlineSelect({ value, placeholder, options, onSelect, icon }: { value: string; placeholder: string; options: string[]; onSelect: (v: string) => void; icon?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={{ zIndex: isOpen ? 100 : 1 }}>
      <TouchableOpacity 
        style={[s.selectBtn, isOpen && { borderColor: COLORS.primary }]} 
        onPress={() => setIsOpen(!isOpen)} 
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {icon && <Ionicons name={icon as any} size={18} color={isOpen ? COLORS.primary : COLORS.textLight} style={{ marginRight: 10 }} />}
          <Text style={[s.selectBtnText, !value && s.selectBtnPlaceholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {isOpen && (
        <View style={s.dropdownContainer}>
          <ScrollView 
            style={s.dropdown} 
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((opt, idx) => (
              <TouchableOpacity
                key={opt}
                style={[s.dropdownItem, idx < options.length - 1 && s.dropdownBorder]}
                onPress={() => {
                  onSelect(opt);
                  setIsOpen(false);
                }}
              >
                <Text style={[s.dropdownItemText, value === opt && { color: COLORS.primary, fontWeight: '700' }]}>{opt}</Text>
                {value === opt && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ChipItem({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[s.chip, checked && s.chipChecked]} 
      onPress={onPress} 
      activeOpacity={0.6}
    >
      <Text style={[s.chipLabel, checked && s.chipLabelChecked]}>{label}</Text>
      {checked && <Ionicons name="checkmark-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );
}

function YesNoToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.yesNoContainer}>
      <Text style={s.yesNoLabel}>{label}</Text>
      <View style={s.yesNoRow}>
        <TouchableOpacity
          style={[s.yesNoBtn, value && s.yesNoBtnActive]}
          onPress={() => onChange(true)}
        >
          <Text style={[s.yesNoBtnText, value && s.yesNoBtnTextActive]}>Sim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.yesNoBtn, !value && s.yesNoBtnActive]}
          onPress={() => onChange(false)}
        >
          <Text style={[s.yesNoBtnText, !value && s.yesNoBtnTextActive]}>Não</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SegmentedControl({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.segmented}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[s.segmentedItem, value === opt.value && s.segmentedItemActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[s.segmentedText, value === opt.value && s.segmentedTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}


// ─── Componente principal ─────────────────────────────────────────────────────

export function CreateFreightScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // Localização
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');

  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Dados da carga
  const [product, setProduct] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [species, setSpecies] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [volumes, setVolumes] = useState('');
  const [volumeUnit, setVolumeUnit] = useState('Por toneladas');
  const [occupancyType, setOccupancyType] = useState<'completa' | 'complemento'>('completa');
  const [needsCover, setNeedsCover] = useState(true);
  const [needsTracker, setNeedsTracker] = useState(false);
  const [isInsured, setIsInsured] = useState(true);

  // Detalhes extras (collapsible)
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [cubicWeight, setCubicWeight] = useState('');
  const [totalCubicMeters, setTotalCubicMeters] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');

  // Veículos
  const [selectedLightVehicles, setSelectedLightVehicles] = useState<string[]>([]);
  const [selectedMediumVehicles, setSelectedMediumVehicles] = useState<string[]>([]);
  const [selectedHeavyVehicles, setSelectedHeavyVehicles] = useState<string[]>([]);

  // Carrocerias
  const [selectedClosedTrailers, setSelectedClosedTrailers] = useState<string[]>([]);
  const [selectedOpenTrailers, setSelectedOpenTrailers] = useState<string[]>([]);
  const [selectedSpecialTrailers, setSelectedSpecialTrailers] = useState<string[]>([]);

  // Valor e pagamento
  const [freightValueType, setFreightValueType] = useState<'known' | 'negotiable'>('known');
  const [freightValue, setFreightValue] = useState('');
  const [valueCalculation, setValueCalculation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [tollPayment, setTollPayment] = useState<'included' | 'separate'>('included');
  const [advancePayment, setAdvancePayment] = useState('');

  // Urgência
  const [urgencyType, setUrgencyType] = useState<'normal' | 'urgent' | 'scheduled'>('normal');
  const [scheduledDate, setScheduledDate] = useState('');

  // Tipo de Frete e Exposição


  // Carga Adicional
  const [hasAdditionalCargo, setHasAdditionalCargo] = useState(false);
  const [additionalCargoDetails, setAdditionalCargoDetails] = useState('');

  // Responsáveis pelo frete
  const [responsibleContacts, setResponsibleContacts] = useState<any[]>([]);
  const [companyCollaborators, setCompanyCollaborators] = useState<any[]>([]);
  const [savedContacts, setSavedContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Estados para diálogos de contato
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isContactListModalOpen, setIsContactListModalOpen] = useState(false);
  const [manualContact, setManualContact] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Observações
  const [observations, setObservations] = useState('');

  // UI
  const [loading, setLoading] = useState(false);

  const formatDateMask = (text: string, setter: (v: string) => void) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    } else if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    setter(formatted);
  };
  // ─── Efeitos e Carregamento ──────────────────────────────────────────────────

  React.useEffect(() => {
    if (user?.company?.id) {
      loadContacts();
    }
  }, [user?.company?.id]);

  async function loadContacts() {
    if (!user?.company?.id) return;
    setLoadingContacts(true);
    try {
      // 1. Buscar colaboradores da empresa
      const { data: collaborators } = await supabase
        .from('collaborators')
        .select('id, name, email, phone')
        .eq('company_id', user.company.id)
        .eq('status', 'active');

      if (collaborators) {
        setCompanyCollaborators(collaborators.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          source: 'collaborator'
        })));
      }

      // 2. Buscar contatos salvos
      const { data: saved } = await supabase
        .from('company_saved_contacts')
        .select('id, name, email, phone')
        .eq('company_id', user.company.id);

      if (saved) {
        setSavedContacts(saved.map(s => ({
          id: `saved_${s.id}`,
          savedContactId: s.id,
          name: s.name,
          email: s.email || '',
          phone: s.phone || '',
          source: 'saved_contact'
        })));
      }
    } catch (error) {
      console.error('[CreateFreight] Error loading contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }

  function handleToggleContact(contact: any) {
    const isSelected = responsibleContacts.some(c => c.id === contact.id);
    if (isSelected) {
      setResponsibleContacts(prev => prev.filter(c => c.id !== contact.id));
    } else {
      if (responsibleContacts.length >= 3) {
        Alert.alert('Atenção', 'Máximo de 3 contatos responsáveis');
        return;
      }
      setResponsibleContacts(prev => [...prev, {
        ...contact,
        isMainContact: prev.length === 0
      }]);
    }
  }

  function handleSetMainContact(id: string) {
    setResponsibleContacts(prev => prev.map(c => ({
      ...c,
      isMainContact: c.id === id
    })));
  }

  async function handleAddManualContact() {
    if (!manualContact.name || !manualContact.phone) {
      Alert.alert('Atenção', 'Preencha nome e telefone');
      return;
    }

    if (responsibleContacts.length >= 3) {
      Alert.alert('Atenção', 'Máximo de 3 contatos responsáveis');
      return;
    }

    setLoading(true);
    try {
      if (!user?.company?.id) {
        throw new Error('Usuário não está vinculado a uma empresa');
      }

      // Salvar como contato fixo da empresa para reutilização (como no projeto de referência)
      const { data: saved, error } = await supabase
        .from('company_saved_contacts')
        .insert({
          company_id: user?.company?.id,
          name: manualContact.name,
          email: manualContact.email || null,
          phone: manualContact.phone,
          created_by: user?.id,
          is_active: true
        })
        .select('id, name, email, phone')
        .single();

      if (error) throw error;

      const newContact = {
        id: `saved_${saved.id}`,
        savedContactId: saved.id,
        name: saved.name,
        email: saved.email || '',
        phone: saved.phone || '',
        source: 'saved_contact',
        isMainContact: responsibleContacts.length === 0
      };

      setSavedContacts(prev => [...prev, newContact]);
      setResponsibleContacts(prev => [...prev, newContact]);
      setManualContact({ name: '', email: '', phone: '' });
      setIsContactDialogOpen(false);
    } catch (err: any) {
      console.error('[CreateFreight] Error saving contact:', err);
      Alert.alert('Erro', `Não foi possível salvar o contato: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }



  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handlePublish(asScheduled = false) {
    if (!originCity || !destinationCity) {
      Alert.alert('Atenção', 'Preencha a cidade de origem e destino');
      return;
    }
    if (!pickupDate || !deliveryDate) {
      Alert.alert('Atenção', 'Preencha as datas de coleta e entrega');
      return;
    }
    if (!product) {
      Alert.alert('Atenção', 'Informe o produto / carga');
      return;
    }
    if (!cargoType || !species) {
      Alert.alert('Atenção', 'Selecione o tipo de carga e a espécie');
      return;
    }
    if (!totalWeight || !volumes) {
      Alert.alert('Atenção', 'Informe o peso total e a quantidade de volumes');
      return;
    }
    
    const allVehicles = [...selectedLightVehicles, ...selectedMediumVehicles, ...selectedHeavyVehicles];
    const allTrailers = [...selectedClosedTrailers, ...selectedOpenTrailers, ...selectedSpecialTrailers];

    if (allVehicles.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um tipo de veículo');
      return;
    }
    if (allTrailers.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um tipo de carroceria');
      return;
    }

    if (freightValueType === 'known') {
      if (!freightValue) {
        Alert.alert('Atenção', 'Informe o valor do frete');
        return;
      }
      if (!valueCalculation) {
        Alert.alert('Atenção', 'Informe o tipo de cálculo');
        return;
      }
      if (advancePayment === '') {
        Alert.alert('Atenção', 'Informe o valor do adiantamento (ou 0 se não houver)');
        return;
      }
    }

    if (!paymentMethod) {
      Alert.alert('Atenção', 'Informe o método de pagamento');
      return;
    }

    if (!observations || observations.length < 5) {
      Alert.alert('Atenção', 'Adicione uma observação (mínimo 5 caracteres) para ajudar o motorista');
      return;
    }

    if (asScheduled && !scheduledDate) {
      Alert.alert('Atenção', 'Selecione uma data de coleta para agendar o frete');
      return;
    }
    if (responsibleContacts.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um contato responsável pelo frete');
      return;
    }

    const truckType = allVehicles[0] || allTrailers[0] || 'Não especificado';
    const category = allTrailers[0] || 'Carga Geral';
    


    const status = asScheduled ? 'scheduled' : urgencyType === 'scheduled' ? 'scheduled' : 'active';

    const pickupDateISO = scheduledDate ? parseBrDate(scheduledDate) : (pickupDate ? parseBrDate(pickupDate) : null);
    const deliveryDateISO = deliveryDate ? parseBrDate(deliveryDate) : null;

    if ((scheduledDate && !pickupDateISO) || (pickupDate && !pickupDateISO)) {
      Alert.alert('Data Inválida', 'A data de coleta deve estar no formato DD/MM/AAAA');
      return;
    }
    if (deliveryDate && !deliveryDateISO) {
      Alert.alert('Data Inválida', 'A data de entrega deve estar no formato DD/MM/AAAA');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('freights').insert({
        publisher_id: user?.id,
        title: product,
        cargo_type: cargoType || product || 'Carga Geral',
        origin_city: originCity,
        origin_state: originState || 'BR',
        origin_address: originCity,
        destination_city: destinationCity,
        destination_state: destinationState || 'BR',
        destination_address: destinationCity,
        value_estimate: freightValueType === 'known' && freightValue ? parseFloat(freightValue.replace(',', '.')) : null,
        weight_kg: totalWeight ? parseFloat(totalWeight.replace(',', '.')) : null,
        vehicle_types: allVehicles.length > 0 ? allVehicles : null,
        pickup_date: pickupDateISO,
        delivery_date: deliveryDateISO,
        status,
        metadata: {
          company_id: user?.company?.id,
          type: 'regular',
          exposure_level: 'Baixa exposição',
          body_types: allTrailers.length > 0 ? allTrailers : null,
          product,
          species,
          cargoType,
          occupancyType,
          volumes,
          volumeUnit,
          needsCover,
          needsTracker,
          isInsured,
          cubicWeight,
          totalCubicMeters,
          length: dimLength,
          width: dimWidth,
          height: dimHeight,
          selectedLightVehicles,
          selectedMediumVehicles,
          selectedHeavyVehicles,
          selectedClosedTrailers,
          selectedOpenTrailers,
          selectedSpecialTrailers,
          freightValueType,
          freightValue,
          valueCalculation,
          paymentMethod,
          tollPayment,
          advancePayment,
          urgencyType: asScheduled ? 'scheduled' : urgencyType,
          scheduledDate,
          observations,
          truckType,
          category,
          hasAdditionalCargo,
          additionalCargoDetails,

          price: freightValueType === 'known' && freightValue ? `R$ ${freightValue}` : 'A combinar',
          responsibleContacts: responsibleContacts.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            isMainContact: c.isMainContact,
            source: c.source
          })),
        },
      });

      if (error) throw error;
      Alert.alert('Sucesso', asScheduled ? 'Frete agendado com sucesso!' : 'Frete publicado com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar frete');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Criar Frete</Text>
          <Text style={s.headerSubtitle}>Preencha os dados da carga</Text>
        </View>
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Seção 1: Rota e Datas ────────────────────────────────────────── */}
        <SectionCard 
          icon="map-outline" 
          title="A Rota" 
          subtitle="Origem, destino e previsão de datas"
        >
          <View style={s.fieldGroup}>
            <FieldLabel>Cidade de Coleta *</FieldLabel>
            <CityAutocompleteInput
              placeholder="Ex: São Paulo, SP"
              value={originCity ? `${originCity}${originState ? ` - ${originState}` : ''}` : ''}
              onSelect={(city, state) => { setOriginCity(city); setOriginState(state); }}
            />
          </View>



          <View style={[s.divider, { marginVertical: 8, height: 0.5 }]} />

          <View style={s.fieldGroup}>
            <FieldLabel>Cidade de Entrega *</FieldLabel>
            <CityAutocompleteInput
              placeholder="Ex: Curitiba, PR"
              value={destinationCity ? `${destinationCity}${destinationState ? ` - ${destinationState}` : ''}` : ''}
              onSelect={(city, state) => { setDestinationCity(city); setDestinationState(state); }}
            />
          </View>



          <View style={s.row}>
            <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <FieldLabel>Data Coleta</FieldLabel>
              <InputBox
                value={pickupDate}
                onChangeText={(t: string) => formatDateMask(t, setPickupDate)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                icon="calendar-outline"
                maxLength={10}
              />
            </View>
            <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <FieldLabel>Data Entrega</FieldLabel>
              <InputBox
                value={deliveryDate}
                onChangeText={(t: string) => formatDateMask(t, setDeliveryDate)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                icon="calendar-outline"
                maxLength={10}
              />
            </View>
          </View>
        </SectionCard>

        {/* ── Seção 2: A Carga ────────────────────────────────────────────── */}
        <SectionCard 
          icon="cube-outline" 
          title="A Carga" 
          subtitle="Detalhes do que será transportado"
        >
          <View style={s.fieldGroup}>
            <FieldLabel>Produto / Mercadoria *</FieldLabel>
            <InputBox
              value={product}
              onChangeText={setProduct}
              placeholder="Ex: Soja ensacada, Peças automotivas..."
            />
          </View>

          <View style={s.row}>
            <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <FieldLabel>Tipo de Carga</FieldLabel>
              <InlineSelect
                value={cargoType}
                options={CARGO_TYPE_OPTIONS}
                placeholder="Selecione"
                onSelect={setCargoType}
              />
            </View>
            <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <FieldLabel>Espécie</FieldLabel>
              <InlineSelect
                value={species}
                options={SPECIES_OPTIONS}
                placeholder="Selecione"
                onSelect={setSpecies}
              />
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
              <FieldLabel>Peso Total (kg)</FieldLabel>
              <InputBox value={totalWeight} onChangeText={setTotalWeight} placeholder="Ex: 25000" keyboardType="numeric" />
            </View>
            <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
              <FieldLabel>Volumes</FieldLabel>
              <InputBox value={volumes} onChangeText={setVolumes} placeholder="Qtd" keyboardType="numeric" />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <FieldLabel>Ocupação</FieldLabel>
            <SegmentedControl
              options={[
                { label: 'Carga Completa', value: 'completa' },
                { label: 'Complemento', value: 'complemento' },
              ]}
              value={occupancyType}
              onChange={v => setOccupancyType(v as any)}
            />
          </View>

          <View style={s.yesNoGrid}>
            <YesNoToggle label="Lona?" value={needsCover} onChange={setNeedsCover} />
            <YesNoToggle label="Rastreador?" value={needsTracker} onChange={setNeedsTracker} />
            <YesNoToggle label="Seguro?" value={isInsured} onChange={setIsInsured} />
          </View>

          <TouchableOpacity
            style={s.collapsibleToggle}
            onPress={() => setShowExtraDetails(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.collapsibleToggleText}>
              {showExtraDetails ? 'Ocultar detalhes extras' : 'Ver mais detalhes (Cúbico, Dimensões)'}
            </Text>
            <Ionicons name={showExtraDetails ? "chevron-up" : "chevron-down"} size={16} color={COLORS.primary} />
          </TouchableOpacity>

          {showExtraDetails && (
            <View style={s.extraDetails}>
              <View style={s.row}>
                <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <FieldLabel>Peso Cubado</FieldLabel>
                  <InputBox value={cubicWeight} onChangeText={setCubicWeight} placeholder="kg" keyboardType="numeric" />
                </View>
                <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <FieldLabel>M³ Total</FieldLabel>
                  <InputBox value={totalCubicMeters} onChangeText={setTotalCubicMeters} placeholder="m³" keyboardType="numeric" />
                </View>
              </View>

              <Text style={s.subLabel}>Dimensões (m)</Text>
              <View style={s.row}>
                <View style={[s.fieldGroup, { flex: 1, marginRight: 4 }]}>
                  <InputBox value={dimLength} onChangeText={setDimLength} placeholder="Comp." keyboardType="numeric" />
                </View>
                <View style={[s.fieldGroup, { flex: 1, marginHorizontal: 4 }]}>
                  <InputBox value={dimWidth} onChangeText={setDimWidth} placeholder="Larg." keyboardType="numeric" />
                </View>
                <View style={[s.fieldGroup, { flex: 1, marginLeft: 4 }]}>
                  <InputBox value={dimHeight} onChangeText={setDimHeight} placeholder="Alt." keyboardType="numeric" />
                </View>
              </View>

              <View style={[s.divider, { marginVertical: 12 }]} />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.label}>Tem carga adicional?</Text>
                <Switch 
                  value={hasAdditionalCargo} 
                  onValueChange={setHasAdditionalCargo} 
                  trackColor={{ false: '#ddd', true: COLORS.primary }}
                />
              </View>

              {hasAdditionalCargo && (
                <View style={[s.fieldGroup, { marginTop: 10 }]}>
                  <FieldLabel>Detalhes da carga adicional</FieldLabel>
                  <InputBox
                    value={additionalCargoDetails}
                    onChangeText={setAdditionalCargoDetails}
                    placeholder="Descreva a carga extra..."
                    multiline
                  />
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* ── Seção 3: Veículos e Carrocerias ─────────────────────────────── */}
        <SectionCard 
          icon="car-outline" 
          title="Requisitos de Transporte" 
          subtitle="Tipos de veículos e carrocerias aceitos"
        >
          <Text style={s.vehicleCategory}>VEÍCULOS</Text>
          <View style={s.chipGrid}>
            {[...LIGHT_VEHICLES, ...MEDIUM_VEHICLES, ...HEAVY_VEHICLES].map(v => (
              <ChipItem
                key={v}
                label={v}
                checked={[...selectedLightVehicles, ...selectedMediumVehicles, ...selectedHeavyVehicles].includes(v)}
                onPress={() => {
                  if (LIGHT_VEHICLES.includes(v)) setSelectedLightVehicles(prev => toggleItem(prev, v));
                  else if (MEDIUM_VEHICLES.includes(v)) setSelectedMediumVehicles(prev => toggleItem(prev, v));
                  else setSelectedHeavyVehicles(prev => toggleItem(prev, v));
                }}
              />
            ))}
          </View>

          <View style={[s.divider, { marginVertical: 16 }]} />

          <Text style={s.vehicleCategory}>CARROCERIAS</Text>
          <View style={s.chipGrid}>
            {[...CLOSED_TRAILERS, ...OPEN_TRAILERS, ...SPECIAL_TRAILERS].map(v => (
              <ChipItem
                key={v}
                label={v}
                checked={[...selectedClosedTrailers, ...selectedOpenTrailers, ...selectedSpecialTrailers].includes(v)}
                onPress={() => {
                  if (CLOSED_TRAILERS.includes(v)) setSelectedClosedTrailers(prev => toggleItem(prev, v));
                  else if (OPEN_TRAILERS.includes(v)) setSelectedOpenTrailers(prev => toggleItem(prev, v));
                  else setSelectedSpecialTrailers(prev => toggleItem(prev, v));
                }}
              />
            ))}
          </View>
        </SectionCard>

        {/* ── Seção 4: Pagamento e Urgência ────────────────────────────────── */}
        <SectionCard 
          icon="cash-outline" 
          title="Valores e Prazos" 
          subtitle="Condições comerciais do frete"
        >
          <View style={s.fieldGroup}>
            <FieldLabel>Valor do Frete</FieldLabel>
            <SegmentedControl
              options={[
                { label: 'Valor Definido', value: 'known' },
                { label: 'A Combinar', value: 'negotiable' },
              ]}
              value={freightValueType}
              onChange={v => setFreightValueType(v as any)}
            />
          </View>

          {freightValueType === 'known' && (
            <>
              <View style={s.row}>
                <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <FieldLabel>Valor (R$)</FieldLabel>
                  <InputBox
                    value={freightValue}
                    onChangeText={setFreightValue}
                    placeholder="0,00"
                    keyboardType="numeric"
                    icon="cash-outline"
                  />
                </View>
                <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <FieldLabel>Tipo de Cálculo</FieldLabel>
                  <InlineSelect
                    value={valueCalculation}
                    options={VALUE_CALC_OPTIONS}
                    placeholder="Selecione"
                    onSelect={setValueCalculation}
                  />
                </View>
              </View>

              <View style={s.row}>
                <View style={[s.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <FieldLabel>Pedágio</FieldLabel>
                  <SegmentedControl
                    options={[
                      { label: 'Incluso', value: 'included' },
                      { label: 'À parte', value: 'separate' },
                    ]}
                    value={tollPayment}
                    onChange={v => setTollPayment(v as any)}
                  />
                </View>
                <View style={[s.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <FieldLabel>Adiantamento %</FieldLabel>
                  <InputBox
                    value={advancePayment}
                    onChangeText={setAdvancePayment}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </>
          )}

          <View style={s.fieldGroup}>
            <FieldLabel>Forma de Pagamento</FieldLabel>
            <InlineSelect
              value={paymentMethod}
              options={PAYMENT_OPTIONS}
              placeholder="Selecione o método de pagamento"
              icon="card-outline"
              onSelect={setPaymentMethod}
            />
          </View>

          <View style={[s.divider, { marginVertical: 12 }]} />

          <View style={s.fieldGroup}>
            <FieldLabel>Urgência do Frete</FieldLabel>
            <SegmentedControl
              options={[
                { label: 'Normal', value: 'normal' },
                { label: 'Urgente', value: 'urgent' },
                { label: 'Agendado', value: 'scheduled' },
              ]}
              value={urgencyType}
              onChange={v => setUrgencyType(v as any)}
            />
          </View>

          {urgencyType === 'scheduled' && (
            <View style={s.fieldGroup}>
              <FieldLabel>Data do Agendamento</FieldLabel>
              <InputBox
                value={scheduledDate}
                onChangeText={(t: string) => formatDateMask(t, setScheduledDate)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                icon="calendar-outline"
                maxLength={10}
              />
            </View>
          )}
        </SectionCard>

        <SectionCard 
          icon="business-outline" 
          title="Responsável pelo frete"
          subtitle="Selecione até 3 contatos da empresa"
        >
          <View style={{ gap: 12 }}>
            {responsibleContacts.length > 0 && (
              <View style={{ gap: 8, marginBottom: 4 }}>
                {responsibleContacts.map(c => (
                  <View key={c.id} style={s.institutionalContactRow}>
                    <TouchableOpacity 
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                      onPress={() => handleSetMainContact(c.id)}
                    >
                      <View style={[s.contactCircle, c.isMainContact && { backgroundColor: COLORS.primary }]}>
                        <Ionicons 
                          name={c.isMainContact ? "star" : "person-outline"} 
                          size={16} 
                          color={c.isMainContact ? "#fff" : COLORS.textSecondary} 
                        />
                      </View>
                      <View>
                        <Text style={s.institutionalContactName}>{c.name}</Text>
                        <Text style={s.institutionalContactPhone}>{c.phone}</Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => handleToggleContact(c)}
                      style={{ padding: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={COLORS.red} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity 
              style={s.institutionalAddBtn}
              onPress={() => setIsContactListModalOpen(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={s.institutionalAddBtnText}>Selecionar contatos</Text>
            </TouchableOpacity>

            {responsibleContacts.length === 0 && (
              <View style={s.emptyContactsInfo}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                <Text style={s.emptyContactsText}>Selecione até 3 contatos responsáveis</Text>
              </View>
            )}

            {responsibleContacts.length > 1 && !responsibleContacts.some(c => c.isMainContact) && (
              <Text style={s.mainContactHint}>Toque na estrela para definir o contato principal</Text>
            )}
          </View>
        </SectionCard>



        <SectionCard 
          icon="chatbox-ellipses-outline" 
          title="Informações Adicionais"
        >

          <View style={s.fieldGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <FieldLabel>Observações</FieldLabel>
              <Text style={s.charCount}>{observations.length}/500</Text>
            </View>
            <InputBox
              value={observations}
              onChangeText={(t: string) => { if (t.length <= 500) setObservations(t); }}
              placeholder="Detalhes que ajudam o motorista..."
              multiline
              maxLength={500}
            />
          </View>
        </SectionCard>

        {/* ── Ações ────────────────────────────────────────────────────────── */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.scheduleBtn, loading && s.btnDisabled]}
            onPress={() => handlePublish(true)}
            disabled={loading}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={s.scheduleBtnText}>Agendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.publishBtn, loading && s.btnDisabled]}
            onPress={() => handlePublish(false)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.publishBtnText}>Publicar Agora</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>


      {/* ── Modal de Novo Contato ─────────────────────────────────────────── */}
      <Modal
        visible={isContactDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsContactDialogOpen(false)}
      >
        <TouchableOpacity 
          style={s.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsContactDialogOpen(false)} 
        />
        <View style={[s.modalSheet, { maxHeight: '90%' }]}>
          <View style={s.modalHandle} />
          <ScrollView 
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.modalTitle, { borderBottomWidth: 0, paddingHorizontal: 0 }]}>Novo Contato Responsável</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 }}>
              Este contato será salvo na lista da empresa.
            </Text>
  
            <View style={s.fieldGroup}>
              <FieldLabel>Nome completo *</FieldLabel>
              <InputBox
                value={manualContact.name}
                onChangeText={(t: string) => setManualContact(prev => ({ ...prev, name: t }))}
                placeholder="Ex: João Silva"
                icon="person-outline"
              />
            </View>
  
            <View style={s.fieldGroup}>
              <FieldLabel>Telefone / WhatsApp *</FieldLabel>
              <InputBox
                value={manualContact.phone}
                onChangeText={(t: string) => setManualContact(prev => ({ ...prev, phone: t }))}
                placeholder="(11) 98765-4321"
                keyboardType="phone-pad"
                icon="logo-whatsapp"
              />
            </View>
  
            <View style={s.fieldGroup}>
              <FieldLabel optional>E-mail</FieldLabel>
              <InputBox
                value={manualContact.email}
                onChangeText={(t: string) => setManualContact(prev => ({ ...prev, email: t }))}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                icon="mail-outline"
              />
            </View>
  
            <TouchableOpacity 
              style={[s.publishBtn, { marginTop: 10 }, loading && s.btnDisabled]} 
              onPress={handleAddManualContact}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.publishBtnText}>Salvar e Adicionar</Text>}
            </TouchableOpacity>
  
            <TouchableOpacity style={s.modalCancel} onPress={() => setIsContactDialogOpen(false)}>
              <Text style={s.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal de Seleção de Responsáveis (Institucional) ──────────────── */}
      <Modal
        visible={isContactListModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsContactListModalOpen(false)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setIsContactListModalOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
            <Text style={[s.modalTitle, { textAlign: 'left', paddingHorizontal: 0 }]}>Selecionar Responsáveis</Text>
            <TouchableOpacity onPress={() => { setIsContactListModalOpen(false); setIsContactDialogOpen(true); }}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>+ Novo</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[...companyCollaborators, ...savedContacts]}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isSelected = responsibleContacts.some(c => c.id === item.id);
              return (
                <TouchableOpacity
                  style={[s.institutionalListRow, isSelected && s.institutionalListRowSelected]}
                  onPress={() => handleToggleContact(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.institutionalContactName}>{item.name}</Text>
                    <Text style={s.institutionalContactPhone}>{item.phone}</Text>
                  </View>
                  <View style={[s.institutionalCheckbox, isSelected && s.institutionalCheckboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />

          <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom || 20, paddingTop: 10 }}>
            <TouchableOpacity 
              style={s.publishBtn} 
              onPress={() => setIsContactListModalOpen(false)}
            >
              <Text style={s.publishBtnText}>Confirmar Seleção</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  content: { padding: 16, gap: 20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cardBody: { 
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8, marginLeft: 2 },
  labelOptional: { fontSize: 11, fontWeight: '400', color: COLORS.textSecondary },
  subLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 8 },

  inputBox: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1.5,
    borderColor: '#eee',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  inputBoxMulti: {
    height: 100,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  input: { fontSize: 15, color: COLORS.text, flex: 1, fontWeight: '500' },
  inputMulti: { height: '100%' },

  selectBtn: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1.5,
    borderColor: '#eee',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBtnText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  selectBtnPlaceholder: { color: COLORS.textLight, fontWeight: '400' },

  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentedItemActive: { 
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  segmentedTextActive: { color: COLORS.primary },

  yesNoGrid: { flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 16 },
  yesNoContainer: { flex: 1, gap: 8 },
  yesNoLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  yesNoRow: { flexDirection: 'row', gap: 6 },
  yesNoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  yesNoBtnActive: { 
    borderColor: COLORS.primary, 
    backgroundColor: `${COLORS.primary}10` 
  },
  yesNoBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  yesNoBtnTextActive: { color: COLORS.primary },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipLabelChecked: { color: '#fff' },

  vehicleCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },

  collapsibleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: `${COLORS.primary}05`,
    borderRadius: 12,
  },
  collapsibleToggleText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  extraDetails: { marginTop: 16, gap: 4 },

  divider: { height: 1, backgroundColor: '#f0f0f0' },
  row: { flexDirection: 'row', alignItems: 'center' },
  charCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  scheduleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  scheduleBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  publishBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    paddingHorizontal: 24,
    paddingVertical: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalOptionText: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  modalSeparator: { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 24 },
  modalCancel: {
    marginTop: 16,
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },

  // Institutional Contact Styles
  institutionalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 4,
  },
  contactCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  institutionalContactName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  institutionalContactPhone: { fontSize: 12, color: COLORS.textSecondary },
  institutionalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#eee',
    borderStyle: 'dashed',
    backgroundColor: '#fafafa',
  },
  institutionalAddBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  institutionalListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
  },
  institutionalListRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}05`,
  },
  institutionalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  institutionalCheckboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  emptyContactsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyContactsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  mainContactHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 1000,
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdown: {
    flex: 1,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  dropdownBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
});
