import { ExerciseSetDraft, parseWorkout, request, Workout, WorkoutApiError, WorkoutDraft } from './workoutApi';
export type WorkoutTemplateSummary = { id:number; name:string; notes:string; createdAt:string; exerciseCount:number; setCount:number };
export type TemplateExercise = { name:string; notes:string; sets:ExerciseSetDraft[] };
export type WorkoutTemplate = WorkoutTemplateSummary & { exercises:TemplateExercise[] };
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>0&&v<=2147483647;
function summary(v:unknown):WorkoutTemplateSummary{
 if(!object(v)||!id(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||typeof v.notes!=='string'||v.notes.length>500||
  typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||!id(v.exerciseCount)||v.exerciseCount>100||!id(v.setCount)||v.setCount<v.exerciseCount||v.setCount>v.exerciseCount*30)throw new WorkoutApiError('Некоректний шаблон тренування.');
 return {id:v.id,name:v.name,notes:v.notes,createdAt:v.createdAt,exerciseCount:v.exerciseCount,setCount:v.setCount};
}
function exercise(value:unknown):TemplateExercise{
 if(!object(value)||typeof value.name!=='string'||!value.name.trim()||value.name.length>100||typeof value.notes!=='string'||value.notes.length>500||!Array.isArray(value.sets)||value.sets.length<1||value.sets.length>30)throw new WorkoutApiError('Некоректна вправа шаблону.');
 const sets=value.sets.map((set:unknown)=>{
  if(!object(set)||!id(set.reps)||set.reps>1000||(set.weightKg!==null&&(typeof set.weightKg!=='number'||!Number.isFinite(set.weightKg)||set.weightKg<0||set.weightKg>1000||Math.abs(set.weightKg*100-Math.round(set.weightKg*100))>1e-8)))throw new WorkoutApiError('Некоректні підходи шаблону.');
  return {reps:set.reps,weightKg:set.weightKg as number|null};
 });
 return {name:value.name,notes:value.notes,sets};
}
export async function listWorkoutTemplates(token:string,signal:AbortSignal):Promise<WorkoutTemplateSummary[]>{
 const data=await request(token,signal,{resource:'/workout-templates'});
 if(!Array.isArray(data.templates)||data.templates.length>50)throw new WorkoutApiError('Некоректний список шаблонів тренувань.');
 const result=data.templates.map(summary);if(new Set(result.map(t=>t.id)).size!==result.length)throw new WorkoutApiError('Некоректний список шаблонів тренувань.');return result;
}
export async function getWorkoutTemplate(token:string,templateId:number,signal:AbortSignal):Promise<WorkoutTemplate>{
 if(!id(templateId))throw new WorkoutApiError('Некоректний номер шаблону.',400);
 const data=await request(token,signal,{resource:'/workout-templates',path:`/${templateId}`});const value=data.template;
 if(!object(value)||value.id!==templateId||!Array.isArray(value.exercises)||value.exercises.length<1||value.exercises.length>100)throw new WorkoutApiError('Некоректний шаблон тренування.');
 const exercises=value.exercises.map(exercise);
 return {...summary({...value,exerciseCount:exercises.length,setCount:exercises.reduce((n,e)=>n+e.sets.length,0)}),exercises};
}
export async function saveWorkoutTemplate(token:string,sourceWorkoutId:number,name:string,clientRequestId:string,signal:AbortSignal):Promise<WorkoutTemplateSummary>{
 if(!id(sourceWorkoutId))throw new WorkoutApiError('Некоректний номер тренування.',400);
 return summary((await request(token,signal,{resource:'/workout-templates',body:{sourceWorkoutId,name,clientRequestId}})).template);
}
export async function createFromWorkoutTemplate(token:string,templateId:number,draft:WorkoutDraft,signal:AbortSignal):Promise<Workout>{
 if(!id(templateId))throw new WorkoutApiError('Некоректний номер шаблону.',400);
 return parseWorkout((await request(token,signal,{resource:'/workout-templates',path:`/${templateId}/workouts`,body:draft})).workout);
}
export async function deleteWorkoutTemplate(token:string,templateId:number,signal:AbortSignal):Promise<void>{
 if(!id(templateId))throw new WorkoutApiError('Некоректний номер шаблону.',400);
 await request(token,signal,{resource:'/workout-templates',path:`/${templateId}`,method:'DELETE'});
}
