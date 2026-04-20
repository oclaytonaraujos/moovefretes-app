import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../utils/constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  function validateFields(): boolean {
    let valid = true;
    if (!email.trim()) {
      setEmailError('Informe seu e-mail.');
      valid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('E-mail inválido.');
      valid = false;
    } else {
      setEmailError('');
    }
    if (!password.trim()) {
      setPasswordError('Informe sua senha.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('A senha deve ter no mínimo 6 caracteres.');
      valid = false;
    } else {
      setPasswordError('');
    }
    return valid;
  }

  async function handleLogin() {
    if (!validateFields()) return;
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao entrar', 'E-mail ou senha incorretos. Verifique e tente novamente.');
    }
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Redefinir senha', 'Digite seu e-mail no campo acima antes de prosseguir.');
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
    setResetLoading(false);
    if (error) {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail. Tente novamente.');
    } else {
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada para redefinir sua senha.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.mainArea}>
          <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />

          <View style={styles.form}>
          <Text style={styles.welcome}>Área do Motorista</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.inputWrapper, !!emailError && styles.inputWrapperError]}>
              <Ionicons name="mail-outline" size={18} color={emailError ? COLORS.danger : COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={v => { setEmail(v); if (emailError) setEmailError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={[styles.inputWrapper, !!passwordError && styles.inputWrapperError]}>
              <Ionicons name="lock-closed-outline" size={18} color={passwordError ? COLORS.danger : COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Sua senha"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={v => { setPassword(v); if (passwordError) setPasswordError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
          </View>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            disabled={resetLoading}
          >
            {resetLoading
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Text style={styles.forgotText}>Esqueci minha senha</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={18} color="#fff" />
                <Text style={styles.loginBtnText}>Entrar</Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer} numberOfLines={1} adjustsFontSizeToFit>© 2026 • Desenvolvido por Amplie Marketing. Todos os direitos reservados.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  logoImage: {
    width: 280,
    height: 64,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  form: {
    gap: 16,
    alignSelf: 'stretch',
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  inputGroup: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  eyeBtn: { padding: 4 },
  inputWrapperError: { borderColor: COLORS.danger },
  fieldError: { fontSize: 12, color: COLORS.danger, marginTop: 2, marginLeft: 2 },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 4, minHeight: 24, justifyContent: 'center' },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    fontSize: 9,
    color: 'rgba(0,0,0,0.35)',
  },
});
