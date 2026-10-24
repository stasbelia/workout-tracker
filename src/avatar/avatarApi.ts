import { fetch as uploadFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { API_BASE_URL } from '../config';

export type Avatar = { url: string; expiresAt: string };
export class AvatarApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export function ensureAvatarHttps() {
  const url = new URL(API_BASE_URL);
  if (url.protocol !== 'https:') {
    throw new AvatarApiError('Для аватара потрібна HTTPS-адреса бекенду. Спочатку налаштуй захищене з’єднання із сервером.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isS3Url(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /^[a-z0-9-]+\.s3\.eu-central-1\.amazonaws\.com$/.test(url.hostname);
  } catch { return false; }
}

function parseAvatar(value: unknown): Avatar | null {
  if (value === null) return null;
  if (!isRecord(value) || !isS3Url(value.url) || typeof value.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) {
    throw new AvatarApiError('Сервер повернув некоректні дані аватара.');
  }
  return { url: value.url, expiresAt: value.expiresAt };
}

// Кожен мережевий крок має тайм-аут і скасовується після виходу з екрана.
async function withTimeout<T>(signal: AbortSignal, milliseconds: number, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, milliseconds);
  try { return await action(controller.signal); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

async function request(path: string, token: string, signal: AbortSignal, body?: object): Promise<Record<string, unknown>> {
  ensureAvatarHttps();
  return withTimeout(signal, path === '/complete' ? 45_000 : 15_000, async (requestSignal) => {
    const response = await fetch(`${API_BASE_URL}/avatar${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: requestSignal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AvatarApiError(isRecord(data) && typeof data.error === 'string' ? data.error : 'Не вдалося зв’язатися зі сховищем аватара.', response.status);
    }
    if (!isRecord(data)) throw new AvatarApiError('Сервер повернув некоректну відповідь.');
    return data;
  });
}

export async function getAvatar(token: string, signal: AbortSignal): Promise<Avatar | null> {
  return parseAvatar((await request('', token, signal)).avatar);
}

export async function saveAvatar(token: string, file: File, signal: AbortSignal, onStage: (stage: string) => void): Promise<Avatar> {
  ensureAvatarHttps();
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new AvatarApiError('Підготовлене фото має бути не більше 5 МіБ.');
  }
  onStage('Отримуємо дозвіл…');
  const { upload } = await request('/upload', token, signal, { contentType: 'image/jpeg', fileSize: file.size });
  if (!isRecord(upload) || !isS3Url(upload.url) || !isRecord(upload.fields) ||
      typeof upload.key !== 'string' || !/^avatars\/pending\/\d+\/[0-9a-f-]+\.jpg$/.test(upload.key) ||
      upload.fields.key !== upload.key || !Object.values(upload.fields).every((value) => typeof value === 'string')) {
    throw new AvatarApiError('Сервер повернув некоректний дозвіл на завантаження.');
  }
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value as string);
  // Файл останній. JWT і власний Content-Type до S3 не додаємо.
  form.append('file', file, 'avatar.jpg');
  onStage('Завантажуємо фото…');
  await withTimeout(signal, 30_000, async (requestSignal) => {
    const response = await uploadFetch(upload.url as string, { method: 'POST', body: form, signal: requestSignal });
    if (!response.ok) throw new AvatarApiError('S3 не прийняв фото. Спробуй завантажити його ще раз.');
  });
  onStage('Перевіряємо та зберігаємо…');
  const avatar = parseAvatar((await request('/complete', token, signal, { key: upload.key })).avatar);
  if (!avatar) throw new AvatarApiError('Сервер не підтвердив збереження фото.');
  return avatar;
}
