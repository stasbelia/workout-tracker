import {createFromWorkoutTemplate,deleteWorkoutTemplate,getWorkoutTemplate,listWorkoutTemplates,saveWorkoutTemplate} from '../src/workouts/workoutTemplates';
import {WorkoutApiError} from '../src/workouts/workoutApi';
jest.mock('../src/config',()=>({API_BASE_URL:'https://api.example.test/api'}),{virtual:true});
const original=global.fetch,fetchMock=jest.fn();
const summary={id:3,name:'Верх',notes:'План',exerciseCount:1,setCount:2,createdAt:'2026-01-01T00:00:00Z'};
const template={...summary,exercises:[{name:'Жим',notes:'',sets:[{reps:10,weightKg:42.5},{reps:8,weightKg:null}]}]};
const response=(data:unknown,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
beforeEach(()=>{fetchMock.mockReset();global.fetch=fetchMock;});afterAll(()=>{global.fetch=original;});
test('список і деталі шаблону перевіряють склад тренування',async()=>{
 fetchMock.mockResolvedValueOnce(response({templates:[summary]})).mockResolvedValueOnce(response({template}));
 expect(await listWorkoutTemplates('token',new AbortController().signal)).toEqual([summary]);expect(await getWorkoutTemplate('token',3,new AbortController().signal)).toEqual(template);
});
test('створення шаблону надсилає лише своє джерело і назву, створення тренування — нову дату та UUID',async()=>{
 fetchMock.mockResolvedValueOnce(response({template:summary},201));await saveWorkoutTemplate('token',7,'Верх','test-uuid',new AbortController().signal);
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({sourceWorkoutId:7,name:'Верх',clientRequestId:'test-uuid'});
 const workout={id:8,title:'Верх',notes:'',date:'2026-10-24',revision:0,completedAt:null,createdAt:summary.createdAt},draft={title:workout.title,notes:'',date:workout.date,clientRequestId:'test-uuid'};
 fetchMock.mockResolvedValueOnce(response({workout},201));expect(await createFromWorkoutTemplate('token',3,draft,new AbortController().signal)).toEqual(workout);
 expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.test/api/workout-templates/3/workouts');expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(draft);
});
test('неправильні кількості, чужий ID у відповіді та некоректні підходи відхиляються',async()=>{
 for(const change of [{exerciseCount:0},{exerciseCount:101},{setCount:0},{setCount:31}]){fetchMock.mockResolvedValue(response({templates:[{...summary,...change}]}));await expect(listWorkoutTemplates('token',new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);}
 for(const change of [{id:4},{exercises:[]},{exercises:[{name:'Жим',notes:'',sets:[{reps:1,weightKg:1.234}]}]}]){fetchMock.mockResolvedValue(response({template:{...template,...change}}));await expect(getWorkoutTemplate('token',3,new AbortController().signal)).rejects.toBeInstanceOf(WorkoutApiError);}
});
test('помилкові ID відхиляються без мережі, видалення приймає 204',async()=>{
 for(const id of [0,-1,1.5,2147483648])await expect(getWorkoutTemplate('token',id,new AbortController().signal)).rejects.toMatchObject({status:400});expect(fetchMock).not.toHaveBeenCalled();
 fetchMock.mockResolvedValue(response(undefined,204));await deleteWorkoutTemplate('token',3,new AbortController().signal);expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
});
