import { File } from 'expo-file-system';
import { fetch as uploadFetch } from 'expo/fetch';
import { AvatarApiError, getAvatar, saveAvatar } from '../src/avatar/avatarApi';

let mockApiBaseUrl = 'https://api.example.test/api';
jest.mock('../src/config', () => ({ get API_BASE_URL() { return mockApiBaseUrl; } }), { virtual: true });
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const s3Fetch = jest.mocked(uploadFetch);
const s3 = 'https://avatar-tests-only.s3.eu-central-1.amazonaws.com';
const key = 'avatars/pending/7/12345678-1234-4123-8123-123456789abc.jpg';
const saved = () => ({ url: `${s3}/avatars/verified/7/test.jpg`, expiresAt: new Date(Date.now() + 900_000).toISOString() });
const ok = (body: object) => ({ ok: true, status: 200, json: async () => body });
const controller = () => new AbortController();
// Expo File реалізує Blob; у Node-тесті використовуємо справжній Blob.
const file = Object.assign(new Blob([new Uint8Array(1234)], { type: 'image/jpeg' }), { uri: 'file:///cache/avatar.jpg' }) as File;
const permit = () => ok({ upload: { url: s3, key, fields: { key, Policy: 'fake-policy', 'Content-Type': 'image/jpeg' } } });

beforeEach(() => {
  mockApiBaseUrl = 'https://api.example.test/api';
  mockFetch.mockReset(); s3Fetch.mockReset();
  global.fetch = mockFetch;
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { global.fetch = originalFetch; });

test('відновлення читає аватар із сервера з JWT', async () => {
  const avatar = saved(); mockFetch.mockResolvedValue(ok({ avatar }));
  expect(await getAvatar('test-token', controller().signal)).toEqual(avatar);
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.test/api/avatar', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
});
test('відсутність фото — нормальна відповідь null', async () => {
  mockFetch.mockResolvedValue(ok({ avatar: null }));
  expect(await getAvatar('token', controller().signal)).toBeNull();
});
test('HTTP відхиляється до відправлення токена чи фото', async () => {
  mockApiBaseUrl = 'http://api.example.test/api';
  await expect(getAvatar('private-token', controller().signal)).rejects.toThrow('HTTPS');
  await expect(saveAvatar('private-token', file, controller().signal, jest.fn())).rejects.toThrow('HTTPS');
  expect(mockFetch).not.toHaveBeenCalled(); expect(s3Fetch).not.toHaveBeenCalled();
});
test('дозвіл → S3 → підтвердження; JWT не надсилається до S3', async () => {
  const avatar = saved();
  mockFetch.mockResolvedValueOnce(permit()).mockResolvedValueOnce(ok({ avatar }));
  s3Fetch.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof uploadFetch>>);
  const stage = jest.fn();
  expect(await saveAvatar('test-token', file, controller().signal, stage)).toEqual(avatar);
  const form = s3Fetch.mock.calls[0][1]?.body as FormData;
  expect(Array.from(form.keys())).toEqual(['key', 'Policy', 'Content-Type', 'file']);
  expect(s3Fetch).toHaveBeenCalledWith(s3, { method: 'POST', body: form, signal: expect.any(AbortSignal) });
  expect(mockFetch.mock.calls[1][0]).toBe('https://api.example.test/api/avatar/complete');
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ key });
  expect(stage.mock.calls.flat()).toEqual(['Отримуємо дозвіл…', 'Завантажуємо фото…', 'Перевіряємо та зберігаємо…']);
});
test('помилка S3 не підтверджує запис у базі', async () => {
  mockFetch.mockResolvedValueOnce(permit());
  s3Fetch.mockResolvedValue({ ok: false } as Awaited<ReturnType<typeof uploadFetch>>);
  await expect(saveAvatar('token', file, controller().signal, jest.fn())).rejects.toThrow('S3');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
test('401 зберігає статус для обробки завершеної сесії', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Сесія завершена' }) });
  await expect(getAvatar('token', controller().signal)).rejects.toMatchObject({ status: 401 });
});
test.each(['http://bad.example/photo', 'https://bad.example/photo'])('некоректне посилання %s відхиляється', async (url) => {
  mockFetch.mockResolvedValue(ok({ avatar: { ...saved(), url } }));
  await expect(getAvatar('token', controller().signal)).rejects.toBeInstanceOf(AvatarApiError);
});
test('пошкоджена відповідь дозволу не відправляє фото', async () => {
  mockFetch.mockResolvedValue(ok({ upload: { url: 'https://bad.example', fields: {}, key } }));
  await expect(saveAvatar('token', file, controller().signal, jest.fn())).rejects.toThrow('дозвіл');
  expect(s3Fetch).not.toHaveBeenCalled();
});
test('надмірне фото відхиляється до мережі', async () => {
  await expect(saveAvatar('token', { ...file, size: 5242881 } as File, controller().signal, jest.fn())).rejects.toThrow('5 МіБ');
  expect(mockFetch).not.toHaveBeenCalled();
});
test('запит переривається через 15 секунд', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const result = getAvatar('token', controller().signal);
  const assertion = expect(result).rejects.toThrow('aborted');
  await jest.advanceTimersByTimeAsync(15_000);
  await assertion;
});
