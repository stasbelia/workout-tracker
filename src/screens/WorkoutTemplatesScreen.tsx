import React,{useCallback,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSession} from '../auth/SessionProvider';
import {deleteWorkoutTemplate,listWorkoutTemplates,WorkoutTemplateSummary} from '../workouts/workoutTemplates';
import {WorkoutApiError} from '../workouts/workoutApi';
import {Colors,useTheme,useThemedStyles} from '../ui/theme';
export default function WorkoutTemplatesScreen(){
 const {token,signOut}=useSession(),{colors}=useTheme(),styles=useThemedStyles(createStyles),router=useRouter();
 const [templates,setTemplates]=useState<WorkoutTemplateSummary[]>([]),[loading,setLoading]=useState(true),[removing,setRemoving]=useState(false),[selected,setSelected]=useState<WorkoutTemplateSummary|null>(null),[error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
 const active=useRef(false),busy=useRef(false),operation=useRef<AbortController|null>(null);
 useFocusEffect(useCallback(()=>{
  active.current=true;operation.current?.abort();busy.current=false;setRemoving(false);setSelected(null);const controller=new AbortController();operation.current=controller;setLoading(true);setError(null);setTemplates([]);
  void(async()=>{try{if(!token)return;const data=await listWorkoutTemplates(token,controller.signal);if(active.current&&!controller.signal.aborted)setTemplates(data);}catch(cause){if(!active.current||controller.signal.aborted)return;if(cause instanceof WorkoutApiError&&cause.status===401)await signOut().catch(()=>setError('Не вдалося завершити сесію.'));else setError('Не вдалося завантажити шаблони тренувань.');}finally{if(active.current&&!controller.signal.aborted)setLoading(false);}})();
  return()=>{active.current=false;controller.abort();operation.current?.abort();};
  // Retry changes callback identity so useFocusEffect reloads; it is not API input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[token,signOut,attempt]));
 async function remove(){
  if(!token||!selected||busy.current)return;busy.current=true;setRemoving(true);setError(null);const controller=new AbortController();operation.current=controller;
  try{await deleteWorkoutTemplate(token,selected.id,controller.signal);if(active.current&&!controller.signal.aborted){setTemplates(items=>items.filter(t=>t.id!==selected.id));setSelected(null);}}
  catch(cause){if(!active.current||controller.signal.aborted)return;if(cause instanceof WorkoutApiError&&cause.status===401)await signOut().catch(()=>setError('Не вдалося завершити сесію.'));else setError('Не вдалося підтвердити видалення. Повтори або онови список.');}
  finally{if(operation.current===controller){busy.current=false;if(active.current)setRemoving(false);}}
 }
 return <SafeAreaView style={styles.screen} edges={['left','right','bottom']}><FlatList data={templates} keyExtractor={t=>String(t.id)} contentContainerStyle={styles.content}
  ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>Твій план — під рукою</Text><Text style={styles.hint}>Обери шаблон, вкажи дату — усі вправи й підходи перенесуться в нове тренування.</Text></View>}
  renderItem={({item})=><View style={styles.card}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Створити тренування з шаблону ${item.name}`} disabled={removing} onPress={()=>router.push({pathname:'/workouts/create',params:{templateId:String(item.id)}})} style={styles.choice}>
    <Text style={styles.name}>{item.name}</Text><Text style={styles.hint}>Вправ: {item.exerciseCount} · підходів: {item.setCount}</Text>{!!item.notes&&<Text style={styles.hint} numberOfLines={2}>{item.notes}</Text>}<Text style={styles.link}>Використати шаблон →</Text>
   </TouchableOpacity>
   {selected?.id===item.id?<View style={styles.confirm}><Text style={styles.hint}>Видалити шаблон? Створені з нього тренування залишаться.</Text><View style={styles.actions}><TouchableOpacity accessibilityRole="button" disabled={removing} style={styles.small} onPress={()=>void remove()}><Text style={styles.danger}>{removing?'Видаляємо…':'Підтвердити видалення'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" disabled={removing} style={styles.small} onPress={()=>{setSelected(null);setError(null);}}><Text style={styles.link}>Скасувати</Text></TouchableOpacity></View></View>:
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Видалити шаблон тренування ${item.name}`} disabled={removing} style={styles.small} onPress={()=>setSelected(item)}><Text style={styles.hint}>Видалити шаблон</Text></TouchableOpacity>}
  </View>}
  ListEmptyComponent={!loading&&!error?<View style={styles.empty}><Text style={styles.name}>Шаблонів тренувань ще немає</Text><Text style={styles.hint}>Відкрий своє тренування з вправами й натисни «Зберегти тренування як шаблон».</Text><TouchableOpacity accessibilityRole="button" style={styles.small} onPress={()=>router.dismissTo('/')}><Text style={styles.link}>До моїх тренувань →</Text></TouchableOpacity></View>:undefined}
  ListFooterComponent={<View>{loading&&<ActivityIndicator color={colors.accentText} accessibilityLabel="Завантаження шаблонів тренувань"/>}{error&&<View style={styles.empty}><Text accessibilityRole="alert" style={styles.danger}>{error}</Text><TouchableOpacity accessibilityRole="button" disabled={removing} style={styles.small} onPress={()=>{setSelected(null);setAttempt(n=>n+1);}}><Text style={styles.link}>Повторити завантаження шаблонів тренувань</Text></TouchableOpacity></View>}</View>}/>
 </SafeAreaView>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:20,gap:14},header:{gap:12,marginBottom:12},title:{color:colors.text,fontSize:27,fontWeight:'700'},hint:{color:colors.muted,fontSize:14,lineHeight:21},card:{backgroundColor:colors.surface,padding:18,borderRadius:18,gap:8},choice:{gap:9},name:{color:colors.text,fontSize:19,fontWeight:'600'},link:{color:colors.accentText,fontSize:14,fontWeight:'600'},small:{paddingVertical:13,minHeight:44},empty:{paddingVertical:24,gap:12},confirm:{borderTopWidth:1,borderColor:colors.border,paddingTop:12,gap:8},actions:{flexDirection:'row',gap:16,flexWrap:'wrap'},danger:{color:colors.error,fontSize:14,lineHeight:21}});
