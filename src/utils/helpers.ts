import { COLORS } from './constants';

export function getTimeAgo(dateString: string): string {
  if (!dateString) return 'desconhecido';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `Há ${diffWeeks} ${diffWeeks === 1 ? 'semana' : 'semanas'}`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `Há ${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'}`;
  const diffYears = Math.floor(diffDays / 365);
  return `Há ${diffYears} ${diffYears === 1 ? 'ano' : 'anos'}`;
}

export function formatLocation(location: { city?: string; state?: string } | undefined): string {
  if (!location) return 'Local não informado';
  const parts = [location.city, location.state].filter(Boolean);
  return parts.join(', ') || 'Local não informado';
}

export function formatRoute(
  origin: { city?: string; state?: string },
  destination: { city?: string; state?: string }
): string {
  return `${formatLocation(origin)} → ${formatLocation(destination)}`;
}

export function formatCurrency(value: number | string | undefined | null): string {
  if (value == null) return 'A combinar';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return typeof value === 'string' ? value : 'A combinar';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function formatDistance(km: number | undefined | null): string {
  if (km == null) return '-';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(0)} km`;
}

export function formatWeight(kg: number | undefined | null): string {
  if (kg == null) return '-';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg} kg`;
}

export function getAvailabilityColor(status: string): string {
  switch (status) {
    case 'available': return COLORS.available;
    case 'busy': return COLORS.busy;
    default: return COLORS.offline;
  }
}

export function getFreightStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: COLORS.available,
    'in-transit': COLORS.orange,
    completed: COLORS.primary,
    contracted: COLORS.warning,
    cancelled: COLORS.danger,
    scheduled: COLORS.info,
  };
  return colors[status] || COLORS.textLight;
}

export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return COLORS.gold;
  if (rating >= 3.5) return COLORS.orange;
  return COLORS.textLight;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function getSupabaseAvatarUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function parseMetadataPrice(raw: any): number | null {
  if (raw == null) return null;
  const str = String(raw).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

export function mapSupabaseFreight(
  row: any,
  publisher?: { name?: string | null; avatar_url?: string | null; phone?: string | null } | null,
) {
  const meta = row.metadata || {};
  return {
    id: row.id,
    title: row.title || row.freight_code || '',
    freight_code: row.freight_code || undefined,
    description: row.description || '',
    status: row.status || 'active',
    origin: { city: row.origin_city || '', state: row.origin_state || '' },
    destination: { city: row.destination_city || '', state: row.destination_state || '' },
    cargo_type: row.cargo_type || meta.cargoType || 'Carga geral',
    weight: row.weight_kg || null,
    vehicle_types: row.vehicle_types || (meta.selectedHeavyVehicles ? [...(meta.selectedHeavyVehicles||[]), ...(meta.selectedMediumVehicles||[]), ...(meta.selectedLightVehicles||[])] : null),
    body_types: row.body_types || null,
    price: row.value_estimate != null ? Number(row.value_estimate) : parseMetadataPrice(meta.price),
    distance_km: row.distance_km || null,
    scheduled_date: row.pickup_date || row.scheduled_date || null,
    deadline_date: row.delivery_date || row.deadline_date || null,
    accepted_driver_id: row.accepted_driver_id || null,
    accepted_driver_name: row.accepted_driver_name || null,
    company_id: row.publisher_id || null,
    company_name: publisher?.name || meta.customerName || null,
    company_logo: publisher?.avatar_url || null,
    publisher_phone: publisher?.phone || row.publisher_phone || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,

    // Campos adicionais do metadata
    product: meta.product || undefined,
    species: meta.species || undefined,
    cargoType: meta.cargoType || undefined,
    occupancyType: meta.occupancyType || undefined,
    volumes: meta.volumes || undefined,
    volumeUnit: meta.volumeUnit || undefined,
    needsCover: meta.needsCover || false,
    needsTracker: meta.needsTracker || false,
    isInsured: meta.isInsured || false,
    cubicWeight: meta.cubicWeight || undefined,
    totalCubicMeters: meta.totalCubicMeters || undefined,
    length: meta.length || undefined,
    width: meta.width || undefined,
    height: meta.height || undefined,
    observations: meta.observations || row.description || undefined,
    truckType: meta.truckType || row.vehicle_types?.[0] || undefined,
    category: meta.category || undefined,
    urgencyType: meta.urgencyType || undefined,
    scheduledDate: meta.scheduledDate || row.pickup_date || undefined,

    // Veículos e carrocerias
    selectedLightVehicles: meta.selectedLightVehicles || [],
    selectedMediumVehicles: meta.selectedMediumVehicles || [],
    selectedHeavyVehicles: meta.selectedHeavyVehicles || [],
    selectedClosedTrailers: meta.selectedClosedTrailers || [],
    selectedOpenTrailers: meta.selectedOpenTrailers || [],
    selectedSpecialTrailers: meta.selectedSpecialTrailers || [],

    // Valor e pagamento
    freightValueType: meta.freightValueType || undefined,
    valueCalculation: meta.valueCalculation || undefined,
    paymentIncluded: meta.paymentIncluded || undefined,
    paymentMethod: meta.paymentMethod || undefined,
    advancePayment: meta.advancePayment || undefined,

    // Carga adicional
    hasAdditionalCargo: meta.hasAdditionalCargo || false,
    additionalCargoDetails: meta.additionalCargoDetails || undefined,

    // Contatos responsáveis
    responsibleContacts: meta.responsibleContacts || [],

    // Datas de coleta/entrega
    pickupDate: row.pickup_date || undefined,
    deliveryDate: row.delivery_date || undefined,
  };
}

export async function fetchPublisherProfiles(
  supabase: any,
  rows: any[],
): Promise<Map<string, { name: string | null; avatar_url: string | null; phone: string | null }>> {
  const ids = [...new Set(rows.map((r: any) => r.publisher_id).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, phone')
    .in('id', ids);
  return new Map((data || []).map((p: any) => [p.id, { name: p.name, avatar_url: p.avatar_url, phone: p.phone }]));
}
