export const COLORS = {
  primary: '#253663',
  primaryLight: '#3a5a9e',
  primaryDark: '#1a2845',

  available: '#22c55e',
  busy: '#eab308',
  offline: '#6b7280',

  background: '#f8f9fa',
  surface: '#ffffff',
  border: '#e1e4e8',
  borderLight: '#f0f2f4',

  text: '#1a1a1a',
  textSecondary: '#6c757d',
  textLight: '#9ca3af',

  danger: '#dc3545',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',

  gold: '#fbbf24',
  orange: '#e9742b',
} as const;

export const VEHICLE_TYPES_HEAVY = [
  'Carreta',
  'Carreta LS',
  'Vanderléia',
  'Bitrem',
  'Rodotrem',
];

export const VEHICLE_TYPES_MEDIUM = ['Truck', 'Bitruck'];

export const VEHICLE_TYPES_LIGHT = ['Fiorino', 'VLC', '3/4', 'Toco'];

export const ALL_VEHICLE_TYPES = [
  ...VEHICLE_TYPES_HEAVY,
  ...VEHICLE_TYPES_MEDIUM,
  ...VEHICLE_TYPES_LIGHT,
];

export const BODY_TYPES_OPEN = [
  'Graneleiro',
  'Grade Baixa',
  'Prancha',
  'Caçamba',
  'Plataforma',
];

export const BODY_TYPES_CLOSED = [
  'Sider',
  'Baú',
  'Baú Frigorífico',
  'Baú Refrigerado',
];

export const BODY_TYPES_SPECIAL = [
  'Silo',
  'Cegonheiro',
  'Gaiola',
  'Tanque',
  'Bug Porta Container',
  'Munck',
  'Apenas Cavalo',
  'Cavaqueira',
  'Hopper',
];

export const FREIGHT_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Disponível',
  scheduled: 'Agendado',
  'in-transit': 'Em Trânsito',
  completed: 'Concluído',
  contracted: 'Contratado',
  cancelled: 'Cancelado',
};

export const FREIGHT_STATUS_COLORS: Record<string, string> = {
  draft: COLORS.textLight,
  active: COLORS.available,
  scheduled: COLORS.info,
  'in-transit': COLORS.orange,
  completed: COLORS.primary,
  contracted: COLORS.warning,
  cancelled: COLORS.danger,
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Disponível',
  busy: 'Ocupado',
  offline: 'Offline',
};

export const CARGO_TYPES = [
  'Granel',
  'Frigorífico',
  'Geral',
  'Perigoso',
  'Vivo',
  'Conteiner',
  'Veículos',
  'Madeira',
  'Minério',
  'Combustível',
  'Outros',
];

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
