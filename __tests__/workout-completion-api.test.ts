import { setWorkoutCompletion, parseWorkout } from '../src/workouts/workoutApi';
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const original = global.fetch, fetchMock = jest.fn();
const workout = { revision: 0, id: 7, title: 'Ноги', notes: '', date: '2026-10-23', createdAt: '2026-10-23T10:00:00Z', completedAt: '2026-10-23T11:00:00Z' };
beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock; });
afterAll(() => { global.fetch = original; });
const response = (workout: unknown) => ({ ok: true, status: 200, json: async () => ({ workout }) });
test('PATCH надсилає бажаний стан і локальну дату; дані повертаються після валідації', async () => {
  fetchMock.mockResolvedValue(response(workout));
  expect(await setWorkoutCompletion('token', 7, true, '2026-10-23', new AbortController().signal)).toEqual(workout);
  expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/workouts/7/completion', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ completed: true, today: '2026-10-23' }), headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } }));
});
test('інший ID або непідтверджений стан відхиляється', async () => {
  for (const change of [{ id: 8 }, { completedAt: null }]) {
    fetchMock.mockResolvedValue(response({ ...workout, ...change }));
    await expect(setWorkoutCompletion('token', 7, true, '2026-10-23', new AbortController().signal)).rejects.toThrow();
  }
});
test('відсутній або пошкоджений час не перетворюється на виконане тренування', () => {
  for (const completedAt of [undefined, true, 0, '', 'invalid']) expect(() => parseWorkout({ ...workout, completedAt })).toThrow();
  expect(parseWorkout({ ...workout, completedAt: null }).completedAt).toBeNull();
});
test('неправильні ID і дата відхиляються до мережі', async () => {
  await expect(setWorkoutCompletion('token', 0, true, '2026-10-23', new AbortController().signal)).rejects.toThrow();
  await expect(setWorkoutCompletion('token', 7, true, '2026-02-29', new AbortController().signal)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
