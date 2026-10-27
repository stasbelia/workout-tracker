import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import NewExerciseScreen from '../src/screens/NewExerciseScreen';
import WorkoutDetailScreen from '../src/screens/WorkoutDetailScreen';
import { lightColors, ThemeProvider } from '../src/ui/theme';
import * as SecureStore from 'expo-secure-store';
import { deleteTemplate, listTemplates, saveTemplate } from '../src/workouts/exerciseTemplates';
import { createExercise, getWorkout, WorkoutApiError } from '../src/workouts/workoutApi';
const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'test-token', signOut: mockSignOut }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '294534b9-30e2-473a-b252-74a1a15cf6bd' }));
jest.mock('../src/workouts/exerciseTemplates', () => ({ listTemplates: jest.fn(), saveTemplate: jest.fn(), deleteTemplate: jest.fn() }));
jest.mock('../src/workouts/workoutApi', () => ({ ...jest.requireActual('../src/workouts/workoutApi'), createExercise: jest.fn(), getWorkout: jest.fn() }));
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const list = jest.mocked(listTemplates), save = jest.mocked(saveTemplate), remove = jest.mocked(deleteTemplate), record = jest.mocked(createExercise);
const template = { id:3,name:'Мій жим',notes:'Пауза',sets:[{reps:10,weightKg:40},{reps:8,weightKg:42.5}],createdAt:'2026-10-23T10:00:00Z' };
beforeEach(() => { jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null); list.mockReset().mockResolvedValue([template]); save.mockReset().mockResolvedValue(template); remove.mockReset().mockResolvedValue(undefined); record.mockReset(); mockSignOut.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
const open = () => renderRouter({_layout:()=> <Stack />, 'workouts/[workoutId]/exercises/new':NewExerciseScreen},{initialUrl:'/workouts/7/exercises/new'});
const button = (name:string) => screen.getByRole('button',{name});
async function show() { await fireEvent.press(button('Вибрати вправу або шаблон')); }
async function fill() {
  await fireEvent.changeText(screen.getByLabelText('Назва вправи'),'Мій жим');
  await fireEvent.changeText(screen.getByLabelText('Нотатка до вправи'),'Пауза');
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 1'),'10');
  await fireEvent.changeText(screen.getByLabelText('Вага в кілограмах, підхід 1'),'40');
}
test('пошук базової вправи підставляє лише назву та зберігає введені підходи', async () => {
  await open(); await fill(); await show();
  await fireEvent.changeText(screen.getByLabelText('Пошук вправи або шаблону'),'підтяг');
  await fireEvent.press(await screen.findByRole('button',{name:'Вибрати Підтягування'}));
  expect(screen.getByLabelText('Назва вправи').props.value).toBe('Підтягування');
  expect(screen.getByLabelText('Повторення, підхід 1').props.value).toBe('10');
  expect(screen.getByLabelText('Нотатка до вправи').props.value).toBe('Пауза');
  expect(record).not.toHaveBeenCalled();
});
test('власна назва залишається доступною без вибору зі списку', async () => {
  await open(); await show();
  await fireEvent.press(button('+ Ввести свою назву'));
  await fireEvent.changeText(screen.getByLabelText('Назва вправи'),'Моя вправа');
  expect(screen.getByLabelText('Назва вправи').props.value).toBe('Моя вправа');
});
test('власний шаблон підставляє всі підходи; наступний копіює останній', async () => {
  await open(); await show(); await fireEvent.press(screen.getByRole('tab',{name:'Мої шаблони'}));
  await fireEvent.press(await screen.findByRole('button',{name:'Вибрати Мій жим'}));
  expect(screen.getByLabelText('Назва вправи').props.value).toBe('Мій жим');
  expect(screen.getByLabelText('Вага в кілограмах, підхід 2').props.value).toBe('42,5');
  await fireEvent.press(button('+ Додати підхід'));
  expect(screen.getByLabelText('Повторення, підхід 3').props.value).toBe('8');
  expect(screen.getByLabelText('Вага в кілограмах, підхід 3').props.value).toBe('42,5');
  expect(record).not.toHaveBeenCalled();
});
test('заміна заповненої форми вимагає підтвердження; скасування лишає дані', async () => {
  await open(); await fill(); await show(); await fireEvent.press(screen.getByRole('tab',{name:'Мої шаблони'}));
  await fireEvent.press(await screen.findByRole('button',{name:'Вибрати Мій жим'}));
  await screen.findByText('Замінити поточну форму?');
  await fireEvent.press(button('Скасувати')); await fireEvent.press(button('Закрити'));
  expect(screen.queryByLabelText('Повторення, підхід 2')).toBeNull();
  await show(); await fireEvent.press(screen.getByRole('tab',{name:'Мої шаблони'}));
  await fireEvent.press(await screen.findByRole('button',{name:'Вибрати Мій жим'}));
  await fireEvent.press(button('Замінити форму'));
  expect(screen.getByLabelText('Повторення, підхід 2').props.value).toBe('8');
});
test('збереження шаблону не записує вправу в тренування і не очищає форму', async () => {
  await open(); await fill(); await fireEvent.press(button('Зберегти вправу як шаблон'));
  await screen.findByText('Шаблон «Мій жим» збережено. Він доступний у «Моїх шаблонах».');
  expect(save.mock.calls[0][1]).toMatchObject({name:'Мій жим',notes:'Пауза',sets:[{reps:10,weightKg:40}]});
  expect(record).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Назва вправи').props.value).toBe('Мій жим');
});
test('некоректний шаблон не надсилається; помилка сервера зберігає форму', async () => {
  await open(); await fireEvent.press(button('Зберегти вправу як шаблон'));
  expect(save).not.toHaveBeenCalled();
  await fill(); save.mockRejectedValueOnce(new WorkoutApiError('Назва вже є.',409));
  await fireEvent.press(button('Зберегти вправу як шаблон')); await screen.findByText('Назва вже є.');
  expect(screen.getByLabelText('Назва вправи').props.editable).toBe(true);
  expect(screen.getByLabelText('Вага в кілограмах, підхід 1').props.value).toBe('40');
});
test('мережевий збій списку не блокує базові вправи; повтор завантажує шаблони', async () => {
  list.mockRejectedValueOnce(new Error('offline'));
  await open(); await show(); await fireEvent.press(screen.getByRole('tab',{name:'Мої шаблони'}));
  await screen.findByRole('alert');
  await fireEvent.press(button('Повторити завантаження шаблонів'));
  await screen.findByRole('button',{name:'Вибрати Мій жим'});
  expect(mockSignOut).not.toHaveBeenCalled();
});
test('видалення підтверджується й не змінює поточну форму', async () => {
  await open(); await fill(); await show(); await fireEvent.press(screen.getByRole('tab',{name:'Мої шаблони'}));
  await fireEvent.press(await screen.findByRole('button',{name:'Видалити шаблон Мій жим'}));
  await fireEvent.press(button('Скасувати')); expect(remove).not.toHaveBeenCalled();
  await fireEvent.press(button('Видалити шаблон Мій жим')); await fireEvent.press(button('Видалити шаблон'));
  await waitFor(()=>expect(remove).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button',{name:'Вибрати Мій жим'})).toBeNull();
  await fireEvent.press(button('Закрити')); expect(screen.getByLabelText('Назва вправи').props.value).toBe('Мій жим');
});
test('подвійне натискання зберігає один шаблон і блокує паралельне збереження вправи', async () => {
  let confirm!: (value:typeof template)=>void;
  save.mockImplementation(()=>new Promise(resolve=>{confirm=resolve;}));
  await open(); await fill(); await fireEvent.press(button('Зберегти вправу як шаблон'));
  await fireEvent.press(button('Зберігаємо шаблон…')); await fireEvent.press(button('Зберегти вправу'));
  expect(save).toHaveBeenCalledTimes(1); expect(record).not.toHaveBeenCalled();
  await act(async()=>{confirm(template);});
  expect(screen.getByLabelText('Назва вправи').props.editable).toBe(true);
});
test('закриття меню скасовує читання; 401 завершує сесію', async () => {
  list.mockImplementationOnce(()=>new Promise(()=>{}));
  await open(); await show(); const signal=list.mock.calls[0][1]; await fireEvent.press(button('Закрити'));
  expect(signal.aborted).toBe(true);
  list.mockRejectedValueOnce(new WorkoutApiError('Сесія завершилася.',401));
  await show(); await waitFor(()=>expect(mockSignOut).toHaveBeenCalledTimes(1));
});


test('збережена раніше вправа стає шаблоном і додається до іншого тренування', async () => {
  const exercise = { revision: 0, id: 5, name: template.name, notes: template.notes, position: 1, createdAt: template.createdAt,
    sets: template.sets.map((set, index) => ({ ...set, position: index + 1 })) };
  jest.mocked(getWorkout).mockImplementation(async (_token, id) => ({
    workout: { id, title: 'Моє тренування', date: '2026-10-23', notes: '', revision:0,completedAt:null,createdAt: template.createdAt },
    exercises: id === 7 ? [exercise] : [],
  }));
  record.mockResolvedValue(exercise);
  const app = await renderRouter({ _layout: () => <Stack />,
    'workouts/[workoutId]/index': WorkoutDetailScreen,
    'workouts/[workoutId]/exercises/new': NewExerciseScreen,
  }, { initialUrl: '/workouts/7' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Зберегти вправу як шаблон' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][1]).toMatchObject({ name: template.name, notes: template.notes, sets: template.sets });
  expect(record).not.toHaveBeenCalled();
  const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
  await act(async () => router.push('/workouts/8/exercises/new'));
  expect(screen.getAllByLabelText('Назва вправи')).toHaveLength(1);
  await show(); await fireEvent.press(screen.getByRole('tab', { name: 'Мої шаблони' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Вибрати Мій жим' }));
  await fireEvent.press(button('Зберегти вправу'));
  await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
  expect(record.mock.calls[0][1]).toBe(8);
  expect(record.mock.calls[0][2]).toMatchObject({ name: template.name, notes: template.notes, sets: template.sets });
  expect(app.getPathname()).toBe('/workouts/8');
});


test('світла тема застосовується і до меню вибору вправ, включно з пошуком', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('light');
  await renderRouter({ _layout: () => <ThemeProvider><Stack /></ThemeProvider>,
    'workouts/[workoutId]/exercises/new': NewExerciseScreen,
  }, { initialUrl: '/workouts/7/exercises/new' });
  await show();
  await waitFor(() => expect(screen.getByText('Вибір вправи')).toHaveStyle({ color: lightColors.text }));
  expect(screen.getByLabelText('Пошук вправи або шаблону')).toHaveStyle({ color: lightColors.text, backgroundColor: lightColors.surface });
  expect(screen.getByText('Підтягування')).toHaveStyle({ color: lightColors.text });
});
