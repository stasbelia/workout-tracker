import { API_BASE_URL } from '../config';
import { isWorkoutDate } from './workoutDate';

export type Workout = { id: number; title: string; date: string; notes: string; createdAt: string; completedAt: string | null; revision: number };
export type WorkoutDraft = { title: string; date: string; notes: string; clientRequestId: string };
export type WorkoutPage = { workouts: Workout[]; nextCursor: string | null };
export type ExerciseSetDraft = { reps: number; weightKg: number | null };
export type ExerciseSet = ExerciseSetDraft & { position: number };
export type Exercise = { id: number; name: string; notes: string; position: number; createdAt: string; sets: ExerciseSet[]; revision: number };
export type ExerciseDraft = { name: string; notes: string; sets: ExerciseSetDraft[]; clientRequestId: string };
export type WorkoutDetail = { workout: Workout; exercises: Exercise[] };
export class WorkoutApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validRevision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;

export function parseWorkout(value: unknown): Workout {
  if (!record(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100 ||
      typeof value.date !== 'string' || !isWorkoutDate(value.date) || typeof value.notes !== 'string' || value.notes.length > 500 ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !validRevision(value.revision) ||
      (value.completedAt !== null && (typeof value.completedAt !== 'string' || !Number.isFinite(Date.parse(value.completedAt))))) {
    throw new WorkoutApiError('Сервер повернув некоректні дані тренування.');
  }
  return { id: value.id, title: value.title, date: value.date, notes: value.notes, createdAt: value.createdAt, completedAt: value.completedAt as string | null, revision: value.revision };
}

export async function setWorkoutCompletion(token: string, id: number, completed: boolean, today: string, signal: AbortSignal): Promise<Workout> {
  assertWorkoutId(id);
  if (!isWorkoutDate(today)) throw new WorkoutApiError('Некоректна дата тренування.', 400);
  const workout = parseWorkout((await request(token, signal, {
    path: `/${id}/completion`, method: 'PATCH', body: { completed, today },
  })).workout);
  if (workout.id !== id || Boolean(workout.completedAt) !== completed) throw new WorkoutApiError('Сервер не підтвердив зміну стану тренування.');
  return workout;
}

export async function request(token: string, signal: AbortSignal, options: { body?: object; cursor?: string; path?: string; resource?: '/workouts' | '/exercise-templates' | '/profile' | '/workout-templates'; method?: 'DELETE' | 'PATCH' } = {}): Promise<Record<string, unknown>> {
  const { body, cursor, path = '' } = options;
  if (new URL(API_BASE_URL).protocol !== 'https:') throw new WorkoutApiError('Для роботи з тренуваннями потрібне HTTPS-з’єднання.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${API_BASE_URL}${options.resource ?? '/workouts'}${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
    });
    if (response.ok && response.status === 204 && options.method === 'DELETE') return {};
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = record(data) && typeof data.error === 'string' && data.error.length <= 240 ? data.error : 'Не вдалося виконати запит до тренувань.';
      throw new WorkoutApiError(message, response.status);
    }
    if (!record(data)) throw new WorkoutApiError('Сервер повернув некоректну відповідь.');
    return data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function listWorkouts(token: string, signal: AbortSignal, cursor?: string): Promise<WorkoutPage> {
  const data = await request(token, signal, { cursor });
  if (!Array.isArray(data.workouts) || data.workouts.length > 20 ||
      (data.nextCursor !== null && (typeof data.nextCursor !== 'string' || !/^\d{4}-\d{2}-\d{2}:[1-9]\d{0,9}$/.test(data.nextCursor)))) {
    throw new WorkoutApiError('Сервер повернув некоректний список тренувань.');
  }
  return { workouts: data.workouts.map(parseWorkout), nextCursor: data.nextCursor as string | null };
}

export async function createWorkout(token: string, draft: WorkoutDraft, signal: AbortSignal): Promise<Workout> {
  return parseWorkout((await request(token, signal, { body: draft })).workout);
}

export function parseWorkoutId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) return null;
  return Number(value);
}

function assertWorkoutId(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new WorkoutApiError('Некоректний номер тренування.', 400);
}

