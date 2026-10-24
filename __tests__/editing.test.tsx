import React from 'react';
import { Alert, Text } from 'react-native';
import { Stack } from 'expo-router';
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import EditWorkoutScreen from '../src/screens/EditWorkoutScreen';
import NewExerciseScreen from '../src/screens/NewExerciseScreen';
import DeleteWorkoutRecord from '../src/components/DeleteWorkoutRecord';
import HomeGreeting from '../src/components/HomeGreeting';
import { getWorkout, updateWorkout, updateExercise, deleteWorkout, deleteExercise, WorkoutApiError } from '../src/workouts/workoutApi';
import { getProfile } from '../src/profile/profileApi';
const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'token', signOut: mockSignOut }) }));
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
jest.mock('../src/workouts/workoutApi',()=>({...jest.requireActual('../src/workouts/workoutApi'),getWorkout:jest.fn(),updateWorkout:jest.fn(),updateExercise:jest.fn(),deleteWorkout:jest.fn(),deleteExercise:jest.fn()}));
jest.mock('../src/profile/profileApi',()=>({...jest.requireActual('../src/profile/profileApi'),getProfile:jest.fn()}));
jest.mock('../src/components/ExerciseLibrary',()=>({name,onName}:{name:string;onName:(name:string)=>void})=>{const {TextInput}=require('react-native');return <TextInput accessibilityLabel="Назва вправи" value={name} onChangeText={onName}/>;});
jest.mock('../src/components/SaveExerciseTemplate',()=>()=>null);
const read=jest.mocked(getWorkout),write=jest.mocked(updateWorkout),exerciseWrite=jest.mocked(updateExercise),remove=jest.mocked(deleteWorkout),removeExercise=jest.mocked(deleteExercise),profile=jest.mocked(getProfile);
const workout={id:7,title:'Верх',date:'2026-10-23',notes:'План',createdAt:'2026-10-23T10:00:00Z',completedAt:null,revision:3};
const exercise={id:9,name:'Жим',notes:'Пауза',position:1,createdAt:workout.createdAt,revision:2,sets:[{position:1,reps:10,weightKg:40},{position:2,reps:8,weightKg:42.5}]};
const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
beforeEach(()=>{read.mockReset().mockResolvedValue({workout,exercises:[exercise]});write.mockReset().mockResolvedValue({...workout,revision:4});exerciseWrite.mockReset().mockResolvedValue({...exercise,revision:3});remove.mockReset().mockResolvedValue(undefined);removeExercise.mockReset().mockResolvedValue(undefined);mockSignOut.mockReset().mockResolvedValue(undefined);profile.mockReset();alert.mockClear();});
afterEach(cleanup);afterAll(()=>alert.mockRestore());
const detail=()=> <Text>Деталі тренування</Text>;
const open=(initialUrl='/workouts/7/edit')=>renderRouter({_layout:()=> <Stack/>,index:detail,'workouts/[workoutId]/index':detail,'workouts/[workoutId]/edit':EditWorkoutScreen,'workouts/[workoutId]/exercises/[exerciseId]/edit':NewExerciseScreen},{initialUrl});
test('форма тренування читає дані та надсилає зміни з початковою версією',async()=>{
 const app=await open();await screen.findByDisplayValue('Верх');await fireEvent.changeText(screen.getByLabelText('Назва тренування'),'Ноги');await fireEvent.changeText(screen.getByLabelText('Дата тренування'),'29.02.2024');
 await fireEvent.press(screen.getByRole('button',{name:'Зберегти зміни'}));await screen.findByText('Деталі тренування');expect(app.getPathname()).toBe('/workouts/7');expect(write.mock.calls[0][2]).toMatchObject({title:'Ноги',date:'2024-02-29',notes:'План',expectedRevision:3});
});
test('після втрати відповіді форма повторює точний запит і зберігає текст',async()=>{
 write.mockRejectedValueOnce(new Error('network'));await open();await screen.findByDisplayValue('Верх');await fireEvent.changeText(screen.getByLabelText('Назва тренування'),'Новий план');await fireEvent.press(screen.getByRole('button',{name:'Зберегти зміни'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Назва тренування').props.value).toBe('Новий план');expect(screen.getByLabelText('Назва тренування').props.editable).toBe(false);const first=write.mock.calls[0][2];await fireEvent.press(screen.getByRole('button',{name:'Повторити збереження'}));await waitFor(()=>expect(write).toHaveBeenCalledTimes(2));expect(write.mock.calls[1][2]).toEqual(first);
});
test('конфлікт не стирає текст і не повторює старий запис поверх нового',async()=>{
 write.mockRejectedValueOnce(new WorkoutApiError('Запис змінився.',409));await open();await screen.findByDisplayValue('Верх');await fireEvent.changeText(screen.getByLabelText('Назва тренування'),'Мій текст');await fireEvent.press(screen.getByRole('button',{name:'Зберегти зміни'}));await screen.findByRole('alert');expect(screen.getByLabelText('Назва тренування').props.value).toBe('Мій текст');expect(screen.queryByRole('button',{name:'Зберегти зміни'})).toBeNull();
 read.mockResolvedValue({workout:{...workout,title:'Сервер',revision:4},exercises:[exercise]});await fireEvent.press(screen.getByRole('button',{name:'Перечитати тренування'}));await screen.findByDisplayValue('Сервер');
});
test('редагування вправи завантажує підходи, зберігає вагу з комою і прибирає рядок',async()=>{
 await open('/workouts/7/exercises/9/edit');await screen.findByDisplayValue('Жим');expect(screen.getByLabelText('Вага в кілограмах, підхід 2').props.value).toBe('42,5');
 await fireEvent.changeText(screen.getByLabelText('Вага в кілограмах, підхід 1'),'45,5');await fireEvent.press(screen.getByRole('button',{name:'Прибрати підхід 2'}));expect(screen.queryByLabelText('Повторення, підхід 2')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:'Зберегти зміни вправи'}));await screen.findByText('Деталі тренування');expect(exerciseWrite.mock.calls[0].slice(0,4)).toEqual(['token',7,9,{name:'Жим',notes:'Пауза',sets:[{reps:10,weightKg:45.5}],expectedRevision:2}]);
});
test('відсутня вправа не відкриває порожню форму створення',async()=>{
 read.mockResolvedValue({workout,exercises:[]});await open('/workouts/7/exercises/9/edit');await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Зберегти вправу'})).toBeNull();expect(exerciseWrite).not.toHaveBeenCalled();
});
async function openDelete(exerciseMode=false){const onDeleted=jest.fn(),onReload=jest.fn();await renderRouter({_layout:()=> <Stack/>,index:()=> <DeleteWorkoutRecord workout={workout} exercise={exerciseMode?exercise:undefined} onDeleted={onDeleted} onReload={onReload}/>});return {onDeleted,onReload};}
function confirmDelete(){const buttons=alert.mock.calls.at(-1)?.[2];const confirm=buttons?.find(b=>b.text==='Видалити');if(!confirm?.onPress)throw new Error('No confirmation');confirm.onPress();}
test('скасування діалогу не видаляє тренування; лише підтвердження надсилає версію',async()=>{
 const {onDeleted}=await openDelete();await fireEvent.press(screen.getByRole('button',{name:'Видалити тренування'}));expect(remove).not.toHaveBeenCalled();expect(alert.mock.calls[0][1]).toContain('усіма вправами');
 await act(async()=>confirmDelete());await waitFor(()=>expect(onDeleted).toHaveBeenCalledTimes(1));expect(remove.mock.calls[0][1]).toEqual(workout);
});
test('видалення вправи не викликає видалення всього тренування',async()=>{
 await openDelete(true);await fireEvent.press(screen.getByRole('button',{name:'Видалити вправу Жим'}));await act(async()=>confirmDelete());await waitFor(()=>expect(removeExercise).toHaveBeenCalledTimes(1));expect(remove).not.toHaveBeenCalled();expect(removeExercise.mock.calls[0][2]).toEqual(exercise);
});
test('конфлікт видалення залишає запис і пропонує перечитати дані',async()=>{
 remove.mockRejectedValue(new WorkoutApiError('Змінився запис.',409));const {onDeleted,onReload}=await openDelete();await fireEvent.press(screen.getByRole('button',{name:'Видалити тренування'}));await act(async()=>confirmDelete());await screen.findByRole('alert');expect(onDeleted).not.toHaveBeenCalled();await fireEvent.press(screen.getByRole('button',{name:'Перечитати тренування'}));expect(onReload).toHaveBeenCalledTimes(1);
});
test('привітання бере нікнейм акаунта і має простий варіант без нього',async()=>{
 const user={id:7,email:'demo@example.test',nickname:'Стас',createdAt:workout.createdAt};const activity={year:2026,today:'2026-10-24',days:[],activeDays:0,totalWorkouts:0,yearWorkouts:0};profile.mockResolvedValue({user,activity});await renderRouter({_layout:()=> <Stack/>,index:HomeGreeting});await screen.findByText('Стас!');await cleanup();profile.mockResolvedValue({user:{...user,nickname:null},activity});await renderRouter({_layout:()=> <Stack/>,index:HomeGreeting});await screen.findByText('Привіт!');expect(screen.queryByText('Погнали.')).toBeNull();
});
