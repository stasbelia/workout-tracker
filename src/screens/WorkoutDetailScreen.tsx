import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/SessionProvider';
import { getWorkout, parseWorkoutId, WorkoutApiError, WorkoutDetail } from '../workouts/workoutApi';
import { displayWorkoutDate } from '../workouts/workoutDate';
import SaveExerciseTemplate from '../components/SaveExerciseTemplate';
import SaveWorkoutTemplate from '../components/SaveWorkoutTemplate';
import WorkoutCompletion from '../components/WorkoutCompletion';
import DeleteWorkoutRecord from '../components/DeleteWorkoutRecord';

const ignoreBusy = () => {};

export default function WorkoutDetailScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ workoutId?: string | string[] }>();
  const id = parseWorkoutId(params.workoutId);
  const router = useRouter();
  const { token, signOut } = useSession();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null); setDetail(null);
    try {
      if (!id) throw new WorkoutApiError('Некоректний номер тренування.', 400);
      if (!token) return;
      const data = await getWorkout(token, id, controller.signal);
      if (active.current && !controller.signal.aborted) setDetail(data);
    } catch (cause) {
      if (!active.current || controller.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        try { await signOut(); }
        catch { if (active.current) setError('Сесія завершилася. Не вдалося вийти; спробуй ще раз.'); }
      } else {
        setError(cause instanceof WorkoutApiError ? cause.message : 'Не вдалося завантажити тренування. Перевір інтернет і спробуй ще раз.');
      }
    } finally { if (active.current && request.current === controller) setLoading(false); }
  }, [id, token, signOut]);

  useFocusEffect(useCallback(() => {
    active.current = true; void load();
    return () => { active.current = false; request.current?.abort(); };
  }, [load]));

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {detail ? <FlatList
        data={detail.exercises}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.container}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.date}>{displayWorkoutDate(detail.workout.date)}</Text>
            <Text style={styles.title} accessibilityRole="header">{detail.workout.title}</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.edit} onPress={()=>router.push({pathname:'/workouts/[workoutId]/edit',params:{workoutId:String(id)}})}><Text style={styles.editText}>Редагувати тренування</Text></TouchableOpacity>
            {!!detail.workout.notes && <Text style={styles.notes}>{detail.workout.notes}</Text>}
            <WorkoutCompletion workout={detail.workout} hasExercises={detail.exercises.length > 0}
              onChange={workout => setDetail(previous => previous ? { ...previous, workout } : null)} />
            <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push({
              pathname: '/workouts/[workoutId]/exercises/new', params: { workoutId: String(id) },
            })}>
              <Text style={styles.buttonText}>+ Додати вправу</Text>
            </TouchableOpacity>
            {detail.exercises.length>0 && <SaveWorkoutTemplate workoutId={detail.workout.id} title={detail.workout.title} />}
            <Text style={styles.section} accessibilityRole="header">Вправи · {detail.exercises.length}</Text>
          </View>
        )}
        ListFooterComponent={<DeleteWorkoutRecord workout={detail.workout} onDeleted={()=>router.dismissTo('/')} onReload={()=>void load()} />}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.name}>Вправ ще немає</Text>
            <Text style={styles.notes}>Додай першу вправу та її підходи.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.position}. {item.name}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Редагувати вправу ${item.name}`} style={styles.edit} onPress={()=>router.push({pathname:'/workouts/[workoutId]/exercises/[exerciseId]/edit',params:{workoutId:String(id),exerciseId:String(item.id)}})}><Text style={styles.editText}>Редагувати вправу й підходи</Text></TouchableOpacity>
            {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            {item.sets.map((set) => <View key={set.position} style={styles.set}>
              <Text style={styles.setNumber}>Підхід {set.position}</Text>
              <Text style={styles.setValue}>{set.reps} повтор. · {set.weightKg === null ? 'вага не вказана' : `${String(set.weightKg).replace('.', ',')} кг`}</Text>
            </View>)}
            <SaveExerciseTemplate compact name={item.name} notes={item.notes} disabled={false} onBusy={ignoreBusy}
              sets={item.sets.map((set) => ({ key: set.position, reps: String(set.reps), weight: set.weightKg === null ? '' : String(set.weightKg) }))} />
            <DeleteWorkoutRecord workout={detail.workout} exercise={item} onDeleted={()=>void load()} onReload={()=>void load()} />
          </View>
        )}
      /> : <View style={styles.state}>
        {loading && <ActivityIndicator color={colors.accentText} accessibilityLabel="Завантаження вправ" />}
        {error && <>
          <Text style={styles.error} accessibilityRole="alert">{error}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>Повторити завантаження</Text></TouchableOpacity>
        </>}
        {!loading && <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => router.dismissTo('/')}><Text style={styles.notes}>До списку тренувань</Text></TouchableOpacity>}
      </View>}
    </SafeAreaView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  edit:{minHeight:44,paddingVertical:10,justifyContent:'center'},editText:{color:colors.accentText,fontSize:14,fontWeight:'600'},
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, gap: 14 },
  header: { gap: 12, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: 'bold' },
  date: { color: colors.accentText, fontSize: 16 },
  notes: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  section: { color: colors.text, fontSize: 21, fontWeight: 'bold', marginTop: 12 },
  name: { color: colors.text, fontSize: 19, fontWeight: 'bold' },
  card: { padding: 18, backgroundColor: colors.surface, borderRadius: 14, gap: 12 },
  set: { gap: 4, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  setNumber: { color: colors.muted, fontSize: 14 },
  setValue: { color: colors.text, fontSize: 17 },
  empty: { paddingVertical: 24, gap: 12 },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  state: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  error: { color: colors.error, fontSize: 16, lineHeight: 23 },
  back: { padding: 16, alignItems: 'center' },
});
