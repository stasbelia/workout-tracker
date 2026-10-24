import { request, WorkoutApiError } from '../workouts/workoutApi';
import { isWorkoutDate } from '../workouts/workoutDate';
export type ProfileUser = { id: number; email: string; nickname: string | null; createdAt: string };
export type Activity = { year: number; today: string; totalWorkouts: number; yearWorkouts: number; activeDays: number; days: { date: string; count: number }[] };
export type Profile = { user: ProfileUser; activity: Activity };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function user(value: unknown): ProfileUser {
  if (!object(value) || !count(value.id) || value.id < 1 || typeof value.email !== 'string' || !value.email.trim() ||
    (value.nickname !== null && (typeof value.nickname !== 'string' || value.nickname.length < 2 || value.nickname.length > 32)) ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new WorkoutApiError('Сервер повернув некоректний профіль.');
  return { id: value.id, email: value.email, nickname: value.nickname as string | null, createdAt: value.createdAt };
}
export async function getProfile(token: string, year: number, today: string, signal: AbortSignal): Promise<Profile> {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 || !isWorkoutDate(today)) throw new WorkoutApiError('Некоректна дата календаря.', 400);
  const data = await request(token, signal, { resource: '/profile', path: `?year=${year}&today=${today}` });
  const activity = data.activity;
  if (!object(activity) || activity.year !== year || activity.today !== today || !count(activity.totalWorkouts) || !count(activity.yearWorkouts) ||
    !count(activity.activeDays) || !Array.isArray(activity.days) || activity.days.length > 366) throw new WorkoutApiError('Некоректна статистика тренувань.');
  let previous = '';
  const days = activity.days.map((day: unknown) => {
    if (!object(day) || typeof day.date !== 'string' || !isWorkoutDate(day.date) || !day.date.startsWith(`${year}-`) || day.date > today ||
      day.date <= previous || !count(day.count) || day.count < 1) throw new WorkoutApiError('Некоректний календар тренувань.');
    previous = day.date; return { date: day.date, count: day.count };
  });
  if (days.length !== activity.activeDays || days.reduce((n, day) => n + day.count, 0) !== activity.yearWorkouts || activity.totalWorkouts < activity.yearWorkouts) throw new WorkoutApiError('Некоректна статистика тренувань.');
  return { user: user(data.user), activity: { year, today, totalWorkouts: activity.totalWorkouts, yearWorkouts: activity.yearWorkouts, activeDays: activity.activeDays, days } };
}
export async function saveNickname(token: string, nickname: string, signal: AbortSignal): Promise<ProfileUser> {
  return user((await request(token, signal, { resource: '/profile', method: 'PATCH', body: { nickname } })).user);
}
