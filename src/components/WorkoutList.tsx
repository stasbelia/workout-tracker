import React, { ReactElement, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { listWorkouts, Workout, WorkoutApiError } from '../workouts/workoutApi';
import AppIcon from './AppIcon';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import { displayWorkoutDate } from '../workouts/workoutDate';

export default function WorkoutList({ header, footer }: { header: ReactElement; footer?: ReactElement }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { token, signOut } = useSession();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const failedCursor = useRef<string | undefined>(undefined);
  const active = useRef(false);

  const load = useCallback(async (cursor?: string) => {
    if (!token) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    failedCursor.current = cursor;
    setLoading(true); setRefreshing(cursor === undefined); setError(null);
    try {
      const page = await listWorkouts(token, controller.signal, cursor);
      if (!active.current || controller.signal.aborted) return;
      setWorkouts((previous) => cursor
        ? [...previous, ...page.workouts.filter((item) => !previous.some((old) => old.id === item.id))]
        : page.workouts);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (!active.current || controller.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        try { await signOut(); }
        catch { if (active.current) setError('Сесія завершилася. Не вдалося вийти з акаунта; спробуй ще раз.'); }
      } else {
        setError(cause instanceof WorkoutApiError ? cause.message : 'Не вдалося завантажити тренування. Перевір інтернет і спробуй ще раз.');
      }
    } finally {
      if (active.current && request.current === controller) { setLoading(false); setRefreshing(false); }
    }
  }, [token, signOut]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void load();
    return () => { active.current = false; request.current?.abort(); };
  }, [load]));

  return (
    <FlatList
      testID="workout-list"
      data={workouts}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.container}
      ListHeaderComponent={header}
      refreshing={refreshing && workouts.length > 0}
      onRefresh={() => void load()}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} accessibilityRole="button" accessibilityLabel={`Відкрити тренування ${item.title}`}
          onPress={() => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: String(item.id) } })}>
          <View style={styles.icon}><AppIcon name="dumbbell" /></View>
          <View style={styles.cardContent}><Text style={styles.name}>{item.title}</Text>
            <Text style={styles.date}>{displayWorkoutDate(item.date)}</Text>
            <Text style={[styles.date, item.completedAt && { color: colors.accentText }]}>{item.completedAt ? '✓ Виконано' : 'Не завершено'}</Text>
            {!!item.notes && <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>}
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={!loading && !error ? (
        <View style={styles.empty}>
          <Text style={styles.name}>Тренувань ще немає</Text>
          <Text style={styles.notes}>Створи перше тренування — воно збережеться у твоєму акаунті.</Text>
        </View>
      ) : undefined}
      ListFooterComponent={(
        <View>
          {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Завантаження тренувань" style={styles.progress} />}
          {error && <View style={styles.empty}>
            <Text style={styles.error} accessibilityRole="alert">{error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void load(failedCursor.current)} style={styles.button}>
              <Text style={styles.buttonText}>Повторити завантаження</Text>
            </TouchableOpacity>
          </View>}
          {!loading && !error && nextCursor && <TouchableOpacity accessibilityRole="button" onPress={() => void load(nextCursor)} style={styles.button}>
            <Text style={styles.buttonText}>Показати ще</Text>
          </TouchableOpacity>}
          {footer}
        </View>
      )}
    />
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 28, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 14, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 48, borderRadius: 12, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, gap: 5 },
  chevron: { color: colors.muted, fontSize: 30 },
  date: { color: colors.muted, fontSize: 14 },
  name: { color: colors.text, fontWeight: '600', fontSize: 18 },
  notes: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  empty: { paddingVertical: 24, gap: 12 },
  error: { color: colors.error, fontSize: 16, lineHeight: 23 },
  button: { padding: 16, alignItems: 'center', borderRadius: 10, backgroundColor: colors.raised },
  buttonText: { color: colors.text, fontWeight: 'bold', fontSize: 16 },
  progress: { marginVertical: 24 },
});
