import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import AvatarPicker from '../src/components/AvatarPicker';
import { getAvatar, saveAvatar } from '../src/avatar/avatarApi';
import { prepareAvatar } from '../src/avatar/prepareAvatar';

const mockSignOut = jest.fn();
jest.mock('../src/auth/SessionProvider', () => ({ useSession: () => ({ token: 'test-token', signOut: mockSignOut }) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../src/avatar/prepareAvatar', () => ({ prepareAvatar: jest.fn() }));
jest.mock('../src/avatar/avatarApi', () => ({
  getAvatar: jest.fn(), saveAvatar: jest.fn(), ensureAvatarHttps: jest.fn(),
  AvatarApiError: class extends Error {},
}));
const read = jest.mocked(getAvatar);
const save = jest.mocked(saveAvatar);
const prepare = jest.mocked(prepareAvatar);
const pick = jest.mocked(ImagePicker.launchImageLibraryAsync);
const oldAvatar = { url: 'https://example.test/old.jpg', expiresAt: '2099-01-01T00:00:00Z' };
const newAvatar = { ...oldAvatar, url: 'https://example.test/new.jpg' };
const remove = jest.fn();
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  read.mockReset().mockResolvedValue(oldAvatar);
  save.mockReset().mockResolvedValue(newAvatar);
  prepare.mockReset().mockResolvedValue({ exists: true, delete: remove } as unknown as Awaited<ReturnType<typeof prepareAvatar>>);
  pick.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///selected.heic', width: 1000, height: 800 }] } as ImagePicker.ImagePickerResult);
  remove.mockClear(); alert.mockClear();
});
afterEach(cleanup);
afterAll(() => alert.mockRestore());

test('після відкриття показує збережений аватар', async () => {
  await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(oldAvatar.url);
  expect(screen.queryByText('Фото збережене у профілі')).toBeNull();
});
test('скасування вибору не змінює фото й не завантажує файл', async () => {
  pick.mockResolvedValue({ canceled: true, assets: null });
  await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  await fireEvent.press(screen.getByRole('button', { name: 'Змінити фото' }));
  await waitFor(() => expect(pick).toHaveBeenCalledTimes(1));
  expect(save).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(oldAvatar.url);
});
test('нове фото з’являється лише після підтвердження сервера, кеш видаляється', async () => {
  let confirm!: (value: typeof newAvatar) => void;
  let uploadStarted!: () => void;
  const started = new Promise<void>((resolve) => { uploadStarted = resolve; });
  save.mockImplementation(() => new Promise((resolve) => { confirm = resolve; uploadStarted(); }));
  await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  await act(async () => {
    const press = fireEvent.press(screen.getByRole('button', { name: 'Змінити фото' }));
    await started;
    expect(prepare).toHaveBeenCalledWith('file:///selected.heic');
    expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(oldAvatar.url);
    confirm(newAvatar);
    await press;
  });
  expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(newAvatar.url);
  expect(remove).toHaveBeenCalledTimes(1);
});
test('помилка збереження залишає старе фото та дозволяє повторити', async () => {
  save.mockRejectedValue(new Error('network error'));
  await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  await fireEvent.press(screen.getByRole('button', { name: 'Змінити фото' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(oldAvatar.url);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalled();
  save.mockResolvedValue(newAvatar);
  await fireEvent.press(screen.getByRole('button', { name: 'Змінити фото' }));
  await waitFor(() => expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(newAvatar.url));
});
test('оновлення отримує нове посилання, якщо фото не завантажилося', async () => {
  await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  await fireEvent(screen.getByLabelText('Збережений аватар'), 'error');
  read.mockResolvedValue(newAvatar);
  await fireEvent.press(screen.getByRole('button', { name: 'Оновити аватар' }));
  await waitFor(() => expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(newAvatar.url));
});
test('вихід з екрана скасовує активну операцію', async () => {
  const view = await render(<AvatarPicker />);
  await screen.findByLabelText('Збережений аватар');
  const signal = read.mock.calls[0][1];
  await view.unmount();
  expect(signal.aborted).toBe(true);
});


test('підтвердження збереження фото зникає через чотири секунди', async () => {
  jest.useFakeTimers();
  try {
    await render(<AvatarPicker />);
    await screen.findByLabelText('Збережений аватар');
    expect(screen.queryByText('Фото збережено')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Змінити фото' }));
    await screen.findByText('Фото збережено');
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(screen.queryByText('Фото збережено')).toBeNull();
    expect(screen.getByLabelText('Збережений аватар').props.source.uri).toBe(newAvatar.url);
  } finally { await cleanup(); jest.useRealTimers(); }
});
