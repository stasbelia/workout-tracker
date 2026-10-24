import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/SessionProvider';
import { WorkoutApiError } from '../workouts/workoutApi';
import { listWorkoutTemplates, WorkoutTemplateSummary } from '../workouts/workoutTemplates';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import NewWorkoutScreen from './NewWorkoutScreen';

export default function WorkoutStartScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string | string[] }>();
  // Existing links to /workouts/new?templateId=... still open the template form.
  return templateId !== undefined ? <NewWorkoutScreen/> : <WorkoutChoices/>;
}

function WorkoutChoices() {
  const { token, signOut } = useSession(), router = useRouter();
  const { colors } = useTheme(), styles = useThemedStyles(createStyles);
  const [templates,setTemplates] = useState<WorkoutTemplateSummary[]>([]);
  const [loading,setLoading] = useState(true), [error,setError] = useState<string|null>(null);
  const [attempt,setAttempt] = useState(0), [opening,setOpening] = useState(false);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    navigating.current = false; setOpening(false); setLoading(true); setError(null); setTemplates([]);
    void (async () => {
      try {
        if (!token) return;
        const saved = await listWorkoutTemplates(token,controller.signal);
        if (!controller.signal.aborted) setTemplates(saved);
      } catch(cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof WorkoutApiError && cause.status===401) await signOut().catch(()=>setError('Сесія завершилася. Увійди повторно.'));
        else setError('Не вдалося завантажити твої шаблони. Можна повторити або почати порожнє тренування.');
      } finally { if(!controller.signal.aborted)setLoading(false); }
    })();
    return () => controller.abort();
  },[token,signOut,attempt]));
  function choose(template?: WorkoutTemplateSummary) {
    if (navigating.current) return;
    navigating.current = true; setOpening(true);
    if (template) router.push({pathname:'/workouts/create',params:{templateId:String(template.id)}});
    else router.push('/workouts/create');
  }
  return <SafeAreaView style={styles.screen} edges={['left','right','bottom']}>
    <FlatList data={templates} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Із чого почнемо?</Text>
        <Text style={styles.hint}>Склади тренування з нуля або візьми свій збережений план з усіма вправами й підходами.</Text>
        <TouchableOpacity accessibilityRole="button" disabled={opening} style={[styles.blank,opening&&styles.disabled]} onPress={()=>choose()}>
          <Text style={styles.blankTitle}>Порожнє тренування</Text><Text style={styles.blankHint}>Назва, дата — і додаєш свої вправи</Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.section}>Мої шаблони тренувань</Text>
        <Text style={styles.hint}>Вибір шаблону підготує нове тренування. Оригінал залишиться без змін.</Text>
      </View>}
      renderItem={({item})=><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Обрати шаблон ${item.name}`} disabled={opening} style={[styles.card,opening&&styles.disabled]} onPress={()=>choose(item)}>
        <View style={styles.cardText}><Text style={styles.name}>{item.name}</Text><Text style={styles.hint}>Вправ: {item.exerciseCount} · підходів: {item.setCount}</Text>{!!item.notes&&<Text style={styles.hint} numberOfLines={2}>{item.notes}</Text>}</View><Text style={styles.arrow}>›</Text>
      </TouchableOpacity>}
      ListEmptyComponent={!loading&&!error?<View style={styles.state}><Text style={styles.name}>Шаблонів ще немає</Text><Text style={styles.hint}>Почни порожнє тренування. Коли додаси вправи, його можна буде зберегти як шаблон.</Text></View>:undefined}
      ListFooterComponent={<View style={styles.state}>
        {loading&&<ActivityIndicator accessibilityLabel="Завантаження основ тренування" color={colors.accentText}/>}
        {error&&<><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" disabled={opening} style={styles.retry} onPress={()=>setAttempt(n=>n+1)}><Text style={styles.link}>Повторити завантаження шаблонів</Text></TouchableOpacity></>}
      </View>}/>
  </SafeAreaView>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},content:{padding:22,gap:12},header:{gap:12,marginBottom:4},title:{color:colors.text,fontSize:28,fontWeight:'700'},section:{color:colors.text,fontSize:20,fontWeight:'600',marginTop:16},
  hint:{color:colors.muted,fontSize:14,lineHeight:21},blank:{backgroundColor:colors.accent,borderRadius:18,padding:20,gap:8,marginTop:8},blankTitle:{color:colors.ink,fontSize:19,fontWeight:'700'},blankHint:{color:colors.ink,fontSize:14,lineHeight:20},
  card:{backgroundColor:colors.surface,borderRadius:18,padding:18,flexDirection:'row',alignItems:'center',gap:12},cardText:{flex:1,gap:6},name:{color:colors.text,fontSize:18,fontWeight:'600'},arrow:{color:colors.accentText,fontSize:28},state:{gap:12,paddingVertical:16},error:{color:colors.error,fontSize:14,lineHeight:21},retry:{paddingVertical:14,minHeight:48},link:{color:colors.accentText,fontSize:15,fontWeight:'600'},disabled:{opacity:0.6},
});