function parseExercise(value: unknown): Exercise {
  if (!record(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 1 ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 ||
      typeof value.notes !== 'string' || value.notes.length > 500 ||
      typeof value.position !== 'number' || !Number.isInteger(value.position) || value.position < 1 || value.position > 100 ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !validRevision(value.revision) ||
      !Array.isArray(value.sets) || value.sets.length < 1 || value.sets.length > 30) {
    throw new WorkoutApiError('Сервер повернув некоректні дані вправи.');
  }
  const sets: ExerciseSet[] = value.sets.map((set: unknown, index: number) => {
    if (!record(set) || set.position !== index + 1 || typeof set.reps !== 'number' || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000 ||
        (set.weightKg !== null && (typeof set.weightKg !== 'number' || !Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 1000 ||
          Math.abs(set.weightKg * 100 - Math.round(set.weightKg * 100)) > 1e-8))) {
      throw new WorkoutApiError('Сервер повернув некоректні підходи.');
    }
    return { position: index + 1, reps: set.reps, weightKg: set.weightKg as number | null };
  });
  return { id: value.id, name: value.name, notes: value.notes, position: value.position, createdAt: value.createdAt, sets, revision: value.revision };
}

export async function getWorkout(token: string, id: number, signal: AbortSignal): Promise<WorkoutDetail> {
  assertWorkoutId(id);
  const data = await request(token, signal, { path: `/${id}` });
  if (!Array.isArray(data.exercises) || data.exercises.length > 100) throw new WorkoutApiError('Сервер повернув некоректний список вправ.');
  const workout = parseWorkout(data.workout);
  if (workout.id !== id) throw new WorkoutApiError('Сервер повернув інше тренування.');
  const exercises = data.exercises.map(parseExercise);
  if (new Set(exercises.map((item) => item.id)).size !== exercises.length ||
      exercises.some((item, index) => index > 0 && item.position <= exercises[index - 1].position)) {
    throw new WorkoutApiError('Сервер повернув некоректний порядок вправ.');
  }
  return { workout, exercises };
}

export async function createExercise(token: string, id: number, draft: ExerciseDraft, signal: AbortSignal): Promise<Exercise> {
  assertWorkoutId(id);
  return parseExercise((await request(token, signal, { path: `/${id}/exercises`, body: draft })).exercise);
}

export type WorkoutEdit = Pick<WorkoutDraft, 'title' | 'date' | 'notes'> & { expectedRevision: number; today: string };
export type ExerciseEdit = Pick<ExerciseDraft, 'name' | 'notes' | 'sets'> & { expectedRevision: number };
function assertRevision(value: number) {
  if (!validRevision(value) || value === 2147483647) throw new WorkoutApiError('Перечитай запис перед зміною.', 400);
}
export async function updateWorkout(token: string, id: number, draft: WorkoutEdit, signal: AbortSignal): Promise<Workout> {
  assertWorkoutId(id); assertRevision(draft.expectedRevision);
  const saved = parseWorkout((await request(token, signal, { path: `/${id}`, method: 'PATCH', body: draft })).workout);
  if (saved.id !== id) throw new WorkoutApiError('Сервер повернув інше тренування.');
  return saved;
}
export async function updateExercise(token: string, id: number, exerciseId: number, draft: ExerciseEdit, signal: AbortSignal): Promise<Exercise> {
  assertWorkoutId(id); assertWorkoutId(exerciseId); assertRevision(draft.expectedRevision);
  const saved = parseExercise((await request(token, signal, { path: `/${id}/exercises/${exerciseId}`, method: 'PATCH', body: draft })).exercise);
  if (saved.id !== exerciseId) throw new WorkoutApiError('Сервер повернув іншу вправу.');
  return saved;
}
export async function deleteWorkout(token: string, workout: Pick<Workout, 'id' | 'revision'>, signal: AbortSignal): Promise<void> {
  assertWorkoutId(workout.id); assertRevision(workout.revision);
  await request(token, signal, { path: `/${workout.id}`, method: 'DELETE', body: { expectedRevision: workout.revision } });
}
export async function deleteExercise(token: string, workoutId: number, exercise: Pick<Exercise, 'id' | 'revision'>, signal: AbortSignal): Promise<void> {
  assertWorkoutId(workoutId); assertWorkoutId(exercise.id); assertRevision(exercise.revision);
  await request(token, signal, { path: `/${workoutId}/exercises/${exercise.id}`, method: 'DELETE', body: { expectedRevision: exercise.revision } });
}
