import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack, router } from 'expo-router';
import HomeScreen from '../src/screens/HomeScreen';
import NewWorkoutScreen from '../src/screens/NewWorkoutScreen';
import WorkoutStartScreen from '../src/screens/WorkoutStartScreen';
import {listWorkoutTemplates} from '../src/workouts/workoutTemplates';
import { createWorkout, listWorkouts, WorkoutApiError } from '../src/workouts/workoutApi';

jest.mock('../src/workouts/workoutTemplates',()=>({...jest.requireActual('../src/workouts/workoutTemplates'),listWorkoutTemplates:jest.fn()}));
const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'test-token', signOut: mockSignOut }) }));
jest.mock('../src/components/AvatarPicker', () => () => null);
jest.mock('../src/components/AvatarThumbnail', () => () => null);
jest.mock('../src/components/HomeGreeting', () => () => null);
jest.mock('expo-crypto', () => ({ randomUUID: () => '294534b9-30e2-473a-b252-74a1a15cf6bd' }));
jest.mock('../src/workouts/workoutApi', () => ({
  ...jest.requireActual('../src/workouts/workoutApi'),
  createWorkout: jest.fn(), listWorkouts: jest.fn(),
}));
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const create = jest.mocked(createWorkout);
const list = jest.mocked(listWorkouts);
const workout = { id: 7, title: 'Верх тіла', date: '2026-10-23', notes: 'Без поспіху', revision:0,completedAt:null,createdAt: '2026-10-23T10:00:00Z' };
beforeEach(() => {
  list.mockReset().mockResolvedValue({ workouts: [], nextCursor: null });
  create.mockReset().mockResolvedValue(workout);
  jest.mocked(listWorkoutTemplates).mockReset().mockResolvedValue([]);
  mockSignOut.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);
async function open(initialUrl = '/') {
  return renderRouter({ _layout: () => <Stack />, index: HomeScreen, 'workouts/new': WorkoutStartScreen, 'workouts/create': NewWorkoutScreen }, { initialUrl });
}
async function fill() {
  await fireEvent.changeText(screen.getByLabelText('Назва тренування'), 'Верх тіла');
  await fireEvent.changeText(screen.getByLabelText('Дата тренування'), '23.10.2026');
  await fireEvent.changeText(screen.getByLabelText('Нотатка до тренування'), 'Без поспіху');
}

test('порожній список пропонує створити перше тренування', async () => {
  const app = await open();
  await screen.findByText('Тренувань ще немає');
  await fireEvent.press(screen.getByRole('button', { name: '+ Створити тренування' }));
  await screen.findByText('Із чого почнемо?');
  expect(create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button',{name:/Порожнє тренування/}));
  await screen.findByLabelText('Назва тренування');
  expect(app.getPathname()).toBe('/workouts/create');
});
test('після підтвердження сервером повертається до оновленого списку', async () => {
  const app = await open();
  await screen.findByText('Тренувань ще немає');
  await fireEvent.press(screen.getByRole('button', { name: '+ Створити тренування' }));
  await screen.findByText('Із чого почнемо?');
  await fireEvent.press(screen.getByRole('button',{name:/Порожнє тренування/}));
  await screen.findByLabelText('Назва тренування'); await fill();
  list.mockResolvedValue({ workouts: [workout], nextCursor: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти тренування' }));
  await screen.findByText('Верх тіла');
  expect(app.getPathname()).toBe('/');
  expect(screen.getByText('23.10.2026')).toBeTruthy();
  expect(screen.getByText('Без поспіху')).toBeTruthy();
  expect(list).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0][1]).toEqual({ title: 'Верх тіла', date: '2026-10-23', notes: 'Без поспіху', clientRequestId: expect.any(String) });
});
test('помилкова дата залишається у формі, сервер не викликається', async () => {
  await open('/workouts/create'); await fill();
  await fireEvent.changeText(screen.getByLabelText('Дата тренування'), '31.02.2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти тренування' }));
  await screen.findByRole('alert');
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Назва тренування').props.value).toBe('Верх тіла');
});
test('подвійне натискання не запускає два збереження', async () => {
  let confirm!: (value: typeof workout) => void;
  create.mockImplementation(() => new Promise((resolve) => { confirm = resolve; }));
  await open('/workouts/create'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти тренування' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Зберігаємо…' }));
  expect(create).toHaveBeenCalledTimes(1);
  await act(async () => { confirm(workout); });
});
test('збій зв’язку зберігає текст і повторює той самий запит без нового ключа', async () => {
  create.mockRejectedValueOnce(new Error('network'));
  await open('/workouts/create'); await fill();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберегти тренування' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Назва тренування').props.value).toBe('Верх тіла');
  expect(screen.getByLabelText('Назва тренування').props.editable).toBe(false);
  const first = create.mock.calls[0][1];
  await fireEvent.press(screen.getByRole('button', { name: 'Повторити збереження' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[1][1]).toEqual(first);
});
test('помилка списку не показує неправдивий порожній стан і дозволяє повторити', async () => {
  list.mockRejectedValueOnce(new Error('offline'));
  await open();
  await screen.findByRole('alert');
  expect(screen.queryByText('Тренувань ще немає')).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторити завантаження' }));
  await screen.findByText('Тренувань ще немає');
});
test('наступна сторінка додається до списку; повтор помилки зберігає курсор', async () => {
  const cursor = '2026-10-23:7';
  list.mockResolvedValueOnce({ workouts: [workout], nextCursor: cursor }).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ workouts: [{ ...workout, id: 8, title: 'Ноги' }], nextCursor: null });
  await open(); await screen.findByText('Верх тіла');
  await fireEvent.press(screen.getByRole('button', { name: 'Показати ще' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Верх тіла')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторити завантаження' }));
  await screen.findByText('Ноги');
  expect(screen.getByText('Верх тіла')).toBeTruthy();
  expect(list.mock.calls[2][2]).toBe(cursor);
});
test('401 завершує сесію; звичайна мережева помилка її зберігає', async () => {
  list.mockRejectedValue(new WorkoutApiError('Увійдіть повторно.', 401));
  await open();
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});
test('перехід на форму скасовує незавершене завантаження списку', async () => {
  list.mockImplementation(() => new Promise(() => {}));
  await open();
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  const signal = list.mock.calls[0][1];
  await act(async () => router.push('/workouts/new'));
  expect(signal.aborted).toBe(true);
});
