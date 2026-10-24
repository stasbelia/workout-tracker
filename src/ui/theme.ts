import React, { createContext, createElement, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';
export type Colors = {
  background: string; surface: string; raised: string; border: string; text: string; muted: string;
  accent: string; accentText: string; ink: string; onDark: string; error: string; heat: string[];
};
export const darkColors: Colors = {
  background: '#0F1115', surface: '#24282D', raised: '#30363C', border: '#363D43',
  text: '#F4F5F6', muted: '#9BA3AD', accent: '#C2F76B', accentText: '#C2F76B', ink: '#172010', onDark: '#F4F5F6', error: '#FFB4AB',
  heat: ['#30363C', '#2B4728', '#52783B', '#92BB56', '#C2F76B'],
};
export const lightColors: Colors = {
  background: '#F5F7F2', surface: '#FFFFFF', raised: '#E9EDE4', border: '#D5DDCF',
  text: '#182116', muted: '#596652', accent: '#C2F76B', accentText: '#3D6816', ink: '#172010', onDark: '#F4F5F6', error: '#AC3028',
  heat: ['#E4E9E0', '#D3E7B9', '#ABCF7A', '#70A338', '#3D6816'],
};
const KEY = 'appearanceMode';
const ThemeContext = createContext({ mode: 'dark' as ThemeMode, colors: darkColors, setMode: async (_mode: ThemeMode): Promise<void> => {} });
export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<ThemeMode>('dark');
  const active = useRef(false), changed = useRef(false), busy = useRef(false);
  useEffect(() => {
    active.current = true;
    void SecureStore.getItemAsync(KEY).then((saved) => {
      if (active.current && !changed.current && (saved === 'light' || saved === 'dark')) updateMode(saved);
    }).catch(() => {});
    return () => { active.current = false; Appearance.setColorScheme('auto'); };
  }, []);
  useEffect(() => { Appearance.setColorScheme(mode); }, [mode]);
  const setMode = useCallback(async (next: ThemeMode) => {
    if (busy.current) return;
    busy.current = true; changed.current = true;
    try {
      await SecureStore.setItemAsync(KEY, next);
      if (active.current) updateMode(next);
    } finally { busy.current = false; }
  }, []);
  const value = useMemo(() => ({ mode, colors: mode === 'light' ? lightColors : darkColors, setMode }), [mode, setMode]);
  return createElement(ThemeContext.Provider, { value }, children);
}
export const useTheme = () => useContext(ThemeContext);
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
