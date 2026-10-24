import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack, router } from 'expo-router';
import HomeScreen from '../src/screens/HomeScreen';
import WorkoutDetailScreen from '../src/screens/WorkoutDetailScreen';
import NewExerciseScreen from '../src/screens/NewExerciseScreen';
import { createExercise, getWorkout, listWorkouts, WorkoutApiError } from '../src/workouts/workoutApi';

const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'test-token', signOut: mockSignOut }) }));
jest.mock('../src/components/AvatarPicker', () => () => null);
jest.mock('../src/components/AvatarThumbnail', () => () => null);
jest.mock('../src/components/HomeGreeting', () => () => null);
jest.mock('expo-crypto', () => ({ randomUUID: () => '294534b9-30e2-473a-b252-74a1a15cf6bd' }));
jest.mock('../src/workouts/workoutApi', () => ({ ...jest.requireActual('../src/workouts/workoutApi'), createExercise: jest.fn(), getWorkout: jest.fn(), listWorkouts: jest.fn() }));
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const read = jest.mocked(getWorkout), save = jest.mocked(createExercise), list = jest.mocked(listWorkouts);
const workout = { id: 7, title: 'Ноги', date: '2026-10-23', notes: 'Вечір', revision:0,completedAt:null,createdAt: '2026-10-23T10:00:00Z' };
const exercise = { revision: 0, id: 9, name: 'Присідання', notes: 'Без поспіху', position: 1, createdAt: workout.createdAt,
  sets: [{ position: 1, reps: 10, weightKg: 42.5 }, { position: 2, reps: 8, weightKg: null }] };
