import { deleteTemplate, listTemplates, saveTemplate } from '../src/workouts/exerciseTemplates';
import { WorkoutApiError } from '../src/workouts/workoutApi';
jest.mock('../src/config', () => ({ API_BASE_URL: 'https://api.example.test/api' }), { virtual: true });
const originalFetch = global.fetch, mockFetch = jest.fn();
const template = { id: 3, name: 'Мій жим', notes: 'Пауза', sets: [{ reps: 10, weightKg: 42.5 }, { reps: 8, weightKg: null }], createdAt: '2026-10-23T10:00:00Z' };
const draft = { name: template.name, notes: template.notes, sets: template.sets, clientRequestId: '294534b9-30e2-473a-b252-74a1a15cf6bd' };
const response = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });
test('шаблони читаються й записуються через HTTPS з JWT без власника в JSON', async () => {
  mockFetch.mockResolvedValueOnce(response({ templates: [template] })).mockResolvedValueOnce(response({ template }, 201));
  expect(await listTemplates('token', new AbortController().signal)).toEqual([template]);
  expect(await saveTemplate('token', draft, new AbortController().signal)).toEqual(template);
  expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.test/api/exercise-templates');
  expect(mockFetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify(draft), headers: { Authorization: 'Bearer token' } });
});
test('помилкові підходи й повторені ID не стають шаблонами', async () => {
  for (const item of [{...template,id:0},{...template,sets:[]},{...template,sets:[{reps:0,weightKg:40}]},
    {...template,sets:[{reps:10,weightKg:1.234}]},{...template,sets:[{reps:10,weightKg:'40'}]}]) {
    mockFetch.mockResolvedValue(response({templates:[item]}));
    await expect(listTemplates('token',new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
  }
  mockFetch.mockResolvedValue(response({templates:[template,template]}));
  await expect(listTemplates('token',new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);
});
test('видалення приймає 204 без JSON і відхиляє неправильні ID до мережі', async () => {
  mockFetch.mockResolvedValue(response(undefined,204));
  await deleteTemplate('token',3,new AbortController().signal);
  expect(mockFetch.mock.calls[0]).toEqual(['https://api.example.test/api/exercise-templates/3',expect.objectContaining({method:'DELETE'})]);
  for (const id of [0,1.5,2147483648]) await expect(deleteTemplate('token',id,new AbortController().signal)).rejects.toMatchObject({status:400});
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
test('401 і 409 передають статус, читання скасовується при закритті', async () => {
  for (const status of [401,409]) {
    mockFetch.mockResolvedValue(response({error:'Не вдалося виконати запит.'},status));
    await expect(saveTemplate('token',draft,new AbortController().signal)).rejects.toMatchObject({status});
  }
  const abort = new AbortController();
  mockFetch.mockImplementation((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
  const pending=listTemplates('token',abort.signal); abort.abort();
  await expect(pending).rejects.toThrow('aborted');
});
