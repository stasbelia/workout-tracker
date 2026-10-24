import { createWorkout, listWorkouts, WorkoutApiError } from '../src/workouts/workoutApi';
import { displayWorkoutDate, parseWorkoutDate, todayWorkoutDate } from '../src/workouts/workoutDate';

jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const mockFetch = jest.fn();
const originalFetch = global.fetch;
const workout = { id: 7, title: 'Верх тіла', date: '2026-10-23', notes: '', revision:0,completedAt:null,createdAt: '2026-10-23T10:00:00Z' };
const draft = { title: workout.title, date: workout.date, notes: '', clientRequestId: '294534b9-30e2-473a-b252-74a1a15cf6bd' };
beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });
afterEach(() => jest.useRealTimers());
afterAll(() => { global.fetch = originalFetch; });
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('створення надсилає поля та ключ повтору лише на власний HTTPS API', async () => {
  mockFetch.mockResolvedValue(response({ workout }, 201));
  expect(await createWorkout('test-token', draft, new AbortController().signal)).toEqual(workout);
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.test/api/workouts', {
    method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(draft), signal: expect.any(AbortSignal),
  });
});
test('сторінка списку передає курсор без зміни його значення', async () => {
  mockFetch.mockResolvedValue(response({ workouts: [workout], nextCursor: null }));
  expect((await listWorkouts('token', new AbortController().signal, '2026-10-23:7')).workouts).toEqual([workout]);
  expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.test/api/workouts?cursor=2026-10-23%3A7');
});
test('некоректна відповідь не видається за успішне збереження', async () => {
  for (const change of [{ id: 0 }, { date: '2026-02-29' }, { title: '' }, { notes: null }, { createdAt: 'invalid' }]) {
    mockFetch.mockResolvedValue(response({ workout: { ...workout, ...change } }));
    await expect(createWorkout('token', draft, new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
  }
  for (const body of [{ workouts: null, nextCursor: null }, { workouts: [workout] }, { workouts: [workout], nextCursor: 'invalid' }]) {
    mockFetch.mockResolvedValue(response(body));
    await expect(listWorkouts('token', new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
  }
});
test('HTTP помилка зберігає статус для обробки завершеної сесії', async () => {
  mockFetch.mockResolvedValue(response({ error: 'Увійдіть повторно.' }, 401));
  await expect(listWorkouts('token', new AbortController().signal)).rejects.toMatchObject({ status: 401 });
});
test('відхід з екрана перериває запит', async () => {
  mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const controller = new AbortController();
  const result = listWorkouts('token', controller.signal);
  controller.abort();
  await expect(result).rejects.toThrow('aborted');
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
});
test('завислий запит переривається через 15 секунд', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('timeout')));
  }));
  const result = expect(listWorkouts('token', new AbortController().signal)).rejects.toThrow('timeout');
  await jest.advanceTimersByTimeAsync(15_000);
  await result;
});
test('календарна дата перевіряє високосний рік і не залежить від UTC', () => {
  expect(parseWorkoutDate('29.02.2024')).toBe('2024-02-29');
  for (const date of ['29.02.2026', '31.04.2026', '23.13.2026', '2026-10-23', '1.1.2026']) expect(parseWorkoutDate(date)).toBeNull();
  expect(displayWorkoutDate('2026-10-23')).toBe('23.10.2026');
  const local = new Date(2026, 9, 23, 0, 1);
  expect(todayWorkoutDate(local)).toBe('2026-10-23');
});
