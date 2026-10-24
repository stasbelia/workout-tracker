import { Colors, ThemeProvider, useTheme, useThemedStyles } from '../ui/theme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '../auth/SessionProvider';

export default function RootLayout() {
  return (
    <ThemeProvider><SessionProvider><AppearanceNavigator /></SessionProvider></ThemeProvider>
  );
}

function AppearanceNavigator() {
  const { mode } = useTheme();
  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><RootNavigator /></>;
}

function RootNavigator() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { token, isLoading, restoreError, retryRestore } = useSession();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accentText} accessibilityLabel="Завантаження сесії" />
        <Text style={styles.loadingText}>Відновлюємо сесію…</Text>
      </View>
    );
  }

  if (restoreError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle} accessibilityRole="header">Не вдалося відновити сесію</Text>
        <Text style={styles.loadingText}>Спробуй ще раз. Якщо проблема повторюється, перевір інтернет-з’єднання.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retryRestore} accessibilityRole="button">
          <Text style={styles.retryText}>Спробувати ще раз</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="workout-templates" options={{ title: 'Шаблони тренувань' }} />
        <Stack.Screen name="profile" options={{ title: 'Профіль' }} />
        <Stack.Screen name="index" options={{ title: 'Мої тренування', headerShown: false }} />
        <Stack.Screen name="workouts/[workoutId]/edit" options={{ title: 'Редагувати тренування' }} />
        <Stack.Screen name="workouts/[workoutId]/exercises/[exerciseId]/edit" options={{ title: 'Редагувати вправу' }} />
        <Stack.Screen name="one-rep-max" options={{ title: 'Калькулятор 1RM' }} />
        <Stack.Screen name="workouts/create" options={{ title: 'Деталі нового тренування' }} />
        <Stack.Screen name="workouts/new" options={{ title: 'Нове тренування' }} />
        <Stack.Screen name="workouts/[workoutId]/index" options={{ title: 'Тренування' }} />
        <Stack.Screen name="workouts/[workoutId]/exercises/new" options={{ title: 'Додати вправу' }} />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="login" options={{ title: 'Авторизація', headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Реєстрація' }} />
      </Stack.Protected>
    </Stack>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.muted,
    marginTop: 12,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  retryText: {
    color: colors.ink,
    fontWeight: 'bold',
  },
});
