import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import WorkoutCompletion from '../src/components/WorkoutCompletion';
import { setWorkoutCompletion, Workout, WorkoutApiError } from '../src/workouts/workoutApi';
import { todayWorkoutDate } from '../src/workouts/workoutDate';
const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'test-token', signOut: mockSignOut }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => (() => void)) => { jest.requireActual<typeof import('react')>('react').useEffect(callback, [callback]); } }));
jest.mock('../src/workouts/workoutApi', () => ({ ...jest.requireActual('../src/workouts/workoutApi'), setWorkoutCompletion: jest.fn() }));
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const save = jest.mocked(setWorkoutCompletion);
const workout: Workout = { id: 7, title: 'Ноги', notes: '', date: todayWorkoutDate(), createdAt: '2026-10-23T10:00:00Z', revision: 0, completedAt: null };
const done = { ...workout, completedAt: '2026-10-23T11:00:00Z' };
const onChange = jest.fn();
beforeEach(() => { save.mockReset().mockResolvedValue(done); onChange.mockReset(); mockSignOut.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
const open = (value = workout, hasExercises = true) => render(<WorkoutCompletion workout={value} hasExercises={hasExercises} onChange={onChange} />);

test('стан змінюється лише після підтвердження; подвійне натискання не дублює запит', async () => {
  let resolve!: (value: Workout) => void; save.mockImplementation(() => new Promise(r => { resolve = r; }));
  await open(); await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' }));
  expect(screen.getByText('Не завершено')).toBeTruthy(); expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Зберігаємо стан…' })); expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(done); }); expect(onChange).toHaveBeenCalledWith(done);
  expect(save.mock.calls[0].slice(0, 4)).toEqual(['test-token', 7, true, todayWorkoutDate()]);
});
test('втрата відповіді зберігає бажаний стан для повтору', async () => {
  save.mockRejectedValueOnce(new Error('offline')); await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' })); await screen.findByRole('alert');
  expect(onChange).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole('button', { name: 'Повторити зміну стану' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(done)); expect(save.mock.calls.map(c => c[2])).toEqual([true, true]);
});
test('скасування завершення надсилає false, а не видалення тренування', async () => {
  save.mockResolvedValue(workout); await open(done);
  expect(screen.getByText('✓ Виконано')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Скасувати завершення' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(workout)); expect(save.mock.calls[0][2]).toBe(false);
});
test('порожні й майбутні тренування не надсилаються на завершення', async () => {
  await open(workout, false); await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' })); expect(save).not.toHaveBeenCalled();
  await cleanup(); await open({ ...workout, date: '2100-12-31' });
  await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' })); expect(save).not.toHaveBeenCalled();
});
test('401 завершує сесію, серверна помилка не показує вигаданий успіх', async () => {
  save.mockRejectedValueOnce(new WorkoutApiError('Увійдіть повторно.', 401)); await open();
  await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' }));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1)); expect(onChange).not.toHaveBeenCalled();
});
test('відхід перериває запит, пізня відповідь не змінює екран', async () => {
  let resolve!: (value: Workout) => void; save.mockImplementation(() => new Promise(r => { resolve = r; }));
  const app = await open(); await fireEvent.press(screen.getByRole('button', { name: 'Завершити тренування' }));
  const signal = save.mock.calls[0][4]; await app.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => { resolve(done); }); expect(onChange).not.toHaveBeenCalled();
});
