import React from 'react';
import { Stack, router } from 'expo-router';
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import WorkoutStartScreen from '../src/screens/WorkoutStartScreen';
import NewWorkoutScreen from '../src/screens/NewWorkoutScreen';
import HomeScreen from '../src/screens/HomeScreen';
import OneRepMaxScreen from '../src/screens/OneRepMaxScreen';
import { listWorkoutTemplates, getWorkoutTemplate, createFromWorkoutTemplate } from '../src/workouts/workoutTemplates';
import { createWorkout, listWorkouts, WorkoutApiError } from '../src/workouts/workoutApi';
const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider',()=>({useSession:()=>({token:'test-token',signOut:mockSignOut})}));
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
jest.mock('../src/components/AvatarThumbnail',()=>()=>null);
jest.mock('../src/components/HomeGreeting',()=>()=>null);
jest.mock('../src/workouts/workoutTemplates',()=>({...jest.requireActual('../src/workouts/workoutTemplates'),listWorkoutTemplates:jest.fn(),getWorkoutTemplate:jest.fn(),createFromWorkoutTemplate:jest.fn()}));
jest.mock('../src/workouts/workoutApi',()=>({...jest.requireActual('../src/workouts/workoutApi'),createWorkout:jest.fn(),listWorkouts:jest.fn()}));
const list=jest.mocked(listWorkoutTemplates),read=jest.mocked(getWorkoutTemplate),copy=jest.mocked(createFromWorkoutTemplate),create=jest.mocked(createWorkout);
const template={id:3,name:'Мої ноги',notes:'План',exerciseCount:1,setCount:2,createdAt:'2026-01-01T00:00:00Z',exercises:[{name:'Присідання',notes:'',sets:[{reps:10,weightKg:40},{reps:8,weightKg:42.5}]}]};
const workout={id:8,title:'Мої ноги',date:'2026-10-24',notes:'План',revision:0,completedAt:null,createdAt:template.createdAt};
beforeEach(()=>{list.mockReset().mockResolvedValue([template]);read.mockReset().mockResolvedValue(template);copy.mockReset().mockResolvedValue(workout);create.mockReset().mockResolvedValue(workout);jest.mocked(listWorkouts).mockReset().mockResolvedValue({workouts:[],nextCursor:null});mockSignOut.mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
const open=(initialUrl='/workouts/new')=>renderRouter({_layout:()=> <Stack/>,index:HomeScreen,'workouts/new':WorkoutStartScreen,'workouts/create':NewWorkoutScreen,'workouts/[workoutId]/index':()=>null,'one-rep-max':OneRepMaxScreen},{initialUrl});
test('шаблон обирається до створення запису; форма зберігає одне повне тренування',async()=>{
 const app=await open();await screen.findByRole('button',{name:'Обрати шаблон Мої ноги'});expect(create).not.toHaveBeenCalled();expect(copy).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('button',{name:'Обрати шаблон Мої ноги'}));await screen.findByDisplayValue('Мої ноги');expect(app.getPathname()).toBe('/workouts/create');expect(screen.getByText('1. Присідання · 2 підх.')).toBeTruthy();expect(copy).not.toHaveBeenCalled();
 await fireEvent.changeText(screen.getByLabelText('Дата тренування'),'24.10.2026');await fireEvent.press(screen.getByRole('button',{name:'Зберегти тренування'}));await waitFor(()=>expect(app.getPathname()).toBe('/workouts/8'));expect(copy).toHaveBeenCalledTimes(1);expect(copy.mock.calls[0][1]).toBe(3);expect(create).not.toHaveBeenCalled();
});
test('відхід зі списку або відкриття порожньої форми не створює тренування',async()=>{
 const app=await open();await screen.findByRole('button',{name:'Обрати шаблон Мої ноги'});await fireEvent.press(screen.getByRole('button',{name:/Порожнє тренування/}));await screen.findByLabelText('Назва тренування');expect(app.getPathname()).toBe('/workouts/create');expect(create).not.toHaveBeenCalled();expect(copy).not.toHaveBeenCalled();
});
test('помилка шаблонів не блокує порожню форму й дозволяє повтор',async()=>{
 list.mockRejectedValueOnce(new Error('offline'));await open();await screen.findByRole('alert');expect(screen.queryByText('Шаблонів ще немає')).toBeNull();await fireEvent.press(screen.getByRole('button',{name:'Повторити завантаження шаблонів'}));await screen.findByRole('button',{name:'Обрати шаблон Мої ноги'});expect(create).not.toHaveBeenCalled();
});
test('порожній список пояснює як зберегти план, а 401 завершує сесію',async()=>{
 list.mockResolvedValueOnce([]);await open();await screen.findByText('Шаблонів ще немає');await cleanup();list.mockRejectedValueOnce(new WorkoutApiError('Потрібен вхід.',401));await open();await waitFor(()=>expect(mockSignOut).toHaveBeenCalledTimes(1));
});
test('відхід перериває читання й не створює запису',async()=>{
 list.mockImplementationOnce(()=>new Promise(()=>{}));await open();await waitFor(()=>expect(list).toHaveBeenCalledTimes(1));const signal=list.mock.calls[0][1];await act(async()=>router.dismissTo('/'));expect(signal.aborted).toBe(true);expect(copy).not.toHaveBeenCalled();
});
test('старе посилання на шаблон відкриває форму без проміжного вибору',async()=>{
 await open('/workouts/new?templateId=3');await screen.findByDisplayValue('Мої ноги');expect(list).not.toHaveBeenCalled();expect(read).toHaveBeenCalledTimes(1);expect(copy).not.toHaveBeenCalled();
});
test('на головній є одна кнопка створення, а нижнє меню відкриває калькулятор',async()=>{
 const app=await open('/');await screen.findByText('Тренувань ще немає');expect(screen.getAllByRole('button',{name:'+ Створити тренування'})).toHaveLength(1);expect(screen.queryByRole('button',{name:'Нове тренування'})).toBeNull();await fireEvent.press(screen.getByRole('button',{name:'Калькулятор 1RM'}));await screen.findByLabelText('Вага для розрахунку 1RM');expect(app.getPathname()).toBe('/one-rep-max');expect(copy).not.toHaveBeenCalled();
});
