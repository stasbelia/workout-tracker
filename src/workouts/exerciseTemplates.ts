import { ExerciseDraft, ExerciseSetDraft, request, WorkoutApiError } from './workoutApi';

export type ExerciseTemplate = { id: number; name: string; notes: string; sets: ExerciseSetDraft[]; createdAt: string };
function parseTemplate(value: unknown): ExerciseTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkoutApiError('Некоректний шаблон вправи.');
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || (item.id as number) < 1 || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 ||
      typeof item.notes !== 'string' || item.notes.length > 500 || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
      !Array.isArray(item.sets) || item.sets.length < 1 || item.sets.length > 30) throw new WorkoutApiError('Некоректний шаблон вправи.');
  const sets = item.sets.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkoutApiError('Некоректні підходи шаблону.');
    const set = value as Record<string, unknown>;
    if (typeof set.reps !== 'number' || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000 ||
        (set.weightKg !== null && (typeof set.weightKg !== 'number' || !Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 1000 ||
          Math.abs(set.weightKg * 100 - Math.round(set.weightKg * 100)) > 1e-8))) throw new WorkoutApiError('Некоректні підходи шаблону.');
    return { reps: set.reps, weightKg: set.weightKg as number | null };
  });
  return { id: item.id as number, name: item.name, notes: item.notes, createdAt: item.createdAt, sets };
}
export async function listTemplates(token: string, signal: AbortSignal): Promise<ExerciseTemplate[]> {
  const data = await request(token, signal, { resource: '/exercise-templates' });
  if (!Array.isArray(data.templates) || data.templates.length > 100) throw new WorkoutApiError('Некоректний список шаблонів.');
  const templates = data.templates.map(parseTemplate);
  if (new Set(templates.map((item) => item.id)).size !== templates.length) throw new WorkoutApiError('Некоректний список шаблонів.');
  return templates;
}
export async function saveTemplate(token: string, draft: ExerciseDraft, signal: AbortSignal): Promise<ExerciseTemplate> {
  return parseTemplate((await request(token, signal, { resource: '/exercise-templates', body: draft })).template);
}
export async function deleteTemplate(token: string, id: number, signal: AbortSignal): Promise<void> {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new WorkoutApiError('Некоректний номер шаблону.', 400);
  await request(token, signal, { resource: '/exercise-templates', path: `/${id}`, method: 'DELETE' });
}
