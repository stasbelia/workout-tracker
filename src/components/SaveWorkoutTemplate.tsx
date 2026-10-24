import React,{useCallback,useRef,useState} from 'react';
import {StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {randomUUID} from 'expo-crypto';
import {useSession} from '../auth/SessionProvider';
import {saveWorkoutTemplate} from '../workouts/workoutTemplates';
import {WorkoutApiError} from '../workouts/workoutApi';
import {Colors,useTheme,useThemedStyles} from '../ui/theme';
export default function SaveWorkoutTemplate({workoutId,title}:{workoutId:number;title:string}){
 const {token,signOut}=useSession(),{colors}=useTheme(),styles=useThemedStyles(createStyles),router=useRouter();
 const [expanded,setExpanded]=useState(false),[name,setName]=useState(title),[saving,setSaving]=useState(false),[message,setMessage]=useState<string|null>(null),[saved,setSaved]=useState(false);
 const busy=useRef(false),active=useRef(false),operation=useRef<AbortController|null>(null);
 useFocusEffect(useCallback(()=>{active.current=true;operation.current?.abort();operation.current=null;busy.current=false;setSaving(false);return()=>{active.current=false;operation.current?.abort();};},[]));
 async function save(){
  if(!token||busy.current)return;
  if(!name.trim()||name.trim().length>100||/\p{Cc}/u.test(name)){setMessage('Введи назву шаблону: 1–100 символів.');return;}
  busy.current=true;setSaving(true);setMessage(null);const controller=new AbortController();operation.current=controller;
  try{
   const template=await saveWorkoutTemplate(token,workoutId,name.trim(),randomUUID(),controller.signal);
   if(active.current&&!controller.signal.aborted){setSaved(true);setExpanded(false);setMessage(`Шаблон «${template.name}» збережено. Вправ: ${template.exerciseCount}, підходів: ${template.setCount}.`);}
  }catch(cause){
   if(!active.current||controller.signal.aborted)return;
   if(cause instanceof WorkoutApiError&&cause.status===401)await signOut().catch(()=>setMessage('Не вдалося завершити сесію.'));
   else setMessage(cause instanceof WorkoutApiError&&[400,404,409,413,429].includes(cause.status??0)?cause.message:'Не вдалося підтвердити збереження. Перевір «Мої шаблони тренувань» або повтори з тими самими даними.');
  }finally{if(operation.current===controller){busy.current=false;if(active.current)setSaving(false);}}
 }
 return <View style={styles.container}>
  {!expanded?<TouchableOpacity accessibilityRole="button" style={styles.open} onPress={()=>{setName(title);setMessage(null);setSaved(false);setExpanded(true);}}><Text style={styles.link}>Зберегти тренування як шаблон</Text></TouchableOpacity>:<View style={styles.form}>
   <Text style={styles.label}>Назва шаблону тренування</Text><TextInput accessibilityLabel="Назва шаблону тренування" value={name} onChangeText={setName} editable={!saving} maxLength={100} style={styles.input} placeholderTextColor={colors.muted}/>
   <Text style={styles.hint}>Збережемо всі вправи, підходи та нотатки. Дату обиратимеш під час використання.</Text>
   <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={()=>void save()} style={styles.save}><Text style={styles.saveText}>{saving?'Зберігаємо шаблон тренування…':'Зберегти шаблон тренування'}</Text></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={()=>setExpanded(false)} style={styles.open}><Text style={styles.hint}>Скасувати</Text></TouchableOpacity>
  </View>}
  {message&&<Text accessibilityLiveRegion="polite" style={styles.hint}>{message}</Text>}
  {saved&&<TouchableOpacity accessibilityRole="button" style={styles.open} onPress={()=>router.push('/workout-templates')}><Text style={styles.link}>Відкрити мої шаблони тренувань →</Text></TouchableOpacity>}
 </View>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({container:{gap:8},open:{paddingVertical:13,minHeight:44},link:{color:colors.accentText,fontWeight:'600',fontSize:15},form:{padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,gap:12},label:{color:colors.text,fontSize:15,fontWeight:'600'},input:{color:colors.text,fontSize:17,padding:14,backgroundColor:colors.surface,borderRadius:12,borderWidth:1,borderColor:colors.border},hint:{color:colors.muted,fontSize:13,lineHeight:20},save:{padding:15,borderRadius:12,backgroundColor:colors.accent,alignItems:'center'},saveText:{color:colors.ink,fontSize:15,fontWeight:'600'}});
