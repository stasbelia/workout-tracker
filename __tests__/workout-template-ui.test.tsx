import React from 'react';
import {act,cleanup,fireEvent,renderRouter,screen,waitFor} from 'expo-router/testing-library';
import {Stack} from 'expo-router';
import WorkoutDetailScreen from '../src/screens/WorkoutDetailScreen';
import WorkoutTemplatesScreen from '../src/screens/WorkoutTemplatesScreen';
import NewWorkoutScreen from '../src/screens/NewWorkoutScreen';
import {createFromWorkoutTemplate,deleteWorkoutTemplate,getWorkoutTemplate,listWorkoutTemplates,saveWorkoutTemplate} from '../src/workouts/workoutTemplates';
import {createWorkout,getWorkout,WorkoutApiError} from '../src/workouts/workoutApi';
const mockSignOut=jest.fn();
jest.mock('../src/auth/SessionProvider',()=>({useSession:()=>({token:'test-token',signOut:mockSignOut})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '294534b9-30e2-473a-b252-74a1a15cf6bd'}));
jest.mock('../src/workouts/workoutTemplates',()=>({createFromWorkoutTemplate:jest.fn(),deleteWorkoutTemplate:jest.fn(),getWorkoutTemplate:jest.fn(),listWorkoutTemplates:jest.fn(),saveWorkoutTemplate:jest.fn()}));
jest.mock('../src/workouts/workoutApi',()=>({...jest.requireActual('../src/workouts/workoutApi'),getWorkout:jest.fn(),createWorkout:jest.fn()}));
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
const list=jest.mocked(listWorkoutTemplates),read=jest.mocked(getWorkoutTemplate),save=jest.mocked(saveWorkoutTemplate),create=jest.mocked(createFromWorkoutTemplate),remove=jest.mocked(deleteWorkoutTemplate),workoutRead=jest.mocked(getWorkout);
const template={id:3,name:'Верх A',notes:'План',createdAt:'2026-01-01T00:00:00Z',exerciseCount:2,setCount:4,
 exercises:[{name:'Жим',notes:'Пауза',sets:[{reps:10,weightKg:40},{reps:8,weightKg:42.5}]},{name:'Підтягування',notes:'',sets:[{reps:5,weightKg:null},{reps:6,weightKg:0}]}]};
