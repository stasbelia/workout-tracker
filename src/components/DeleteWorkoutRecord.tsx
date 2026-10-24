import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { deleteExercise, deleteWorkout, Exercise, Workout, WorkoutApiError } from '../workouts/workoutApi';
import { Colors, useThemedStyles } from '../ui/theme';

export default function DeleteWorkoutRecord({ workout, exercise, onDeleted, onReload }: {
  workout: Workout; exercise?: Exercise; onDeleted: () => void; onReload: () => void;
}) {
  const { token, signOut } = useSession(), styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null), [conflict,setConflict] = useState(false);
  const active = useRef(false), busy = useRef(false), operation = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; operation.current?.abort(); };
  }, []));
  async function remove() {
    if (!token || busy.current || !active.current) return;
    const controller = new AbortController();operation.current=controller;busy.current=true;setSaving(true);setError(null);
    try {
      if (exercise) await deleteExercise(token,workout.id,exercise,controller.signal);
      else await deleteWorkout(token,workout,controller.signal);
      if (active.current && !controller.signal.aborted) onDeleted();
    } catch(cause) {
      if (!active.current || controller.signal.aborted) return;
      if (cause instanceof WorkoutApiError && cause.status===401) await signOut().catch(()=>setError('Увійди повторно.'));
      else { setConflict(cause instanceof WorkoutApiError && cause.status===409);setError(cause instanceof WorkoutApiError?cause.message:'Не вдалося підтвердити видалення. Перевір інтернет і перечитай тренування.'); }
    } finally { busy.current=false;if(active.current)setSaving(false); }
  }
  function confirm() {
    if (busy.current) return;
    Alert.alert(exercise?'Видалити вправу?':'Видалити тренування?', exercise
      ? `«${exercise.name}» і всі її підходи буде видалено. Збережені шаблони залишаться.`
      : `«${workout.title}» з усіма вправами й підходами буде видалено зі списку та статистики. Збережені шаблони залишаться.`, [
      {text:'Залишити',style:'cancel'}, {text:'Видалити',style:'destructive',onPress:()=>void remove()},
    ]);
  }
  return <View style={styles.container}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={exercise?`Видалити вправу ${exercise.name}`:'Видалити тренування'} disabled={saving||conflict} onPress={confirm} style={styles.button}>
      <Text style={styles.label}>{saving?'Видаляємо…':exercise?'Видалити вправу':'Видалити тренування'}</Text>
    </TouchableOpacity>
    {error&&<><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.button} disabled={saving} onPress={onReload}><Text style={styles.reload}>Перечитати тренування</Text></TouchableOpacity></>}
  </View>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({container:{gap:8},button:{minHeight:44,paddingVertical:12,justifyContent:'center'},label:{color:colors.error,fontSize:14,fontWeight:'600'},error:{color:colors.error,fontSize:14,lineHeight:20},reload:{color:colors.accentText,fontSize:14}});
