import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import RootLayout from '../src/app/_layout';
import HomeScreen from '../src/app/index';
import ProfileScreen from '../src/app/profile';
import WorkoutTemplatesScreen from '../src/screens/WorkoutTemplatesScreen';
import LoginScreen from '../src/app/login';
import RegisterScreen from '../src/app/register';
import NewWorkoutScreen from '../src/app/workouts/new';
import WorkoutFormScreen from '../src/screens/NewWorkoutScreen';
import OneRepMaxScreen from '../src/screens/OneRepMaxScreen';
import WorkoutDetailScreen from '../src/screens/WorkoutDetailScreen';
import NewExerciseScreen from '../src/screens/NewExerciseScreen';
import EditWorkoutScreen from '../src/screens/EditWorkoutScreen';

// Цей набір перевіряє маршрути та сесію; мережевий цикл аватара має окремі тести.
jest.mock('../src/components/AvatarPicker', () => () => null);
jest.mock('../src/components/ProfileDetails', () => () => null);
jest.mock('../src/ui/theme', () => ({ ...jest.requireActual('../src/ui/theme'), ThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/components/AvatarThumbnail', () => () => null);
jest.mock('../src/components/HomeGreeting', () => () => null);
jest.mock('../src/components/WorkoutList', () => function MockWorkoutList({ header, footer }: { header: React.ReactElement; footer: React.ReactElement }) {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.createElement(React.Fragment, null, header, footer);
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });

const getToken = jest.mocked(SecureStore.getItemAsync);
const saveToken = jest.mocked(SecureStore.setItemAsync);
const deleteToken = jest.mocked(SecureStore.deleteItemAsync);
const originalFetch = global.fetch;
const mockFetch = jest.fn();
const validSessionResponse = {
  ok: true,
  status: 200,
  json: async () => ({ user: { id: 7, email: 'demo@example.test' } }),
};
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
let app: Awaited<ReturnType<typeof renderRouter>>;

beforeEach(() => {
  getToken.mockReset().mockResolvedValue(null);
  saveToken.mockReset().mockResolvedValue(undefined);
  deleteToken.mockReset().mockResolvedValue(undefined);
  mockFetch.mockReset().mockResolvedValue(validSessionResponse);
  alert.mockClear();
  global.fetch = mockFetch;
});

afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

afterAll(() => {
  global.fetch = originalFetch;
  alert.mockRestore();
});

async function openApp(initialUrl = '/') {
  app = await renderRouter(
    { _layout: RootLayout, index: HomeScreen, profile: ProfileScreen, 'workout-templates': WorkoutTemplatesScreen, login: LoginScreen, register: RegisterScreen, 'workouts/new': NewWorkoutScreen, 'workouts/create':WorkoutFormScreen,'one-rep-max':OneRepMaxScreen,
      'workouts/[workoutId]/index': WorkoutDetailScreen, 'workouts/[workoutId]/exercises/new': NewExerciseScreen, 'workouts/[workoutId]/edit': EditWorkoutScreen, 'workouts/[workoutId]/exercises/[exerciseId]/edit': NewExerciseScreen },
    { initialUrl },
  );
}

async function openLogin() {
  await openApp();
  await screen.findByText('Вхід у систему');
}

async function submitLogin() {
  await fireEvent.changeText(screen.getByPlaceholderText('Електронна пошта'), 'demo@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Пароль'), 'test-passphrase');
  await fireEvent.press(screen.getByRole('button', { name: 'Увійти' }));
}

test('без сесії головний маршрут відкриває вхід', async () => {
  await openLogin();

  expect(app.getPathname()).toBe('/login');
  expect(screen.queryByText('Мої тренування')).toBeNull();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('створення тренування захищене від відкриття без сесії', async () => {
  await openApp('/workouts/new');
  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
  expect(screen.queryByLabelText('Назва тренування')).toBeNull();
});

test.each(['/workouts/7', '/workouts/7/exercises/new', '/profile', '/workout-templates'])('маршрут %s захищений без сесії', async (path) => {
  await openApp(path);
  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
  expect(mockFetch).not.toHaveBeenCalled();
});

test('вхід зберігає токен, відкриває головну, а вихід очищає сесію та історію', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'test-token' }) });
  await openLogin();
  await submitLogin();

  await screen.findByText('Мої тренування');
  expect(saveToken).toHaveBeenCalledWith('userToken', 'test-token');
  expect(app.getPathname()).toBe('/');
  expect(router.canGoBack()).toBe(false);

  await act(async () => router.push('/login'));
  expect(app.getPathname()).toBe('/');

  if (app.getPathname() === '/') {
    expect(screen.queryByRole('button', { name: 'Вийти з акаунта' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити профіль' }));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Вийти з акаунта' }));
  await screen.findByText('Вхід у систему');
  expect(deleteToken).toHaveBeenCalledWith('userToken');
  expect(app.getPathname()).toBe('/login');
  expect(router.canGoBack()).toBe(false);
});

