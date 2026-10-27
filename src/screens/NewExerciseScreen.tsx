import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/SessionProvider';
import { createExercise, getWorkout, updateExercise, ExerciseEdit, ExerciseDraft, parseWorkoutId, WorkoutApiError } from '../workouts/workoutApi';
import { parseExerciseInput, SetInput } from '../workouts/exerciseDraft';
import ExerciseLibrary from '../components/ExerciseLibrary';
import SaveExerciseTemplate from '../components/SaveExerciseTemplate';
import type { ExerciseTemplate } from '../workouts/exerciseTemplates';

export default function NewExerciseScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ workoutId?: string | string[]; exerciseId?: string | string[] }>();
  const id = parseWorkoutId(params.workoutId);
  const editing = params.exerciseId !== undefined;
  const exerciseId = parseWorkoutId(params.exerciseId);
  const [revision,setRevision] = useState<number | null>(null);
  const [loading,setLoading] = useState(editing);
  const [loadError,setLoadError] = useState<string | null>(null);
  const [attempt,setAttempt] = useState(0);
  const [conflict,setConflict] = useState(false);
  const editPending = useRef<ExerciseEdit | null>(null);
  const router = useRouter();
  const { token, signOut } = useSession();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [sets, setSets] = useState<SetInput[]>([{ key: 1, reps: '', weight: '' }]);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const templateBusyRef = useRef(false);
  const onTemplateBusy = useCallback((value: boolean) => { templateBusyRef.current = value; setTemplateBusy(value); }, []);
  const nextKey = useRef(1);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const revealSet = useRef<number | null>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<ExerciseDraft | null>(null);
  const editable = !saving && !uncertain && !unavailable && !templateBusy && !loading && !conflict;

  useFocusEffect(useCallback(() => {
    active.current = true;
    const operation = new AbortController();
    if (editing) {
      setLoading(true);setLoadError(null);setConflict(false);setUncertain(false);setSaving(false);busy.current=false;pending.current=null;editPending.current=null;
      void (async () => {
        try {
          if (!id || !exerciseId) throw new WorkoutApiError('Некоректний номер вправи.',400);
          if (!token) return;
          const detail = await getWorkout(token,id,operation.signal);
          const exercise = detail.exercises.find(e => e.id === exerciseId);
          if (!exercise) throw new WorkoutApiError('Вправу не знайдено.',404);
          if (active.current && !operation.signal.aborted) {
            setName(exercise.name);setNotes(exercise.notes);setRevision(exercise.revision);
            setSets(exercise.sets.map(set=>({key:++nextKey.current,reps:String(set.reps),weight:set.weightKg===null?'':String(set.weightKg).replace('.',',')})));
          }
        } catch(cause) {
          if (!active.current || operation.signal.aborted) return;
          if(cause instanceof WorkoutApiError && cause.status===401) await signOut().catch(()=>setLoadError('Увійди повторно.'));
          else setLoadError(cause instanceof WorkoutApiError?cause.message:'Не вдалося завантажити вправу.');
        } finally { if(active.current&&!operation.signal.aborted)setLoading(false); }
      })();
    }
    return () => { active.current = false; operation.abort(); controller.current?.abort(); };
  // Retry changes callback identity so useFocusEffect reloads; it is not API input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing,id,exerciseId,token,signOut,attempt]));

  function goBack() {
    if (!id || unavailable) { router.dismissTo('/'); return; }
    router.dismissTo({ pathname: '/workouts/[workoutId]', params: { workoutId: String(id) } });
  }

  function changeSet(key: number, field: 'reps' | 'weight', value: string) {
    setSets((previous) => previous.map((set) => set.key === key ? { ...set, [field]: value } : set));
  }

  function addSet() {
    const key = ++nextKey.current;
    revealSet.current = key;
    setSets((previous) => previous.length < 30 ? [...previous, { key, reps: previous.at(-1)?.reps ?? '', weight: previous.at(-1)?.weight ?? '' }] : previous);
  }

  function applyTemplate(template: ExerciseTemplate) {
    setName(template.name); setNotes(template.notes);
    setSets(template.sets.map((set) => ({ key: ++nextKey.current, reps: String(set.reps), weight: set.weightKg === null ? '' : String(set.weightKg).replace('.', ',') })));
    setError(null);
  }

  async function save() {
    if (!id || !token || busy.current || unavailable || templateBusyRef.current || conflict || loading || (editing && revision === null)) return;
    const input = parseExerciseInput(name, notes, sets);
    if (typeof input === 'string') { setError(input); return; }
    busy.current = true; setSaving(true); setError(null);
    const operation = new AbortController(); controller.current = operation;
    try {
      pending.current ??= { ...input, clientRequestId: randomUUID() };
      if (editing && exerciseId && revision !== null) {
        editPending.current ??= {...input,expectedRevision:revision};
        await updateExercise(token,id,exerciseId,editPending.current,operation.signal);
      } else await createExercise(token, id, pending.current, operation.signal);
      if (active.current && !operation.signal.aborted) goBack();
    } catch (cause) {
      if (!active.current || operation.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        try { await signOut(); }
        catch { setError('Сесія завершилася. Не вдалося вийти; спробуй ще раз.'); }
      } else if (cause instanceof WorkoutApiError && cause.status === 404) {
        setUnavailable(true); setError('Тренування не знайдено. Повернися до списку тренувань.');
      } else if (editing && cause instanceof WorkoutApiError && cause.status === 409) {
        setConflict(true);setError(cause.message);
      } else if (cause instanceof WorkoutApiError && [400, 413, 429].includes(cause.status ?? 0)) {
        pending.current = null; editPending.current = null; setUncertain(false); setError(cause.message);
      } else {
        setUncertain(true);
        setError(cause instanceof WorkoutApiError && cause.status === 409 ? cause.message : 'Не вдалося підтвердити збереження. Повтори той самий запит або перевір список вправ у тренуванні.');
      }
    } finally { if (controller.current === operation) { busy.current = false; if (active.current) setSaving(false); } }
  }

  if (!id) return <View style={styles.invalid}>
    <Text style={styles.error} accessibilityRole="alert">Некоректний номер тренування.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={goBack} style={styles.button}><Text style={styles.buttonText}>До списку тренувань</Text></TouchableOpacity>
  </View>;

  if (editing && (loading || loadError)) return <View style={styles.invalid}>
    {loading ? <ActivityIndicator accessibilityLabel="Завантаження вправи для редагування" color={colors.accentText}/> : <>
      <Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setAttempt(n=>n+1)}><Text style={styles.buttonText}>Перечитати вправу</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={goBack}><Text style={styles.hint}>До тренування</Text></TouchableOpacity>
    </>}
  </View>;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
        <ScrollView ref={scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {editing && <Text style={styles.hint}>Зміни назву, вагу й повторення або прибери зайвий підхід. Зміни застосуються після збереження.</Text>}
          <Text style={styles.label}>Вправа</Text>
          <ExerciseLibrary name={name} notes={notes} sets={sets} disabled={!editable} onName={setName} onTemplate={applyTemplate}
            onBusy={onTemplateBusy} />
          <Text style={styles.section} accessibilityRole="header">Підходи</Text>
          <Text style={styles.hint}>Новий підхід копіює повторення й вагу попереднього. Значення можна змінити, а вагу — залишити невказаною.</Text>
          <View style={styles.setHeading}><Text style={styles.numberHeading}>№</Text><Text style={styles.columnHeading}>Повторення</Text><Text style={styles.columnHeading}>Вага, кг</Text><View style={{ width: 40 }} /></View>
          {sets.map((set, index) => <View key={set.key} style={styles.setRow} onLayout={(event) => {
            if (revealSet.current === set.key) {
              revealSet.current = null;
              scroll.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 160), animated: true });
            }
          }}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{index + 1}</Text></View>
            <TextInput accessibilityLabel={`Повторення, підхід ${index + 1}`} value={set.reps} onChangeText={(value) => changeSet(set.key, 'reps', value)}
              editable={editable} maxLength={4} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.muted} style={styles.setInput} />
            <TextInput accessibilityLabel={`Вага в кілограмах, підхід ${index + 1}`} value={set.weight} onChangeText={(value) => changeSet(set.key, 'weight', value)}
              editable={editable} maxLength={7} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.muted} style={styles.setInput} />
            {sets.length > 1 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Прибрати підхід ${index + 1}`} disabled={!editable} style={styles.remove}
              onPress={() => setSets((previous) => previous.filter((item) => item.key !== set.key))}><Text style={styles.removeText}>×</Text></TouchableOpacity> : <View style={{ width: 40 }} />}
          </View>)}
          <Text style={styles.label}>Нотатка · необов’язково</Text>
          <TextInput accessibilityLabel="Нотатка до вправи" value={notes} onChangeText={setNotes} editable={editable} maxLength={500} multiline textAlignVertical="top"
            placeholder="Наприклад, пауза в нижній точці" placeholderTextColor={colors.muted} style={[styles.input, styles.notes]} />
          <SaveExerciseTemplate name={name} notes={notes} sets={sets} disabled={!editable} onBusy={onTemplateBusy} />
          {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          {conflict && <><TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setAttempt(n=>n+1)}><Text style={styles.buttonText}>Перечитати вправу</Text></TouchableOpacity><Text style={styles.hint}>Це замінить поля форми даними із сервера.</Text></>}
          <TouchableOpacity accessibilityRole="button" disabled={saving || templateBusy} onPress={goBack} style={styles.back}><Text style={styles.hint}>{unavailable ? 'До списку тренувань' : 'До тренування'}</Text></TouchableOpacity>
        </ScrollView>
        {!unavailable && !conflict && <View style={styles.actionBar}>
          {sets.length < 30 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="+ Додати підхід" disabled={!editable}
            style={[styles.quickAdd, !editable && styles.disabled]} onPress={addSet}><Text style={styles.quickAddText}>＋ Підхід</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={saving ? 'Зберігаємо…' : uncertain ? 'Повторити збереження' : editing ? 'Зберегти зміни вправи' : 'Зберегти вправу'}
            accessibilityState={{ disabled: saving || templateBusy, busy: saving || templateBusy }} disabled={saving || templateBusy} onPress={() => void save()}
            style={[styles.saveAction, (saving || templateBusy) && styles.disabled]}><Text style={styles.saveActionText}>{saving ? 'Зберігаємо…' : uncertain ? 'Повторити' : editing ? 'Зберегти зміни вправи' : 'Зберегти вправу'}</Text></TouchableOpacity>
        </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 48, gap: 12 },
  label: { color: colors.text, fontSize: 17, fontWeight: '600' },
  setHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  numberHeading: { width: 32, textAlign: 'center', color: colors.muted, fontSize: 13 },
  columnHeading: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 13 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  numberText: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  setInput: { flex: 1, minWidth: 0, textAlign: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, fontSize: 19, fontWeight: '600' },
  actionBar: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  quickAdd: { minWidth: 112, paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 14 },
  quickAddText: { color: colors.accentText, fontSize: 16, fontWeight: '600' },
  saveAction: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 14 },
  saveActionText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  section: { color: colors.text, fontSize: 23, fontWeight: 'bold', marginTop: 16 },
  hint: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 10, padding: 15, fontSize: 17 },
  notes: { minHeight: 100 },
  button: { backgroundColor: colors.accent, padding: 17, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: colors.ink, fontSize: 17, fontWeight: 'bold' },
  remove: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.muted, fontSize: 26 },
  back: { padding: 16, alignItems: 'center' },
  error: { color: colors.error, fontSize: 16, lineHeight: 23 },
  disabled: { opacity: 0.6 },
  invalid: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.background },
});
