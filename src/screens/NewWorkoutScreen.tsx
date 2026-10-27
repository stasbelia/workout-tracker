import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useSession } from '../auth/SessionProvider';
import { createWorkout, parseWorkoutId, WorkoutApiError, WorkoutDraft } from '../workouts/workoutApi';
import { createFromWorkoutTemplate, getWorkoutTemplate, WorkoutTemplate } from '../workouts/workoutTemplates';
import { displayWorkoutDate, parseWorkoutDate, todayWorkoutDate } from '../workouts/workoutDate';

export default function NewWorkoutScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{templateId?: string | string[]}>();
  const templateId = parseWorkoutId(params.templateId);
  const fromTemplate = params.templateId !== undefined;
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(fromTemplate);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateAttempt, setTemplateAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const { token, signOut } = useSession();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => displayWorkoutDate(todayWorkoutDate()));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<WorkoutDraft | null>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(false);
  const busy = useRef(false);

  useFocusEffect(useCallback(() => {
    active.current = true;
    const operation = new AbortController();
    if (fromTemplate) {
      setTemplateLoading(true); setTemplateError(null);
      void (async () => {
        try {
          if (!templateId) throw new WorkoutApiError('Некоректний номер шаблону.', 400);
          if (!token) return;
          const saved = await getWorkoutTemplate(token, templateId, operation.signal);
          if (active.current && !operation.signal.aborted) { setTemplate(saved); setTitle(saved.name); setNotes(saved.notes); }
        } catch (cause) {
          if (!active.current || operation.signal.aborted) return;
          if (cause instanceof WorkoutApiError && cause.status === 401) await signOut().catch(() => setTemplateError('Не вдалося завершити сесію.'));
          else setTemplateError(cause instanceof WorkoutApiError && [400,404].includes(cause.status ?? 0) ? cause.message : 'Не вдалося завантажити шаблон тренування.');
        } finally { if (active.current && !operation.signal.aborted) setTemplateLoading(false); }
      })();
    }
    return () => { active.current = false; operation.abort(); controller.current?.abort(); };
  // Retry changes callback identity so useFocusEffect reloads; it is not API input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTemplate, templateId, token, signOut, templateAttempt]));

  async function save() {
    if (!token || busy.current || unavailable || (fromTemplate && !template)) return;
    const parsedDate = parseWorkoutDate(date);
    if (!title.trim() || title.trim().length > 100 || /\p{Cc}/u.test(title)) {
      setError('Введи назву тренування: від 1 до 100 символів.'); return;
    }
    if (!parsedDate) { setError('Введи справжню дату у форматі ДД.ММ.РРРР (1900–2100).'); return; }
    if (notes.trim().length > 500) { setError('Нотатка має містити не більше 500 символів.'); return; }
    busy.current = true;
    setSaving(true); setError(null);
    const operation = new AbortController();
    controller.current = operation;
    try {
      // До підтвердження використовуємо той самий ключ і незмінний текст.
      pending.current ??= { title: title.trim(), date: parsedDate, notes: notes.trim(), clientRequestId: randomUUID() };
      const saved = fromTemplate && templateId
        ? await createFromWorkoutTemplate(token, templateId, pending.current, operation.signal)
        : await createWorkout(token, pending.current, operation.signal);
      if (active.current && !operation.signal.aborted) {
        if (fromTemplate) router.replace({ pathname: '/workouts/[workoutId]', params: { workoutId: String(saved.id) } });
        else router.dismissTo('/');
      }
    } catch (cause) {
      if (!active.current || operation.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        try { await signOut(); }
        catch { setError('Сесія завершилася. Не вдалося вийти; спробуй ще раз.'); }
      } else if (fromTemplate && cause instanceof WorkoutApiError && cause.status === 404) {
        setUnavailable(true); setError('Шаблон більше недоступний. Повернися до списку й обери інший.');
      } else if (cause instanceof WorkoutApiError && [400, 413, 429].includes(cause.status ?? 0)) {
        pending.current = null; setUncertain(false); setError(cause.message);
      } else {
        setUncertain(true);
        setError('Не вдалося підтвердити збереження. Повтори запит або повернися до списку й перевір, чи тренування вже з’явилося.');
      }
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  }

  if (fromTemplate && (templateLoading || templateError)) return <View style={styles.templateState}>
    {templateLoading ? <ActivityIndicator color={colors.accentText} accessibilityLabel="Завантаження шаблону тренування"/> : <>
      <Text style={styles.error} accessibilityRole="alert">{templateError}</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setTemplateAttempt(n=>n+1)}><Text style={styles.buttonText}>Повторити завантаження шаблону</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.cancel} onPress={()=>router.dismissTo('/workout-templates')}><Text style={styles.cancelText}>До шаблонів тренувань</Text></TouchableOpacity>
    </>}
  </View>;
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{template ? `Із шаблону «${template.name}». Вправ: ${template.exerciseCount}, підходів: ${template.setCount}. Обери дату нового тренування.` : 'Заплануй тренування або збережи те, що вже відбулося.'}</Text>
        {template && <View style={styles.preview}>{(showAllExercises ? template.exercises : template.exercises.slice(0,3)).map((exercise,index)=><Text key={index} style={styles.previewText}>{index+1}. {exercise.name} · {exercise.sets.length} підх.</Text>)}{template.exercises.length>3&&<TouchableOpacity accessibilityRole="button" style={styles.previewToggle} onPress={()=>setShowAllExercises(value=>!value)}><Text style={styles.previewLink}>{showAllExercises?'Згорнути вправи':`Показати всі вправи (${template.exercises.length})`}</Text></TouchableOpacity>}</View>}
        <Text style={styles.label}>Назва</Text>
        <TextInput accessibilityLabel="Назва тренування" placeholder="Наприклад, Верх тіла" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle}
          style={styles.input} maxLength={100} editable={!saving && !uncertain && !unavailable} returnKeyType="next" />
        <Text style={styles.label}>Дата</Text>
        <TextInput accessibilityLabel="Дата тренування" placeholder="ДД.ММ.РРРР" placeholderTextColor={colors.muted} value={date} onChangeText={setDate}
          style={styles.input} maxLength={10} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} autoCorrect={false} editable={!saving && !uncertain && !unavailable} />
        <Text style={styles.hint}>Формат: 23.10.2026</Text>
        <Text style={styles.label}>Нотатка · необов’язково</Text>
        <TextInput accessibilityLabel="Нотатка до тренування" placeholder="Самопочуття, ціль або короткий план" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes}
          style={[styles.input, styles.notes]} maxLength={500} multiline textAlignVertical="top" editable={!saving && !uncertain && !unavailable} />
        <Text style={styles.hint}>{notes.length}/500</Text>
        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} onPress={() => void save()} disabled={saving || unavailable}
          style={[styles.button, saving && styles.disabled]}>
          <Text style={styles.buttonText}>{saving ? 'Зберігаємо…' : uncertain ? 'Повторити збереження' : 'Зберегти тренування'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.dismissTo('/')} disabled={saving} style={styles.cancel}>
          <Text style={styles.cancelText}>До списку тренувань</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  templateState: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 16 },
  preview: { padding: 16, backgroundColor: colors.surface, borderRadius: 14, gap: 9, marginBottom: 22 },
  previewToggle: { paddingVertical: 10, minHeight: 44 },
  previewLink: { color: colors.accentText, fontWeight: '600', fontSize: 14 },
  previewText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 48 },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 24 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 10, padding: 15, fontSize: 17, marginBottom: 8 },
  notes: { minHeight: 120 },
  hint: { color: colors.muted, marginBottom: 24 },
  error: { color: colors.error, fontSize: 16, lineHeight: 23, marginBottom: 16 },
  button: { backgroundColor: colors.accent, padding: 17, alignItems: 'center', borderRadius: 10, marginTop: 8 },
  buttonText: { color: colors.ink, fontSize: 17, fontWeight: 'bold' },
  disabled: { opacity: 0.6 },
  cancel: { padding: 18, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 16 },
});
