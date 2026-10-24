import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { getWorkout, parseWorkoutId, updateWorkout, Workout, WorkoutApiError, WorkoutEdit } from '../workouts/workoutApi';
import { displayWorkoutDate, parseWorkoutDate, todayWorkoutDate } from '../workouts/workoutDate';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{workoutId?: string | string[]}>();
  const id = parseWorkoutId(workoutId), { token, signOut } = useSession(), router = useRouter();
  const styles = useThemedStyles(createStyles), { colors } = useTheme();
  const [workout, setWorkout] = useState<Workout | null>(null), [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(''), [date, setDate] = useState(''), [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const active = useRef(false), busy = useRef(false), operation = useRef<AbortController | null>(null), pending = useRef<WorkoutEdit | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true; const controller = new AbortController(); operation.current = controller;
    pending.current = null; busy.current = false; setSaving(false); setUncertain(false); setConflict(false); setLoading(true); setError(null); setWorkout(null);
    void (async () => {
      try {
        if (!id) throw new WorkoutApiError('Некоректний номер тренування.', 400);
        if (!token) return;
        const detail = await getWorkout(token, id, controller.signal);
        if (!controller.signal.aborted && active.current) { setWorkout(detail.workout); setTitle(detail.workout.title); setDate(displayWorkoutDate(detail.workout.date)); setNotes(detail.workout.notes); }
      } catch (cause) {
        if (controller.signal.aborted || !active.current) return;
        if (cause instanceof WorkoutApiError && cause.status === 401) await signOut().catch(() => setError('Увійди повторно.'));
        else setError(cause instanceof WorkoutApiError ? cause.message : 'Не вдалося завантажити тренування.');
      } finally { if (!controller.signal.aborted && active.current) setLoading(false); }
    })();
    return () => { active.current = false; operation.current?.abort(); };
  }, [id, token, signOut, attempt]));
  const back = () => id ? router.dismissTo({ pathname: '/workouts/[workoutId]', params: { workoutId: String(id) } }) : router.dismissTo('/');
  async function save() {
    if (!token || !id || !workout || busy.current || conflict) return;
    const parsed = parseWorkoutDate(date);
    if (!title.trim() || title.trim().length > 100 || /\p{Cc}/u.test(title)) { setError('Введи назву: 1–100 символів.'); return; }
    if (!parsed) { setError('Введи справжню дату у форматі ДД.ММ.РРРР.'); return; }
    if (notes.trim().length > 500 || /[^\P{Cc}\n\t]/u.test(notes)) { setError('Перевір нотатку: до 500 символів.'); return; }
    pending.current ??= { title: title.trim(), date: parsed, notes: notes.trim(), expectedRevision: workout.revision, today: todayWorkoutDate() };
    const controller = new AbortController(); operation.current = controller; busy.current = true; setSaving(true); setError(null);
    try {
      await updateWorkout(token, id, pending.current, controller.signal);
      if (active.current && !controller.signal.aborted) back();
    } catch (cause) {
      if (!active.current || controller.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) await signOut().catch(() => setError('Увійди повторно.'));
      else if (cause instanceof WorkoutApiError && [409,404].includes(cause.status ?? 0)) { setConflict(true); setError(cause.message); }
      else if (cause instanceof WorkoutApiError && [400,413,429].includes(cause.status ?? 0)) { pending.current = null; setUncertain(false); setError(cause.message); }
      else { setUncertain(true); setError('Не вдалося підтвердити зміну. Повтори збереження або перевір тренування.'); }
    } finally { if (operation.current === controller) { busy.current = false; if (active.current) setSaving(false); } }
  }
  const editable = !saving && !uncertain && !conflict;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator accessibilityLabel="Завантаження тренування для редагування" color={colors.accentText}/> : workout && <>
        <Text style={styles.hint}>Зміни назву, дату або нотатку. Вправи й підходи залишаться.</Text>
        <Text style={styles.label}>Назва</Text><TextInput accessibilityLabel="Назва тренування" style={styles.input} value={title} onChangeText={setTitle} editable={editable} maxLength={100}/>
        <Text style={styles.label}>Дата</Text><TextInput accessibilityLabel="Дата тренування" style={styles.input} value={date} onChangeText={setDate} editable={editable} maxLength={10} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}/>
        <Text style={styles.hint}>ДД.ММ.РРРР. Дата виконаного тренування змінить його день у календарі.</Text>
        <Text style={styles.label}>Нотатка</Text><TextInput accessibilityLabel="Нотатка до тренування" style={[styles.input,styles.notes]} value={notes} onChangeText={setNotes} editable={editable} multiline maxLength={500}/>
        {!conflict && <TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => void save()}><Text style={styles.buttonText}>{saving ? 'Зберігаємо…' : uncertain ? 'Повторити збереження' : 'Зберегти зміни'}</Text></TouchableOpacity>}
      </>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!loading && (!workout || conflict) && <><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => setAttempt(n => n+1)}><Text style={styles.buttonText}>Перечитати тренування</Text></TouchableOpacity>{workout && <Text style={styles.hint}>Це замінить текст форми даними із сервера.</Text>}</>}
      <TouchableOpacity accessibilityRole="button" style={styles.back} disabled={saving} onPress={back}><Text style={styles.hint}>До тренування</Text></TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},container:{padding:24,paddingBottom:48,gap:14},label:{color:colors.text,fontSize:16,fontWeight:'600'},
  input:{backgroundColor:colors.surface,color:colors.text,padding:16,borderRadius:12,borderWidth:1,borderColor:colors.border,fontSize:17},notes:{minHeight:100,textAlignVertical:'top'},
  hint:{color:colors.muted,fontSize:14,lineHeight:21},error:{color:colors.error,fontSize:15,lineHeight:22},button:{padding:16,borderRadius:12,backgroundColor:colors.accent,alignItems:'center'},buttonText:{color:colors.ink,fontSize:16,fontWeight:'600'},back:{padding:16,alignItems:'center'},
});