test('збережена сесія відкриває головну навіть за посиланням на реєстрацію', async () => {
  getToken.mockResolvedValue('saved-token');
  await openApp('/register');

  await screen.findByText('Мої тренування');
  expect(app.getPathname()).toBe('/');
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.test/api/auth/me', {
    headers: { Authorization: 'Bearer saved-token' },
    signal: expect.any(AbortSignal),
  });
});

test('неправильний пароль залишає користувача на вході', async () => {
  mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Невірний email або пароль' }) });
  await openLogin();
  await submitLogin();

  await waitFor(() => expect(alert).toHaveBeenCalledWith('Помилка входу', 'Невірний email або пароль'));
  expect(app.getPathname()).toBe('/login');
  expect(saveToken).not.toHaveBeenCalled();
  expect(screen.queryByText('Мої тренування')).toBeNull();
});

test('помилка збереження токена не відкриває головну', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'test-token' }) });
  saveToken.mockRejectedValue(new Error('Storage unavailable'));
  await openLogin();
  await submitLogin();

  await waitFor(() => expect(alert).toHaveBeenCalledWith('Помилка збереження сесії', expect.any(String)));
  expect(app.getPathname()).toBe('/login');
  expect(screen.queryByText('Мої тренування')).toBeNull();
});

test.each([undefined, '', '   ', 123])('відповідь без коректного токена (%p) не відкриває головну', async (token) => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ token }) });
  await openLogin();
  await submitLogin();

  await waitFor(() => expect(alert).toHaveBeenCalledWith('Помилка входу', expect.any(String)));
  expect(saveToken).not.toHaveBeenCalled();
  expect(app.getPathname()).toBe('/login');
});

test('помилка читання сховища блокує головну та дозволяє повторити відновлення', async () => {
  getToken.mockRejectedValueOnce(new Error('Storage unavailable'));
  await openApp();

  await screen.findByText('Не вдалося відновити сесію');
  expect(screen.queryByText('Мої тренування')).toBeNull();
  expect(deleteToken).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.queryByText('Відновлюємо сесію…')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));
  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
});

test('головна не відкривається, поки сервер не підтвердить збережений токен', async () => {
  getToken.mockResolvedValue('saved-token');
  let finishCheck!: (response: typeof validSessionResponse) => void;
  mockFetch.mockReturnValue(new Promise((resolve) => { finishCheck = resolve; }));
  await openApp();

  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Відновлюємо сесію…')).toBeTruthy();
  expect(screen.queryByText('Мої тренування')).toBeNull();
  expect(screen.queryByText('Вхід у систему')).toBeNull();

  await act(async () => finishCheck(validSessionResponse));
  await screen.findByText('Мої тренування');
});

test('401 видаляє недійсний токен та відкриває вхід', async () => {
  getToken.mockResolvedValue('expired-token');
  mockFetch.mockResolvedValue({ status: 401, ok: false });
  await openLogin();

  expect(deleteToken).toHaveBeenCalledWith('userToken');
  expect(screen.queryByText('Мої тренування')).toBeNull();
  expect(app.getPathname()).toBe('/login');
});

test.each([403, 404, 500])('відповідь %i не видаляє токен і не відкриває захищений екран', async (status) => {
  getToken.mockResolvedValue('saved-token');
  mockFetch.mockResolvedValue({ status, ok: false });
  await openApp();

  await screen.findByText('Не вдалося відновити сесію');
  expect(deleteToken).not.toHaveBeenCalled();
  expect(screen.queryByText('Мої тренування')).toBeNull();
  expect(screen.queryByText('Вхід у систему')).toBeNull();
});

test('після збою мережі повторна спроба перевіряє той самий токен і відкриває головну', async () => {
  getToken.mockResolvedValue('saved-token');
  mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));
  await openApp();
  await screen.findByText('Не вдалося відновити сесію');
  expect(deleteToken).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));
  await screen.findByText('Мої тренування');
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch).toHaveBeenLastCalledWith('https://api.example.test/api/auth/me', expect.objectContaining({
    headers: { Authorization: 'Bearer saved-token' },
  }));
  expect(deleteToken).not.toHaveBeenCalled();
  expect(saveToken).not.toHaveBeenCalled();
});