const {exercises,...summary}=template;
beforeEach(()=>{
 list.mockReset().mockResolvedValue([summary]);read.mockReset().mockResolvedValue(template);save.mockReset().mockResolvedValue(summary);remove.mockReset().mockResolvedValue(undefined);
 create.mockReset().mockResolvedValue({id:8,title:'Верх A',notes:'План',date:'2026-10-24',revision:0,completedAt:null,createdAt:template.createdAt});
 workoutRead.mockReset().mockImplementation(async(_token,id)=>({workout:{id,title:id===7?'Верх тіла':'Верх A',notes:'План',date:'2026-10-23',revision:0,completedAt:null,createdAt:template.createdAt},exercises:exercises.map((e,index)=>({...e,id:index+1,name:e.name,position:index+1,revision:0,createdAt:template.createdAt,sets:e.sets.map((s,i)=>({...s,position:i+1}))}))}));
 jest.mocked(createWorkout).mockReset();mockSignOut.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);
const open=(initialUrl='/workout-templates')=>renderRouter({_layout:()=> <Stack/>,index:()=>null,'workouts/[workoutId]/index':WorkoutDetailScreen,'workouts/new':NewWorkoutScreen,'workouts/create':NewWorkoutScreen,'workout-templates':WorkoutTemplatesScreen},{initialUrl});
const button=(name:string)=>screen.getByRole('button',{name});
test('ціле тренування зберігається як шаблон і відтворюється з іншою датою та всіма вправами',async()=>{
 const app=await open('/workouts/7');await screen.findByText('Верх тіла');
 await fireEvent.press(button('Зберегти тренування як шаблон'));await fireEvent.changeText(screen.getByLabelText('Назва шаблону тренування'),'Верх A');
 await fireEvent.press(button('Зберегти шаблон тренування'));await screen.findByText('Шаблон «Верх A» збережено. Вправ: 2, підходів: 4.');
 expect(save).toHaveBeenCalledWith('test-token',7,'Верх A',expect.any(String),expect.any(AbortSignal));
 await fireEvent.press(button('Відкрити мої шаблони тренувань →'));await screen.findByText('Твій план — під рукою');
 await fireEvent.press(await screen.findByRole('button',{name:'Створити тренування з шаблону Верх A'}));
 await screen.findByLabelText('Назва тренування');expect(screen.getByLabelText('Назва тренування').props.value).toBe('Верх A');expect(screen.getByText('2. Підтягування · 2 підх.')).toBeTruthy();
 await fireEvent.changeText(screen.getByLabelText('Дата тренування'),'24.10.2026');await fireEvent.press(button('Зберегти тренування'));
 await waitFor(()=>expect(app.getPathname()).toBe('/workouts/8'));
 expect(create.mock.calls[0][1]).toBe(3);expect(create.mock.calls[0][2]).toMatchObject({title:'Верх A',date:'2026-10-24',notes:'План'});expect(createWorkout).not.toHaveBeenCalled();
 expect(screen.getByText('5 повтор. · вага не вказана')).toBeTruthy();expect(screen.getByText('6 повтор. · 0 кг')).toBeTruthy();
});
test('втрата відповіді створення залишає дату й повторює той самий UUID',async()=>{
 create.mockRejectedValueOnce(new Error('lost reply'));await open('/workouts/new?templateId=3');await screen.findByLabelText('Назва тренування');
 await fireEvent.changeText(screen.getByLabelText('Дата тренування'),'24.10.2026');await fireEvent.press(button('Зберегти тренування'));await screen.findByRole('alert');
 expect(screen.getByLabelText('Дата тренування').props.editable).toBe(false);const first=create.mock.calls[0][2];
 await fireEvent.press(button('Повторити збереження'));await waitFor(()=>expect(create).toHaveBeenCalledTimes(2));expect(create.mock.calls[1][2]).toEqual(first);
});
test('шаблон, видалений перед збереженням, не перетворюється на порожнє тренування',async()=>{
 create.mockRejectedValueOnce(new WorkoutApiError('Шаблон не знайдено.',404));await open('/workouts/new?templateId=3');await screen.findByLabelText('Назва тренування');
 await fireEvent.press(button('Зберегти тренування'));await screen.findByRole('alert');expect(button('Зберегти тренування')).toBeDisabled();expect(createWorkout).not.toHaveBeenCalled();
});
test('видалення шаблону потребує підтвердження і не викликає видалення тренувань',async()=>{
 await open();await fireEvent.press(await screen.findByRole('button',{name:'Видалити шаблон тренування Верх A'}));await fireEvent.press(button('Скасувати'));expect(remove).not.toHaveBeenCalled();
 await fireEvent.press(button('Видалити шаблон тренування Верх A'));await fireEvent.press(button('Підтвердити видалення'));await screen.findByText('Шаблонів тренувань ще немає');expect(remove).toHaveBeenCalledWith('test-token',3,expect.any(AbortSignal));expect(create).not.toHaveBeenCalled();
});
test('помилка списку має повтор; 401 завершує сесію',async()=>{
 list.mockRejectedValueOnce(new Error('offline'));await open();await screen.findByRole('alert');await fireEvent.press(button('Повторити завантаження шаблонів тренувань'));await screen.findByRole('button',{name:'Створити тренування з шаблону Верх A'});expect(mockSignOut).not.toHaveBeenCalled();
});
test('некоректний ID шаблону не запитує сервер і не відкриває форму',async()=>{
 await open('/workouts/new?templateId=invalid');await screen.findByRole('alert');expect(read).not.toHaveBeenCalled();expect(screen.queryByLabelText('Назва тренування')).toBeNull();
});
test('відхід зі списку скасовує читання',async()=>{
 list.mockImplementation(()=>new Promise(()=>{}));const app=await open();await waitFor(()=>expect(list).toHaveBeenCalledTimes(1));const signal=list.mock.calls[0][1];
 const {router}=jest.requireActual<typeof import('expo-router')>('expo-router');await act(async()=>router.push('/'));expect(signal.aborted).toBe(true);expect(app.getPathname()).toBe('/');
});
