import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { setWorkoutCompletion, Workout, WorkoutApiError } from '../workouts/workoutApi';
import { todayWorkoutDate } from '../workouts/workoutDate';
import { Colors, useThemedStyles } from '../ui/theme';

export default function WorkoutCompletion({ workout, hasExercises, onChange }: {
  workout: Workout; hasExercises: boolean; onChange: (workout: Workout) => void;
}) {
  const { token, signOut } = useSession();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<boolean | null>(null);
  const operation = useRef<AbortController | null>(null);
  const active = useRef(false), busy = useRef(false);
  const completed = workout.completedAt !== null;
  const future = workout.date > todayWorkoutDate();

  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; operation.current?.abort(); };
  }, []));

  async function save(target: boolean) {
    if (!token || busy.current) return;
    const controller = new AbortController(); operation.current = controller;
    busy.current = true; setSaving(true); setError(null);
    try {
      const result = await setWorkoutCompletion(token, workout.id, target, todayWorkoutDate(), controller.signal);
      if (active.current && !controller.signal.aborted) { setRetry(null); onChange(result); }
    } catch (cause) {
      if (!active.current || controller.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        await signOut().catch(() => { if (active.current) setError('Сесія завершилася. Увійди повторно.'); });
      } else {
        // A timeout may arrive after COMMIT. Retry the same desired state,
        // rather than toggling an unknown state on the server.
        setRetry(target);
        setError(cause instanceof WorkoutApiError ? cause.message : 'Не вдалося підтвердити зміну. Перевір інтернет і повтори запит.');
      }
    } finally {
      busy.current = false;
      if (active.current && operation.current === controller) setSaving(false);
    }
  }

  const disabled = saving || (retry === null && !completed && (!hasExercises || future));
  return <View style={styles.container}>
    <Text accessibilityLiveRegion="polite" style={completed ? styles.done : styles.hint}>{completed ? '✓ Виконано' : 'Не завершено'}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled, busy: saving }} disabled={disabled}
      style={[completed ? styles.secondary : styles.button, disabled && styles.disabled]}
      onPress={() => void save(retry ?? !completed)}>
      <Text style={completed ? styles.secondaryText : styles.buttonText}>{saving ? 'Зберігаємо стан…' : retry !== null ? 'Повторити зміну стану' : completed ? 'Скасувати завершення' : 'Завершити тренування'}</Text>
    </TouchableOpacity>
    {!completed && !hasExercises && <Text style={styles.hint}>Спочатку додай вправу з підходами.</Text>}
    {!completed && future && <Text style={styles.hint}>Це майбутній план. Завершити його можна в день тренування або пізніше.</Text>}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: { gap: 10 }, done: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  secondary: { padding: 14, borderRadius: 12, backgroundColor: colors.raised, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 14 }, disabled: { opacity: 0.5 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
});
