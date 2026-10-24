import React, { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { getProfile } from '../profile/profileApi';
import { todayWorkoutDate } from '../workouts/workoutDate';
import { WorkoutApiError } from '../workouts/workoutApi';
import { Colors, useThemedStyles } from '../ui/theme';

export default function HomeGreeting() {
  const { token, signOut } = useSession();
  const styles = useThemedStyles(createStyles);
  const [identity, setIdentity] = useState<{ token: string; nickname: string | null } | null>(null);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void (async () => {
      if (!token) return;
      try {
        const today = todayWorkoutDate();
        const profile = await getProfile(token, Number(today.slice(0,4)), today, controller.signal);
        if (!controller.signal.aborted) setIdentity({ token, nickname: profile.user.nickname });
      } catch (cause) {
        if (!controller.signal.aborted && cause instanceof WorkoutApiError && cause.status === 401) await signOut().catch(() => {});
      }
    })();
    return () => controller.abort();
  }, [token, signOut]));
  const nickname = identity?.token === token ? identity?.nickname : null;
  return <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{nickname ? <>Привіт, <Text style={styles.accent}>{nickname}!</Text></> : 'Привіт!'}</Text>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  title: { color: colors.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.7 }, accent: { color: colors.accentText },
});
