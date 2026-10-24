import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useSession } from '../auth/SessionProvider';
import { parseExerciseInput, SetInput } from '../workouts/exerciseDraft';
import { saveTemplate } from '../workouts/exerciseTemplates';
import { WorkoutApiError } from '../workouts/workoutApi';

type Props = { name: string; notes: string; sets: SetInput[]; disabled: boolean; onBusy: (busy: boolean) => void; compact?: boolean };
export default function SaveExerciseTemplate({ name, notes, sets, disabled, onBusy, compact = false }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { token, signOut } = useSession();
  const [saving, setSaving] = useState(false), [message, setMessage] = useState<string | null>(null);
  const active = useRef(false), busy = useRef(false), controller = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true; controller.current?.abort(); controller.current = null; busy.current = false; setSaving(false);
    return () => { active.current = false; controller.current?.abort(); onBusy(false); };
  }, [onBusy]));
  async function save() {
    if (!token || disabled || busy.current) return;
    const input = parseExerciseInput(name, notes, sets);
    if (typeof input === 'string') { setMessage(input); return; }
    busy.current = true; setSaving(true); setMessage(null); onBusy(true);
    const operation = new AbortController(); controller.current = operation;
    try {
      const saved = await saveTemplate(token, { ...input, clientRequestId: randomUUID() }, operation.signal);
      if (active.current && !operation.signal.aborted) setMessage(`Шаблон «${saved.name}» збережено. Він доступний у «Моїх шаблонах».`);
    } catch (cause) {
      if (!active.current || operation.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status === 401) {
        try { await signOut(); } catch { if (active.current) setMessage('Сесія завершилася. Не вдалося вийти; спробуй ще раз.'); }
      } else {
        setMessage(cause instanceof WorkoutApiError && [400, 409, 413, 429].includes(cause.status ?? 0) ? cause.message :
          'Не вдалося підтвердити збереження шаблону. Повтори з тими самими даними або перевір «Мої шаблони».');
      }
    } finally { if (controller.current === operation) { busy.current = false; if (active.current) { setSaving(false); onBusy(false); } } }
  }
  return <View style={styles.container}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || saving, busy: saving }} disabled={disabled || saving} onPress={() => void save()} style={[styles.button, compact && styles.compact, disabled && styles.disabled]}>
      <Text style={styles.label}>{saving ? 'Зберігаємо шаблон…' : 'Зберегти вправу як шаблон'}</Text>
    </TouchableOpacity>
    {!compact && <Text style={styles.hint}>Збереже назву, нотатку й підходи для наступних тренувань.</Text>}
    {message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
  </View>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  container: { gap: 8 }, button: { padding: 16, borderRadius: 10, backgroundColor: colors.raised, alignItems: 'center' },
  compact: { alignSelf: 'flex-start', paddingHorizontal: 0, paddingVertical: 12, backgroundColor: 'transparent' },
  label: { color: colors.accentText, fontSize: 16, fontWeight: '600' }, hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22 }, disabled: { opacity: 0.6 },
});
