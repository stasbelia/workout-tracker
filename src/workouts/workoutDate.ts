export function isWorkoutDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function displayWorkoutDate(value: string): string {
  return value.split('-').reverse().join('.');
}

export function parseWorkoutDate(value: string): string | null {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value.trim())) return null;
  const date = value.trim().split('.').reverse().join('-');
  return isWorkoutDate(date) ? date : null;
}

export function todayWorkoutDate(now = new Date()): string {
  // Дата тренування календарна: UTC може змінити день біля опівночі.
  return [String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
