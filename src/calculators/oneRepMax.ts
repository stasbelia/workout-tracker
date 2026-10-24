export type OneRepMax = { weightKg: number; reps: number; estimatedKg: number; percentages: { percent: number; weightKg: number }[] };
export function calculateOneRepMax(weightInput: string, repsInput: string): OneRepMax | string {
  const weight = weightInput.trim().replace(',', '.'), repsText = repsInput.trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(weight) || Number(weight) <= 0 || Number(weight) > 1000) {
    return 'Введи вагу понад 0 і до 1000 кг, до двох знаків після коми.';
  }
  if (!/^\d{1,4}$/.test(repsText) || Number(repsText) < 1 || Number(repsText) > 1000) {
    return 'Введи від 1 до 1000 цілих повторень.';
  }
  const weightKg = Number(weight), reps = Number(repsText);
  // Epley with k = 1/30 (approximately 0.0333). A single rep is
  // the entered weight itself; it must not receive a formula bonus.
  const estimatedKg = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
  return { weightKg, reps, estimatedKg, percentages: [50,60,65,70,75,80,85,90,95,100].map(percent => ({ percent, weightKg: estimatedKg * percent / 100 })) };
}
export function formatKg(value: number): string {
  return (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
}