test.each([null, {}, { user: null }, { user: { id: '7', email: 'demo@example.test' } }, { user: { id: 7 } }])(
  'пошкоджена відповідь 200 (%p) не підтверджує вхід і не видаляє токен', async (data) => {
    getToken.mockResolvedValue('saved-token');
    mockFetch.mockResolvedValue({ status: 200, ok: true, json: async () => data });
    await openApp();

    await screen.findByText('Не вдалося відновити сесію');
    expect(deleteToken).not.toHaveBeenCalled();
    expect(screen.queryByText('Мої тренування')).toBeNull();
  },
);

test('неправильний JSON не стирає збережений вхід', async () => {
  getToken.mockResolvedValue('saved-token');
  mockFetch.mockResolvedValue({ status: 200, ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
  await openApp();

  await screen.findByText('Не вдалося відновити сесію');
  expect(deleteToken).not.toHaveBeenCalled();
  expect(screen.queryByText('Мої тренування')).toBeNull();
});

test('завислий запит переривається через 10 секунд і дозволяє повторну спробу', async () => {
  jest.useFakeTimers();
  getToken.mockResolvedValue('saved-token');
  mockFetch.mockImplementationOnce((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  await openApp();
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

  await act(async () => jest.advanceTimersByTime(10_000));
  await screen.findByText('Не вдалося відновити сесію');
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(deleteToken).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));
  await screen.findByText('Мої тренування');
});

test('помилка очищення недійсного токена дозволяє повторити спробу', async () => {
  getToken.mockResolvedValue('expired-token');
  mockFetch.mockResolvedValue({ status: 401, ok: false });
  deleteToken.mockRejectedValueOnce(new Error('Storage unavailable'));
  await openApp();
  await screen.findByText('Не вдалося відновити сесію');
  expect(screen.queryByText('Мої тренування')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще раз' }));
  await screen.findByText('Вхід у систему');
  expect(deleteToken).toHaveBeenCalledTimes(2);
});

test('відповідь на запит після закриття застосунку не очищає сховище', async () => {
  getToken.mockResolvedValue('saved-token');
  let finishCheck!: (response: { status: number; ok: boolean }) => void;
  mockFetch.mockReturnValue(new Promise((resolve) => { finishCheck = resolve; }));
  await openApp();
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

  await app.unmount();
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => finishCheck({ status: 401, ok: false }));
  expect(deleteToken).not.toHaveBeenCalled();
});

test('посилання реєстрації та повернення працюють через Router', async () => {
  await openLogin();
  await fireEvent.press(screen.getByText('Немає акаунта? Зареєструватися'));
  await screen.findByText('Створити акаунт');
  expect(app.getPathname()).toBe('/register');

  await fireEvent.press(screen.getByText('Вже є акаунт? Увійти'));
  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
  expect(router.canGoBack()).toBe(false);
});

test('помилка видалення токена показує помилку та дозволяє повторити вихід', async () => {
  getToken.mockResolvedValue('saved-token');
  deleteToken.mockRejectedValueOnce(new Error('Storage unavailable'));
  await openApp();
  await screen.findByText('Мої тренування');

  if (app.getPathname() === '/') {
    expect(screen.queryByRole('button', { name: 'Вийти з акаунта' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити профіль' }));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Вийти з акаунта' }));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Помилка виходу', expect.any(String)));
  expect(app.getPathname()).toBe('/profile');

  if (app.getPathname() === '/') {
    expect(screen.queryByRole('button', { name: 'Вийти з акаунта' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Відкрити профіль' }));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Вийти з акаунта' }));
  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
});

test('успішна реєстрація повертає до входу без відкриття головної', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ message: 'Акаунт створено!' }) });
  await openApp('/register');
  await screen.findByText('Створити акаунт');

  await fireEvent.changeText(screen.getByPlaceholderText('Електронна пошта'), 'demo@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText('Пароль'), 'test-passphrase');
  await fireEvent.changeText(screen.getByPlaceholderText('Підтвердіть пароль'), 'test-passphrase');
  await fireEvent.press(screen.getByText('Зареєструватися'));

  await screen.findByText('Вхід у систему');
  expect(app.getPathname()).toBe('/login');
  expect(saveToken).not.toHaveBeenCalled();
  expect(router.canGoBack()).toBe(false);
});

test.each(['/workouts/7/edit','/workouts/7/exercises/9/edit'])('редагування %s захищене від відкриття без сесії',async(path)=>{await openApp(path);await screen.findByText('Вхід у систему');expect(app.getPathname()).toBe('/login');});

test.each(['/workouts/create','/one-rep-max'])('новий маршрут %s захищений сесією',async(path)=>{await openApp(path);await screen.findByText('Вхід у систему');expect(app.getPathname()).toBe('/login');});
