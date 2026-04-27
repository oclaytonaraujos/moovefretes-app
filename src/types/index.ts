export type UserType = 'caminhoneiro' | 'transportadora' | 'embarcador' | 'agenciador';
export type AvailabilityStatus = 'available' | 'busy' | 'offline';
export type FreightStatus =
  | 'draft'
  | 'active'
  | 'scheduled'
  | 'in-transit'
  | 'completed'
  | 'contracted'
  | 'cancelled';

export interface Location {
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  lastUpdated?: string;
}

export interface Vehicle {
  type: string;
  plate: string;
  model: string;
  year: string;
  capacity: string;
}

export interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  cpf?: string;
  cnh?: string;
  cnh_category?: string;
  cnh_expiry?: string;
  rntrc?: string;
  profile_image?: string;
  rating: number;
  completed_trips: number;
  vehicle_type?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_capacity?: number;
  vehicle_types?: string[];
  body_types?: string[];
  current_location?: Location;
  available?: boolean;
  availability_expires_at?: string;
  preferred_routes?: PreferredRoute[];
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_type: UserType;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
  total_freights?: number;
  completed_freights?: number;
  is_online?: boolean;
  last_seen?: string;
  total_ratings?: number;
  total_distance_km?: number;
  total_earnings?: number;
}

export interface PreferredRoute {
  id: string;
  driver_id: string;
  origin: Location;
  destination: Location;
  priority: 'high' | 'medium' | 'low';
  is_active: boolean;
  vehicle_types?: string[];
  capacity_kg?: number;
  preferred_cargo_types?: string[];
  price_per_km?: number;
  minimum_value?: number;
  accepts_partial_load?: boolean;
  views_count?: number;
  contacts_count?: number;
  created_at: string;
}

export interface FreightContact {
  id: string;
  name: string;
  email?: string;
  phone: string;
  isMainContact: boolean;
  source: 'collaborator' | 'manual';
}

export interface Freight {
  id: string;
  title?: string;
  freight_code?: string;
  description?: string;
  origin: Location;
  destination: Location;
  status: FreightStatus;
  cargo_type?: string;
  weight?: number;
  volume?: number;
  vehicle_types?: string[];
  body_types?: string[];
  price?: number | string | null;
  price_per_km?: number;
  distance_km?: number;
  scheduled_date?: string;
  deadline_date?: string;
  accepted_driver_id?: string;
  accepted_driver_name?: string;
  company_id?: string;
  company_name?: string;
  company_logo?: string | null;
  publisher_phone?: string | null;
  created_by?: string;
  publisher_id?: string;
  created_at: string;
  updated_at: string;

  // Campos adicionais do cadastro (metadata)
  product?: string;
  species?: string;
  cargoType?: string;
  occupancyType?: 'completa' | 'complemento';
  volumes?: number;
  volumeUnit?: string;
  needsCover?: boolean;
  needsTracker?: boolean;
  isInsured?: boolean;
  cubicWeight?: number;
  totalCubicMeters?: number;
  length?: number;
  width?: number;
  height?: number;
  observations?: string;
  truckType?: string;
  category?: string;
  urgencyType?: string;
  scheduledDate?: string;

  // Veículos e carrocerias
  selectedLightVehicles?: string[];
  selectedMediumVehicles?: string[];
  selectedHeavyVehicles?: string[];
  selectedClosedTrailers?: string[];
  selectedOpenTrailers?: string[];
  selectedSpecialTrailers?: string[];

  // Valor e pagamento
  freightValueType?: string;
  valueCalculation?: string;
  paymentIncluded?: string[];
  paymentMethod?: string;
  advancePayment?: string;

  // Carga adicional
  hasAdditionalCargo?: boolean;
  additionalCargoDetails?: string;

  // Contatos responsáveis
  responsibleContacts?: FreightContact[];

  // Datas de coleta/entrega
  pickupDate?: string;
  deliveryDate?: string;
}

export interface Company {
  id: string;
  user_id: string;
  company_name: string;
  company_type: 'transportadora' | 'embarcador' | 'ambos' | 'agenciador';
  cnpj?: string;
  phone?: string;
  email?: string;
  logo?: string;
  address?: { city?: string; state?: string; [key: string]: any };
  verified: boolean;
  created_at: string;
  description?: string;
  website?: string;
  rating?: number;
  active_freights?: number;
  completed_freights?: number;
  review_count?: number;
}

export interface CompanyRating {
  id: string;
  evaluator_id: string;
  evaluator_name?: string;
  evaluator_type?: string;
  overall_rating: number;
  punctuality_rating?: number;
  communication_rating?: number;
  professionalism_rating?: number;
  comment?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

export interface Chat {
  id: string;
  participant_ids: string[];
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  other_user?: {
    id: string;
    name: string;
    avatar_url?: string;
    user_type?: string;
  };
}

export interface Rating {
  id: string;
  evaluator_id: string;
  target_id: string;
  freight_id?: string;
  overall_rating: number;
  punctuality_rating?: number;
  communication_rating?: number;
  professionalism_rating?: number;
  comment?: string;
  created_at: string;
}
