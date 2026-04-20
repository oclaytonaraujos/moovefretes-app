export const theme = {
  colors: {
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
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
  },
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
  },
} as const;
