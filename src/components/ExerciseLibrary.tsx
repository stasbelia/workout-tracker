import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { exerciseCatalogue } from '../workouts/exerciseCatalogue';
import { SetInput } from '../workouts/exerciseDraft';
import { deleteTemplate, ExerciseTemplate, listTemplates } from '../workouts/exerciseTemplates';
import { WorkoutApiError } from '../workouts/workoutApi';

type Props = {
  name: string; notes: string; sets: SetInput[]; disabled: boolean;
  onName: (name: string) => void; onTemplate: (template: ExerciseTemplate) => void;
  onBusy: (busy: boolean) => void;
};
type Choice = { key: string; name: string; detail: string; template?: ExerciseTemplate };
const normalize = (text: string) => text.toLocaleLowerCase('uk').normalize('NFC').trim();
export default function ExerciseLibrary(props: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { token, signOut } = useSession();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<'basic' | 'mine'>('basic');
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<ExerciseTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: 'apply' | 'delete'; template: ExerciseTemplate } | null>(null);
  const active = useRef(false), busy = useRef(false), opened = useRef(false);
  const focusManual = useRef(false);
  const nameInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const readController = useRef<AbortController | null>(null), writeController = useRef<AbortController | null>(null);
  const { onBusy } = props;
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => {
      active.current = false; opened.current = false;
      readController.current?.abort(); writeController.current?.abort();
      onBusy(false);
    };
  }, [onBusy]));

  async function report(cause: unknown, fallback: string) {
    if (cause instanceof WorkoutApiError && cause.status === 401) {
      try { await signOut(); } catch { return 'Сесія завершилася. Не вдалося вийти; спробуй ще раз.'; }
      return 'Сесія завершилася. Увійди повторно.';
    }
    return cause instanceof WorkoutApiError && [400, 409, 413, 429].includes(cause.status ?? 0) ? cause.message : fallback;
  }
  async function load() {
    if (!token) return;
    readController.current?.abort(); const operation = new AbortController(); readController.current = operation;
    setLoading(true); setLoadError(null); setTemplates([]);
    try {
      const items = await listTemplates(token, operation.signal);
      if (active.current && opened.current && !operation.signal.aborted) setTemplates(items);
    } catch (cause) {
      if (active.current && opened.current && !operation.signal.aborted) {
        const text = await report(cause, 'Не вдалося завантажити шаблони. Базові вправи й власна назва доступні.');
        if (active.current && !operation.signal.aborted) setLoadError(text);
      }
    } finally { if (active.current && !operation.signal.aborted) setLoading(false); }
  }
  function open() {
    focusManual.current = false;
    Keyboard.dismiss(); setSearch(''); setTab('basic'); setConfirmation(null); setMessage(null);
    opened.current = true; setVisible(true); void load();
  }
  function close() {
    if (busy.current) return;
    readController.current?.abort(); opened.current = false; setVisible(false); setTemplates([]); setConfirmation(null);
  }
  function choose(item: Choice) {
    if (busy.current) return;
    const dirty = props.name.trim() || props.notes.trim() || props.sets.some((set) => set.reps.trim() || set.weight.trim());
    if (item.template && dirty) { Keyboard.dismiss(); setConfirmation({ kind: 'apply', template: item.template }); return; }
    if (item.template) props.onTemplate(item.template); else props.onName(item.name);
    close();
  }
  async function remove(template: ExerciseTemplate) {
    if (!token || busy.current || props.disabled) return;
    busy.current = true; setWorking(true); onBusy(true); setMessage(null);
    const operation = new AbortController(); writeController.current = operation;
    try {
      await deleteTemplate(token, template.id, operation.signal);
      if (active.current && !operation.signal.aborted) {
        setTemplates((items) => items.filter((item) => item.id !== template.id)); setConfirmation(null);
        setMessage('Шаблон видалено. Вправи в тренуваннях залишилися.');
      }
    } catch (cause) {
      if (active.current && !operation.signal.aborted) {
        const text = await report(cause, 'Не вдалося підтвердити видалення. Повтори або відкрий список знову.');
        if (active.current && !operation.signal.aborted) setMessage(text);
      }
    } finally {
      busy.current = false;
      if (active.current) { setWorking(false); onBusy(false); }
    }
  }
  const query = normalize(search);
  const choices: Choice[] = (tab === 'basic' ? exerciseCatalogue.map((item) => ({ key: item.name, name: item.name, detail: item.group })) :
    templates.map((template) => ({ key: String(template.id), name: template.name,
      detail: template.sets.map((set) => `${set.reps} повт.${set.weightKg === null ? '' : ` × ${String(set.weightKg).replace('.', ',')} кг`}`).join(' · '), template })))
    .filter((item) => normalize(`${item.name} ${tab === 'basic' ? item.detail : ''}`).includes(query));

  return <View style={styles.wrapper}>
    <View style={styles.nameControl}>
      <TextInput ref={nameInput} accessibilityLabel="Назва вправи" value={props.name} onChangeText={props.onName} editable={!props.disabled && !working}
        maxLength={100} placeholder="Своя назва або вибір →" placeholderTextColor={colors.muted} style={styles.nameInput} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Вибрати вправу або шаблон" disabled={props.disabled || working} onPress={open} style={styles.selectButton}>
        <Text style={styles.link}>Вибрати ⌄</Text>
      </TouchableOpacity>
    </View>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}
      onDismiss={() => { if (focusManual.current && active.current) { focusManual.current = false; nameInput.current?.focus(); } }}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">Вибір вправи</Text>
            <TouchableOpacity accessibilityRole="button" disabled={working} onPress={close} style={styles.secondary}><Text style={styles.link}>Закрити</Text></TouchableOpacity>
          </View>
          {confirmation ? <View style={styles.confirm}>
            <Text style={styles.title}>{confirmation.kind === 'apply' ? 'Замінити поточну форму?' : 'Видалити шаблон?'}</Text>
            <Text style={styles.hint}>{confirmation.kind === 'apply' ? `Назва, нотатка й підходи будуть узяті з «${confirmation.template.name}».` : `«${confirmation.template.name}» зникне з шаблонів. Записані тренування залишаться.`}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.button} onPress={() => {
              if (confirmation.kind === 'delete') { void remove(confirmation.template); return; }
              props.onTemplate(confirmation.template); close();
            }}><Text style={styles.buttonText}>{working ? 'Видаляємо…' : confirmation.kind === 'apply' ? 'Замінити форму' : 'Видалити шаблон'}</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.secondary} onPress={() => { setConfirmation(null); setMessage(null); }}><Text style={styles.link}>Скасувати</Text></TouchableOpacity>
            {message && <Text style={styles.hint} accessibilityLiveRegion="polite">{message}</Text>}
          </View> : <>
            <View style={styles.tabs}>{(['basic', 'mine'] as const).map((value) => <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
              onPress={() => { setTab(value); setMessage(null); }} style={[styles.tab, tab === value && styles.selected]}><Text style={[styles.buttonText, tab === value && { color: colors.ink }]}>{value === 'basic' ? 'Базові вправи' : 'Мої шаблони'}</Text></TouchableOpacity>)}</View>
            <TextInput accessibilityLabel="Пошук вправи або шаблону" value={search} onChangeText={setSearch} placeholder="Назва або група м’язів" placeholderTextColor={colors.muted} style={styles.search} maxLength={100} autoCorrect={false} />
            <TouchableOpacity accessibilityRole="button" style={styles.manual} onPress={() => {
              focusManual.current = Platform.OS === 'ios'; close();
              if (Platform.OS !== 'ios') nameInput.current?.focus();
            }}><Text style={styles.link}>+ Ввести свою назву</Text></TouchableOpacity>
            {tab === 'mine' && loading ? <Text style={styles.status}>Завантажуємо шаблони…</Text> : tab === 'mine' && loadError ? <View style={styles.confirm}>
              <Text accessibilityRole="alert" style={styles.hint}>{loadError}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => void load()} style={styles.button}><Text style={styles.buttonText}>Повторити завантаження шаблонів</Text></TouchableOpacity>
            </View> : <FlatList data={choices} keyExtractor={(item) => item.key} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.hint}>{query ? 'Нічого не знайдено. Можна ввести свою назву.' : 'Власних шаблонів ще немає. Заповни вправу й натисни «Зберегти вправу як шаблон».'}</Text>}
              renderItem={({ item }) => <View style={styles.row}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Вибрати ${item.name}`} style={styles.choice} onPress={() => choose(item)}>
                  <Text style={styles.name}>{item.name}</Text><Text style={styles.hint} numberOfLines={2}>{item.detail}</Text>
                </TouchableOpacity>
                {item.template && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Видалити шаблон ${item.name}`} style={styles.delete} onPress={() => { Keyboard.dismiss(); setMessage(null); setConfirmation({ kind: 'delete', template: item.template! }); }}><Text style={styles.deleteText}>Видалити</Text></TouchableOpacity>}
              </View>} />}
            {message && <Text style={styles.status} accessibilityLiveRegion="polite">{message}</Text>}
          </>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  wrapper: { gap: 10 }, nameControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  nameInput: { flex: 1, color: colors.text, padding: 16, fontSize: 17, minHeight: 56 },
  selectButton: { paddingVertical: 16, paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: colors.border, minHeight: 56 }, screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text }, hint: { fontSize: 15, lineHeight: 22, color: colors.muted },
  button: { backgroundColor: colors.raised, borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' }, secondary: { padding: 12, minHeight: 44, alignItems: 'center' },
  link: { color: colors.accentText, fontSize: 16 }, tabs: { flexDirection: 'row', gap: 8, marginHorizontal: 20 },
  tab: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: colors.surface }, selected: { backgroundColor: colors.accent },
  search: { margin: 20, marginBottom: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, color: colors.text, fontSize: 17, backgroundColor: colors.surface },
  manual: { padding: 16, marginHorizontal: 4 }, list: { paddingHorizontal: 20, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }, choice: { flex: 1, paddingVertical: 17, gap: 5 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' }, delete: { padding: 12, minHeight: 44 }, deleteText: { color: colors.error, fontSize: 14 },
  confirm: { padding: 24, gap: 20 }, status: { padding: 20, fontSize: 15, color: colors.muted }, disabled: { opacity: 0.6 },
});
