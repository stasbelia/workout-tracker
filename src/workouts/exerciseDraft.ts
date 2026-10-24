import type { ExerciseSetDraft } from './workoutApi';

export type SetInput = { key: number; reps: string; weight: string };

export function parseExerciseInput(name: string, notes: string, inputs: SetInput[]): { name: string; notes: string; sets: ExerciseSetDraft[] } | string {
  if (!name.trim() || name.trim().length > 100 || /\p{Cc}/u.test(name)) return 'Введи назву вправи: від 1 до 100 символів.';
  if (notes.trim().length > 500 || /[^\P{Cc}\n\t]/u.test(notes)) return 'Перевір нотатку: до 500 символів без службових знаків.';
  if (inputs.length < 1 || inputs.length > 30) return 'Додай від 1 до 30 підходів.';
  const sets: ExerciseSetDraft[] = [];
  for (const [index, input] of inputs.entries()) {
    const reps = input.reps.trim();
    const weight = input.weight.trim().replace(',', '.');
    if (!/^\d{1,4}$/.test(reps) || Number(reps) < 1 || Number(reps) > 1000) return `Підхід ${index + 1}: введи кількість повторень від 1 до 1000.`;
    if (weight && (!/^\d{1,4}(\.\d{1,2})?$/.test(weight) || Number(weight) > 1000)) {
      return `Підхід ${index + 1}: вага від 0 до 1000 кг, до двох знаків після коми. Наприклад, 42,5.`;
    }
    sets.push({ reps: Number(reps), weightKg: weight ? Number(weight) : null });
  }
  return { name: name.trim(), notes: notes.trim(), sets };
}
