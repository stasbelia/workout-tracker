import { deleteWorkout, deleteExercise, updateWorkout, updateExercise, parseWorkout } from '../src/workouts/workoutApi';
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
const original=global.fetch,mockFetch=jest.fn();
const workout={id:7,title:'Ноги',date:'2026-10-23',notes:'',createdAt:'2026-10-23T10:00:00Z',completedAt:null,revision:4};
const exercise={id:9,name:'Присідання',notes:'',position:1,createdAt:workout.createdAt,revision:2,sets:[{position:1,reps:10,weightKg:40}]};
beforeEach(()=>{mockFetch.mockReset();global.fetch=mockFetch;});afterAll(()=>{global.fetch=original;});
const signal=()=>new AbortController().signal;
test('PATCH передає версію і повертає лише правильний запис',async()=>{
 mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({workout})});const draft={title:'Ноги',date:workout.date,notes:'',expectedRevision:3,today:'2026-10-24'};
 expect(await updateWorkout('token',7,draft,signal())).toEqual(workout);expect(mockFetch.mock.calls[0][1]).toMatchObject({method:'PATCH',body:JSON.stringify(draft)});
 mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({exercise})});const e={name:exercise.name,notes:'',sets:[{reps:10,weightKg:40}],expectedRevision:1};
 expect(await updateExercise('token',7,9,e,signal())).toEqual(exercise);expect(mockFetch.mock.calls[1][0]).toBe('https://api.example.test/api/workouts/7/exercises/9');
 mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({exercise:{...exercise,id:8}})});await expect(updateExercise('token',7,9,e,signal())).rejects.toThrow();
});
test('DELETE із версією приймає порожню 204 і не читає JSON',async()=>{
 const json=jest.fn();mockFetch.mockResolvedValue({ok:true,status:204,json});await deleteWorkout('token',workout,signal());await deleteExercise('token',7,exercise,signal());expect(json).not.toHaveBeenCalled();
 expect(mockFetch.mock.calls[0][1]).toMatchObject({method:'DELETE',body:JSON.stringify({expectedRevision:4})});expect(mockFetch.mock.calls[1][1]).toMatchObject({method:'DELETE',body:JSON.stringify({expectedRevision:2})});
});
test('409 зберігається для екрана конфлікту; неправильна версія не йде в мережу',async()=>{
 mockFetch.mockResolvedValue({ok:false,status:409,json:async()=>({error:'Перечитайте запис.'})});await expect(deleteWorkout('token',workout,signal())).rejects.toMatchObject({status:409});mockFetch.mockClear();
 await expect(deleteWorkout('token',{id:7,revision:-1},signal())).rejects.toThrow();expect(mockFetch).not.toHaveBeenCalled();
 for(const revision of [undefined,-1,1.5,'4'])expect(()=>parseWorkout({...workout,revision})).toThrow();
});
