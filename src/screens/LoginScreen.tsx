import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { API_BASE_URL } from '../config';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return;

    if (!email.trim() || !password) {
      Alert.alert('Помилка', 'Будь ласка, введіть пошту та пароль!');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data: { token?: unknown; error?: unknown } | null = await response.json();

      if (response.ok) {
        if (typeof data?.token !== 'string' || !data.token.trim()) {
          Alert.alert('Помилка входу', 'Сервер не повернув токен сесії. Спробуйте ще раз.');
          return;
        }

        try {
          await signIn(data.token);
          // Зміна сесії дозволяє маршрут index у Stack.Protected.
        } catch {
          Alert.alert('Помилка збереження сесії', 'Не вдалося зберегти вхід на пристрої. Спробуйте ще раз.');
        }
      } else {
        Alert.alert('Помилка входу', typeof data?.error === 'string' ? data.error : 'Невірна пошта або пароль');
      }
    } catch {
      Alert.alert('Помилка мережі', 'Не вдалося з\'єднатися з сервером');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Tracker</Text>
      <Text style={styles.subtitle}>Вхід у систему</Text>

      <TextInput
        style={styles.input}
        placeholder="Електронна пошта"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.disabledButton]}
        onPress={handleLogin}
        disabled={isSubmitting}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Входимо…' : 'Увійти'}</Text>
      </TouchableOpacity>

      <Link href="/register" asChild>
        <TouchableOpacity style={styles.linkButton} disabled={isSubmitting}>
          <Text style={styles.linkText}>Немає акаунта? Зареєструватися</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.accentText,
    fontSize: 14,
  },
});
