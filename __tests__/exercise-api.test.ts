import { createExercise, getWorkout, parseWorkoutId, WorkoutApiError } from '../src/workouts/workoutApi';
import { parseExerciseInput } from '../src/workouts/exerciseDraft';

jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const mockFetch = jest.fn();
const originalFetch = global.fetch;
const workout = { id: 7, title: 'Ноги', date: '2026-10-23', notes: '', revision:0,completedAt:null,createdAt: '2026-10-23T10:00:00Z' };
const exercise = { revision: 0, id: 9, name: 'Присідання', notes: '', position: 1, createdAt: workout.createdAt, sets: [{ position: 1, reps: 10, weightKg: 42.5 }] };
const draft = { name: 'Присідання', notes: '', sets: [{ reps: 10, weightKg: 42.5 }], clientRequestId: '294534b9-30e2-473a-b252-74a1a15cf6bd' };
const response = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });

test('деталі запитуються за ID та перевіряються разом із підходами', async () => {
  mockFetch.mockResolvedValue(response({ workout, exercises: [exercise] }));
  expect(await getWorkout('token', 7, new AbortController().signal)).toEqual({ workout, exercises: [exercise] });
  expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.test/api/workouts/7');
});
test('додавання надсилає підходи й UUID без userId, позицій та внутрішніх ключів', async () => {
  mockFetch.mockResolvedValue(response({ exercise }, 201));
  expect(await createExercise('test-token', 7, draft, new AbortController().signal)).toEqual(exercise);
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.test/api/workouts/7/exercises', {
    method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(draft), signal: expect.any(AbortSignal),
  });
});
test('помилкові дані вправи або підходів не видаються за збережений результат', async () => {
  for (const change of [{ id: 0 }, { name: '' }, { sets: [] }, { sets: [{ position: 2, reps: 10, weightKg: 40 }] },
    { sets: [{ position: 1, reps: '10', weightKg: 40 }] }, { sets: [{ position: 1, reps: 10, weightKg: -1 }] },
    { sets: [{ position: 1, reps: 10, weightKg: 1.234 }] }, { sets: [{ position: 1, reps: 0, weightKg: null }] }]) {
    mockFetch.mockResolvedValue(response({ exercise: { ...exercise, ...change } }));
    await expect(createExercise('token', 7, draft, new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
  }
});
test('чужий ID у відповіді, дублікати та неправильний порядок відхиляються', async () => {
  for (const data of [
    { workout: { ...workout, id: 8 }, exercises: [] },
    { workout, exercises: [exercise, exercise] },
    { workout, exercises: [{ ...exercise, position: 2 }, { ...exercise, id: 10, position: 1 }] },
  ]) {
    mockFetch.mockResolvedValue(response(data));
    await expect(getWorkout('token', 7, new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
  }
});
test('некоректний ID не створює запиту до мережі', async () => {
  for (const value of [0, -1, 1.5, 2147483648, NaN]) await expect(getWorkout('token', value, new AbortController().signal)).rejects.toMatchObject({ status: 400 });
  for (const value of ['0', '01', '1.5', ['7'], undefined, '2147483648', "1'OR'1"]) expect(parseWorkoutId(value)).toBeNull();
  expect(parseWorkoutId('7')).toBe(7);
  expect(mockFetch).not.toHaveBeenCalled();
});
test('404 зберігає статус для повідомлення про недоступне тренування', async () => {
  mockFetch.mockResolvedValue(response({ error: 'Тренування не знайдено.' }, 404));
  await expect(getWorkout('token', 7, new AbortController().signal)).rejects.toMatchObject({ status: 404 });
});
test('форма приймає кому, нульову та невказану вагу', () => {
  expect(parseExerciseInput('  Присідання  ', '  Без поспіху  ', [
    { key: 1, reps: '10', weight: '42,5' }, { key: 2, reps: '8', weight: '' }, { key: 3, reps: '6', weight: '0' },
  ])).toEqual({ name: 'Присідання', notes: 'Без поспіху', sets: [{ reps: 10, weightKg: 42.5 }, { reps: 8, weightKg: null }, { reps: 6, weightKg: 0 }] });
});
test.each(['-1', '1000,01', '1,234', '1e2', '.', 'Infinity', '2.5.5'])('форма відхиляє неправильну вагу %s', (weight) => {
  expect(typeof parseExerciseInput('Вправа', '', [{ key: 1, reps: '10', weight }])).toBe('string');
});
test.each(['', '0', '-1', '1.5', '1001', 'abc'])('форма відхиляє неправильні повторення %s', (reps) => {
  expect(typeof parseExerciseInput('Вправа', '', [{ key: 1, reps, weight: '' }])).toBe('string');
});