beforeEach(() => {
  read.mockReset().mockResolvedValue({ workout, exercises: [] });
  save.mockReset().mockResolvedValue(exercise);
  list.mockReset().mockResolvedValue({ workouts: [workout], nextCursor: null });
  mockSignOut.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);
const open = (initialUrl = '/workouts/7') => renderRouter({
  _layout: () => <Stack />, index: HomeScreen,
  'workouts/[workoutId]/index': WorkoutDetailScreen, 'workouts/[workoutId]/exercises/new': NewExerciseScreen,
}, { initialUrl });
async function fill() {
  await fireEvent.changeText(screen.getByLabelText('Назва вправи'), 'Присідання');
  await fireEvent.changeText(screen.getByLabelText('Нотатка до вправи'), 'Без поспіху');
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 1'), '10');
  await fireEvent.changeText(screen.getByLabelText('Вага в кілограмах, підхід 1'), '42,5');
}

test('картка відкриває тренування зі списком вправ', async () => {
  const app = await open('/');
  await screen.findByText('Ноги');
  await fireEvent.press(screen.getByRole('button', { name: 'Відкрити тренування Ноги' }));
  await screen.findByText('Вправ ще немає');
  expect(app.getPathname()).toBe('/workouts/7');
  expect(read.mock.calls[0][1]).toBe(7);
});
test('повний цикл: два підходи, кома у вазі, підтвердження й оновлений список', async () => {
  const app = await open();
  await screen.findByText('Вправ ще немає');
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати вправу' }));
  await screen.findByLabelText('Назва вправи'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 2'), '8');
  await fireEvent.changeText(screen.getByLabelText('Вага в кілограмах, підхід 2'), '');
  read.mockResolvedValue({ workout, exercises: [exercise] });
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await screen.findByText('1. Присідання');
  expect(app.getPathname()).toBe('/workouts/7');
  expect(screen.getByText('10 повтор. · 42,5 кг')).toBeTruthy();
  expect(screen.getByText('8 повтор. · вага не вказана')).toBeTruthy();
  expect(save.mock.calls[0][1]).toBe(7);
  expect(save.mock.calls[0][2]).toEqual({ name: 'Присідання', notes: 'Без поспіху', sets: [{ reps: 10, weightKg: 42.5 }, { reps: 8, weightKg: null }], clientRequestId: expect.any(String) });
});
test('прибирання середнього підходу зберігає значення решти та перенумеровує їх', async () => {
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 2'), '9');
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 3'), '6');
  await fireEvent.press(screen.getByRole('button', { name: 'Прибрати підхід 2' }));
  expect(screen.getByLabelText('Повторення, підхід 2').props.value).toBe('6');
  expect(screen.queryByLabelText('Повторення, підхід 3')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][2].sets.map((set) => set.reps)).toEqual([10, 6]);
});
test('неправильні повторення залишають форму без запиту до сервера', async () => {
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 1'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await screen.findByRole('alert');
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Назва вправи').props.value).toBe('Присідання');
});
test('мережева помилка зберігає всі підходи та повторює той самий UUID', async () => {
  save.mockRejectedValueOnce(new Error('offline'));
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Назва вправи').props.editable).toBe(false);
  expect(screen.getByLabelText('Вага в кілограмах, підхід 1').props.value).toBe('42,5');
  const initial = save.mock.calls[0][2];
  await fireEvent.press(screen.getByRole('button', { name: 'Повторити збереження' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][2]).toEqual(initial);
});
test('подвійне натискання не дублює збереження', async () => {
  let confirm!: (value: typeof exercise) => void;
  save.mockImplementation(() => new Promise((resolve) => { confirm = resolve; }));
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Зберігаємо…' }));
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { confirm(exercise); });
});
test('404 не показує чужі дані й не пропонує додавання вправи', async () => {
  read.mockRejectedValue(new WorkoutApiError('Тренування не знайдено.', 404));
  await open(); await screen.findByRole('alert');
  expect(screen.queryByText('Ноги')).toBeNull();
  expect(screen.queryByRole('button', { name: '+ Додати вправу' })).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});
test('повтор після збою читання завантажує дані без втрати сесії', async () => {
  read.mockRejectedValueOnce(new Error('network'));
  await open(); await screen.findByRole('alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Повторити завантаження' }));
  await screen.findByText('Вправ ще немає');
  expect(mockSignOut).not.toHaveBeenCalled();
});
test('401 при додаванні завершує сесію', async () => {
  save.mockRejectedValue(new WorkoutApiError('Увійдіть повторно.', 401));
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти вправу' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});
test('перехід з деталей скасовує запит; неправильний ID не завантажує дані', async () => {
  read.mockImplementation(() => new Promise(() => {}));
  await open(); await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  const signal = read.mock.calls[0][2];
  await act(async () => router.push('/workouts/7/exercises/new'));
  expect(signal.aborted).toBe(true);
  await act(async () => router.replace('/workouts/invalid'));
  await screen.findByText('Некоректний номер тренування.');
  expect(read).toHaveBeenCalledTimes(1);
});

test('новий підхід копіює останній, редагується незалежно і після видалення бере поточний останній', async () => {
  await open('/workouts/7/exercises/new'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  expect(screen.getByLabelText('Повторення, підхід 2').props.value).toBe('10');
  expect(screen.getByLabelText('Вага в кілограмах, підхід 2').props.value).toBe('42,5');
  await fireEvent.changeText(screen.getByLabelText('Повторення, підхід 2'),'8');
  await fireEvent.changeText(screen.getByLabelText('Вага в кілограмах, підхід 2'),'0');
  expect(screen.getByLabelText('Повторення, підхід 1').props.value).toBe('10');
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  expect(screen.getByLabelText('Повторення, підхід 3').props.value).toBe('8');
  expect(screen.getByLabelText('Вага в кілограмах, підхід 3').props.value).toBe('0');
  await fireEvent.press(screen.getByRole('button', { name: 'Прибрати підхід 3' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Прибрати підхід 2' }));
  await fireEvent.press(screen.getByRole('button', { name: '+ Додати підхід' }));
  expect(screen.getByLabelText('Повторення, підхід 2').props.value).toBe('10');
  expect(screen.getByLabelText('Вага в кілограмах, підхід 2').props.value).toBe('42,5');
});
