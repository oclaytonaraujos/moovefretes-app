import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../auth/LoginScreen';

// Mock AuthContext
const mockSignIn = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

// Mock Supabase (para resetPasswordForEmail)
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it('exibe erros de validação com campos vazios', async () => {
    const { getByText, getAllByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Entrar'));
    await waitFor(() => {
      expect(getByText('Informe seu e-mail.')).toBeTruthy();
      expect(getByText('Informe sua senha.')).toBeTruthy();
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('exibe erro de e-mail inválido', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'emailinvalido');
    fireEvent.press(getByText('Entrar'));
    await waitFor(() => expect(getByText('E-mail inválido.')).toBeTruthy());
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('exibe erro de senha curta', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('Sua senha'), '123');
    fireEvent.press(getByText('Entrar'));
    await waitFor(() =>
      expect(getByText('A senha deve ter no mínimo 6 caracteres.')).toBeTruthy()
    );
  });

  it('chama signIn com credenciais válidas', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'user@test.com');
    fireEvent.changeText(getByPlaceholderText('Sua senha'), 'senha123');
    fireEvent.press(getByText('Entrar'));
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'senha123')
    );
  });

  it('botão "Esqueci minha senha" pede e-mail antes de enviar', async () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Esqueci minha senha'));
    // Sem e-mail no campo — não deve chamar resetPasswordForEmail
    const { supabase } = require('../../lib/supabase');
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
