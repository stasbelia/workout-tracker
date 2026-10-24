import React from 'react';
import { Appearance, StyleSheet, Text, View } from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, ThemeProvider, useTheme, useThemedStyles } from '../src/ui/theme';
import ThemeSelector from '../src/components/ThemeSelector';
import { activityWeeks } from '../src/profile/activityCalendar';
import { getProfile, saveNickname } from '../src/profile/profileApi';
import { WorkoutApiError } from '../src/workouts/workoutApi';
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn()}));
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
const read=jest.mocked(SecureStore.getItemAsync),write=jest.mocked(SecureStore.setItemAsync),originalFetch=global.fetch,mockFetch=jest.fn();
const user={id:7,email:'demo@example.test',nickname:'Стас',createdAt:'2026-01-01T00:00:00Z'};
const activity={year:2026,today:'2026-03-01',totalWorkouts:5,yearWorkouts:2,activeDays:1,days:[{date:'2026-02-28',count:2}]};
const styles=(colors:Colors)=>StyleSheet.create({screen:{backgroundColor:colors.background}});
function Probe(){const {mode}=useTheme(),s=useThemedStyles(styles);return <View testID="appearance" style={s.screen}><Text>{mode}</Text><ThemeSelector/></View>;}
beforeEach(()=>{read.mockReset().mockResolvedValue(null);write.mockReset().mockResolvedValue(undefined);mockFetch.mockReset();global.fetch=mockFetch;});
afterEach(cleanup);afterAll(()=>{global.fetch=originalFetch;});
test('перемикання теми міняє кольори, native appearance та зберігає вибір окремо від токена',async()=>{
 const native=jest.spyOn(Appearance,'setColorScheme');
 await render(<ThemeProvider><Probe/></ThemeProvider>);
 await fireEvent.press(screen.getByRole('radio',{name:'Світла тема'}));await screen.findByText('light');
 expect(screen.getByTestId('appearance')).toHaveStyle({backgroundColor:'#F5F7F2'});
 expect(write).toHaveBeenCalledWith('appearanceMode','light');expect(native).toHaveBeenCalledWith('light');
 await fireEvent.press(screen.getByRole('radio',{name:'Темна тема'}));await screen.findByText('dark');
 expect(screen.getByTestId('appearance')).toHaveStyle({backgroundColor:'#0F1115'});native.mockRestore();
});
test('світла тема відновлюється після повторного запуску',async()=>{
 read.mockResolvedValue('light');await render(<ThemeProvider><Probe/></ThemeProvider>);await screen.findByText('light');expect(read).toHaveBeenCalledWith('appearanceMode');
});
test('помилка збереження теми залишає попередній вигляд і дозволяє повтор',async()=>{
 write.mockRejectedValueOnce(new Error('storage'));await render(<ThemeProvider><Probe/></ThemeProvider>);
 await fireEvent.press(screen.getByRole('radio',{name:'Світла тема'}));await screen.findByRole('alert');expect(screen.getByText('dark')).toBeTruthy();
 await fireEvent.press(screen.getByRole('radio',{name:'Світла тема'}));await screen.findByText('light');
});
test('повільне відновлення теми не перезаписує вибір користувача',async()=>{
 let resolve!:(value:string)=>void;read.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 await render(<ThemeProvider><Probe/></ThemeProvider>);await fireEvent.press(screen.getByRole('radio',{name:'Світла тема'}));await screen.findByText('light');
 await act(async()=>resolve('dark'));expect(screen.getByText('light')).toBeTruthy();
});
test('календар має кожен день високосного року рівно раз, тижні починаються в понеділок',()=>{
 const weeks=activityWeeks({...activity,year:2024,today:'2024-12-31',days:[{date:'2024-02-29',count:3}]});
 const days=weeks.flat().filter(d=>d.inYear);expect(days).toHaveLength(366);expect(new Set(days.map(d=>d.date)).size).toBe(366);
 expect(new Date(weeks[0][0].date+'T00:00:00Z').getUTCDay()).toBe(1);expect(days.find(d=>d.date==='2024-02-29')).toMatchObject({count:3,level:1,future:false});
});
test('календар позначає майбутні дати і розділяє нуль та активний день',()=>{
 const days=activityWeeks(activity).flat();expect(days.find(d=>d.date==='2026-03-02')).toMatchObject({future:true,count:0,level:0});expect(days.find(d=>d.date==='2026-02-28')).toMatchObject({count:2,level:1});
});
test('профіль надсилає рік і локальну дату, нікнейм оновлюється без email у JSON',async()=>{
 mockFetch.mockResolvedValueOnce({ok:true,status:200,json:async()=>({user,activity})}).mockResolvedValueOnce({ok:true,status:200,json:async()=>({user})});
 expect(await getProfile('token',2026,'2026-03-01',new AbortController().signal)).toEqual({user,activity});
 expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.test/api/profile?year=2026&today=2026-03-01');
 await saveNickname('token','Стас',new AbortController().signal);expect(mockFetch.mock.calls[1][1]).toMatchObject({method:'PATCH',body:JSON.stringify({nickname:'Стас'})});
});
test('повторні, чужі роки, майбутні дати і неправильні підсумки відповіді відхиляються',async()=>{
 for(const change of [{days:[{date:'2026-02-28',count:2},{date:'2026-02-28',count:2}]},{days:[{date:'2025-02-28',count:2}]},{days:[{date:'2026-03-02',count:2}]},{yearWorkouts:3},{totalWorkouts:0},{activeDays:0}]){
  mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({user,activity:{...activity,...change}})});
  await expect(getProfile('token',2026,'2026-03-01',new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
 }
});
