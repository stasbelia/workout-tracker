import React, { useCallback, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { Avatar, AvatarApiError, getAvatar } from '../avatar/avatarApi';
import { Colors, useThemedStyles } from '../ui/theme';
import AppIcon from './AppIcon';
export default function AvatarThumbnail() {
  const { token, signOut } = useSession(), styles = useThemedStyles(createStyles);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const refresh = useRef<() => void>(() => {}), triedImageRefresh = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true, operation: AbortController | null = null;
    triedImageRefresh.current = false; setAvatar(null);
    async function load() {
      if (!token) return;
      operation?.abort(); const controller = new AbortController(); operation = controller;
      try {
        const saved = await getAvatar(token, controller.signal);
        if (active && !controller.signal.aborted) setAvatar(saved);
      } catch (cause) {
        if (active && !controller.signal.aborted && cause instanceof AvatarApiError && cause.status === 401) await signOut().catch(() => {});
      }
    }
    refresh.current = () => { void load(); };
    void load();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    const timer = setInterval(() => { void load(); }, 12 * 60_000);
    return () => { active = false; operation?.abort(); clearInterval(timer); listener.remove(); refresh.current = () => {}; };
  }, [token, signOut]));
  return <View style={styles.container}>{avatar ? <Image accessibilityLabel="Мій мініаватар" source={{ uri: avatar.url }} style={styles.photo} onError={() => {
    setAvatar(null);
    if (!triedImageRefresh.current) { triedImageRefresh.current = true; refresh.current(); }
  }} /> : <AppIcon name="profile" />}</View>;
}
const createStyles = (colors: Colors) => StyleSheet.create({container:{width:48,height:48,borderRadius:24,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',overflow:'hidden'},photo:{width:48,height:48,borderRadius:24}});
