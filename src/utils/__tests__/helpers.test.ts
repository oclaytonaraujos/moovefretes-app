import {
  getTimeAgo,
  formatCurrency,
  formatDistance,
  formatWeight,
  formatPhone,
  formatLocation,
  truncateText,
} from '../helpers';

describe('formatCurrency', () => {
  it('formata valor numérico em reais', () => {
    expect(formatCurrency(1500)).toBe('R$\u00a01.500,00');
  });
  it('retorna "A combinar" para null', () => {
    expect(formatCurrency(null)).toBe('A combinar');
  });
  it('retorna "A combinar" para undefined', () => {
    expect(formatCurrency(undefined)).toBe('A combinar');
  });
  it('formata string numérica', () => {
    expect(formatCurrency('2500.50')).toBe('R$\u00a02.500,50');
  });
  it('retorna string não-numérica como está', () => {
    expect(formatCurrency('A combinar')).toBe('A combinar');
  });
});

describe('formatDistance', () => {
  it('formata km inteiro', () => {
    expect(formatDistance(350)).toBe('350 km');
  });
  it('formata distância em metros quando < 1km', () => {
    expect(formatDistance(0.5)).toBe('500 m');
  });
  it('retorna "-" para null', () => {
    expect(formatDistance(null)).toBe('-');
  });
});

describe('formatWeight', () => {
  it('formata em toneladas quando >= 1000 kg', () => {
    expect(formatWeight(25000)).toBe('25.0 t');
  });
  it('formata em kg quando < 1000', () => {
    expect(formatWeight(750)).toBe('750 kg');
  });
  it('retorna "-" para null', () => {
    expect(formatWeight(null)).toBe('-');
  });
});

describe('formatPhone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });
  it('formata fixo com 10 dígitos', () => {
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
  });
  it('retorna original se inválido', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

describe('formatLocation', () => {
  it('formata cidade e estado', () => {
    expect(formatLocation({ city: 'São Paulo', state: 'SP' })).toBe('São Paulo, SP');
  });
  it('retorna "Local não informado" para undefined', () => {
    expect(formatLocation(undefined)).toBe('Local não informado');
  });
  it('retorna "Local não informado" para objeto vazio', () => {
    expect(formatLocation({})).toBe('Local não informado');
  });
});

describe('truncateText', () => {
  it('não trunca texto curto', () => {
    expect(truncateText('Olá', 10)).toBe('Olá');
  });
  it('trunca com reticências', () => {
    expect(truncateText('Texto muito longo aqui', 10)).toBe('Texto muit...');
  });
});

describe('getTimeAgo', () => {
  it('retorna "agora mesmo" para timestamps recentes', () => {
    const now = new Date().toISOString();
    expect(getTimeAgo(now)).toBe('agora mesmo');
  });
  it('retorna "desconhecido" para string vazia', () => {
    expect(getTimeAgo('')).toBe('desconhecido');
  });
});
