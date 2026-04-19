import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS } from '../../utils/constants';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao entrar', 'E-mail ou senha incorretos. Verifique e tente novamente.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="truck" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>MooveFretes</Text>
          <Text style={styles.subtitle}>Área do Motorista</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.welcome}>Bem-vindo de volta!</Text>
          <Text style={styles.welcomeSub}>Entre com suas credenciais para acessar o painel.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Sua senha"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
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
          </View>

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

        <Text style={styles.footer}>
          Apenas para motoristas cadastrados.{'\n'}Entre em contato com o suporte se precisar de ajuda.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.primary },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  welcomeSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: -8,
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
});
