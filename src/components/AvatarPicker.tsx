import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import { useSession } from '../auth/SessionProvider';
import { AvatarApiError, ensureAvatarHttps, getAvatar, saveAvatar, type Avatar } from '../avatar/avatarApi';
import { prepareAvatar } from '../avatar/prepareAvatar';

export default function AvatarPicker() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { token, signOut } = useSession();
  const [avatarState, setAvatarState] = useState<{ token: string; avatar: Avatar | null } | null>(null);
  const avatar = avatarState?.token === token ? avatarState.avatar : null;
  const [isPicking, setIsPicking] = useState(false);
  const [stage, setStage] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const busy = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const logout = useRef(signOut);
  useEffect(() => { logout.current = signOut; }, [signOut]);

  const loadAvatar = useCallback(() => {
    if (!token || busy.current) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    return getAvatar(token, controller.signal).then((saved) => {
      if (active.current && !controller.signal.aborted) { setAvatarState({ token, avatar: saved }); setError(null); }
    }).catch(async (failure: unknown) => {
      if (!active.current || controller.signal.aborted) return;
      setError(failure instanceof AvatarApiError ? failure.message : 'Не вдалося отримати аватар. Спробуй ще раз.');
      if (failure instanceof AvatarApiError && failure.status === 401) await logout.current().catch(() => {});
    });
  }, [token]);

  useEffect(() => {
    active.current = true;
    void loadAvatar();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void loadAvatar(); });
    const timer = setInterval(() => { void loadAvatar(); }, 12 * 60_000);
    return () => { active.current = false; operation.current?.abort(); listener.remove(); clearInterval(timer); if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [loadAvatar]);

  async function choosePhoto() {
    if (busy.current || !token) return;
    busy.current = true;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setIsPicking(true);
    setError(null); setSavedNotice(false);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    let prepared: Awaited<ReturnType<typeof prepareAvatar>> | undefined;
    let canceled = false;
    try {
      ensureAvatarHttps();
      setStage('Обираємо фото…');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      // Скасування вибору залишає попереднє фото без змін.
      if (result.canceled) { canceled = true; return; }

      const photo = result.assets[0];
      if (!photo?.uri) {
        Alert.alert('Не вдалося обрати фото', 'Спробуй вибрати інше зображення.');
        return;
      }

      if (controller.signal.aborted || !active.current) return;
      setStage('Готуємо фото…');
      prepared = await prepareAvatar(photo.uri);
      if (controller.signal.aborted || !active.current) return;
      const saved = await saveAvatar(token, prepared, controller.signal, (message) => {
        if (active.current && !controller.signal.aborted) setStage(message);
      });
      if (active.current && !controller.signal.aborted) {
        setAvatarState({ token, avatar: saved }); setStage('Фото збережено'); setSavedNotice(true);
        noticeTimer.current = setTimeout(() => { if (active.current) setSavedNotice(false); }, 4000);
      }
    } catch (failure) {
      if (!active.current || controller.signal.aborted) return;
      const message = failure instanceof AvatarApiError ? failure.message : 'Не вдалося зберегти фото. Перевір з’єднання та спробуй ще раз.';
      setError(message);
      Alert.alert('Аватар не підтверджено', message);
      if (failure instanceof AvatarApiError && failure.status === 401) await logout.current().catch(() => {});
    } finally {
      try { if (prepared?.exists) prepared.delete(); } catch { /* Кеш очистить система. */ }
      busy.current = false;
      if (active.current) setIsPicking(false);
      if (canceled && active.current) void loadAvatar();
    }
  }

  return (
    <View style={styles.container}>
      {avatar ? (
        <Image
          source={{ uri: avatar.url }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel="Збережений аватар"
          onError={() => setError('Не вдалося показати фото. Онови аватар.')}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Твоє фото</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isPicking && styles.disabledButton]}
        onPress={choosePhoto}
        disabled={isPicking}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPicking, busy: isPicking }}
      >
        {isPicking ? (
          <ActivityIndicator color={colors.accentText} accessibilityLabel="Збереження фото" />
        ) : (
          <Text style={styles.buttonText}>{avatar ? 'Змінити фото' : 'Обрати фото'}</Text>
        )}
      </TouchableOpacity>

      {isPicking && <Text style={styles.hint} accessibilityLiveRegion="polite">{stage}</Text>}
      {!isPicking && savedNotice && !error && <Text style={styles.hint} accessibilityLiveRegion="polite">Фото збережено</Text>}
      {error && <Text style={styles.hint} accessibilityRole="alert">{error}</Text>}
      {error && !isPicking && (
        <TouchableOpacity onPress={() => { void loadAvatar(); }} accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>Оновити аватар</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 0,
  },
  photo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.raised,
  },
  placeholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.raised,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.muted,
  },
  button: {
    marginTop: 12,
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.ink,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
