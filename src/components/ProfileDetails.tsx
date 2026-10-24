import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../auth/SessionProvider';
import { getProfile, Profile, saveNickname } from '../profile/profileApi';
import { WorkoutApiError } from '../workouts/workoutApi';
import { todayWorkoutDate } from '../workouts/workoutDate';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
import ActivityCalendar from './ActivityCalendar';
export default function ProfileDetails() {
  const { token, signOut } = useSession(), { colors } = useTheme(), styles = useThemedStyles(createStyles);
  const today = todayWorkoutDate(), currentYear = Number(today.slice(0,4));
  const [year,setYear] = useState(currentYear), [profile,setProfile] = useState<Profile | null>(null);
  const [calendarHeight,setCalendarHeight] = useState(360);
  const [profileToken,setProfileToken] = useState<string | null>(null);
  const currentProfile = profileToken === token ? profile : null;
  const nicknameOwner = useRef(token);
  const [nickname,setNickname] = useState(''), [loading,setLoading] = useState(true), [saving,setSaving] = useState(false);
  const [error,setError] = useState<string | null>(null), [notice,setNotice] = useState<string | null>(null), [attempt,setAttempt] = useState(0);
  const dirtyNickname = useRef(false);
  const active = useRef(false), busy = useRef(false), operation = useRef<AbortController | null>(null), write = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true; write.current?.abort(); write.current = null; busy.current = false; setSaving(false); const controller = new AbortController(); operation.current = controller;
    setLoading(true); setError(null); setNotice(null);
    if (nicknameOwner.current !== token) { nicknameOwner.current = token; dirtyNickname.current = false; setNickname(''); }
    void (async () => {
      try {
        if (!token) return;
        const data = await getProfile(token,year,today,controller.signal);
        if (active.current && !controller.signal.aborted) { setProfile(data); setProfileToken(token); if (!dirtyNickname.current) setNickname(data.user.nickname ?? ''); }
      } catch (cause) {
        if (!active.current || controller.signal.aborted) return;
        if (cause instanceof WorkoutApiError && cause.status === 401) await signOut().catch(() => setError('Не вдалося завершити сесію. Спробуй ще раз.'));
        else setError('Не вдалося завантажити профіль і календар. Спробуй ще раз.');
      } finally { if (active.current && !controller.signal.aborted) setLoading(false); }
    })();
    return () => { active.current = false; controller.abort(); write.current?.abort(); };
  },[token,signOut,year,today,attempt]));
  async function save() {
    if (!token || !currentProfile || loading || busy.current) return;
    const value=nickname.trim();
    if (value && (Array.from(value).length<2 || value.length>32 || !/^[\p{L}\p{M}\p{N} ._-]+$/u.test(value))) { setNotice('Нікнейм: 2–32 символи — літери, цифри, пробіли, крапка, дефіс або _.'); return; }
    busy.current=true;setSaving(true);setNotice(null); const controller=new AbortController();write.current=controller;
    try {
      const user=await saveNickname(token,value,controller.signal);
      if(active.current&&!controller.signal.aborted){dirtyNickname.current=false;setProfile(previous=>previous?{...previous,user}:null);setNickname(user.nickname??'');setNotice('Нікнейм збережено.');}
    }catch(cause){
      if(!active.current||controller.signal.aborted)return;
      if(cause instanceof WorkoutApiError&&cause.status===401)await signOut().catch(()=>setNotice('Не вдалося завершити сесію.'));
      else setNotice(cause instanceof WorkoutApiError&&cause.status===400?cause.message:'Не вдалося підтвердити зміну нікнейму. Спробуй ще раз.');
    }finally{if(write.current===controller){busy.current=false;if(active.current)setSaving(false);}}
  }
  return <View style={styles.wrapper}>
    {loading && !currentProfile && <ActivityIndicator color={colors.accentText} accessibilityLabel="Завантаження профілю" />}
    {error && <View style={styles.card}><Text style={styles.error} accessibilityRole="alert">{error}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={styles.secondary}><Text style={styles.link}>Повторити завантаження профілю</Text></TouchableOpacity></View>}
    {currentProfile && <>
      <View style={styles.card}>
        <Text style={styles.heading}>Дані акаунта</Text>
        <Text style={styles.label}>Електронна пошта</Text><Text selectable style={styles.email}>{currentProfile.user.email}</Text>
        <Text style={styles.label}>Нікнейм</Text>
        <TextInput accessibilityLabel="Нікнейм" value={nickname} onChangeText={value=>{dirtyNickname.current=true;setNickname(value);}} maxLength={32} editable={!saving && !loading} autoCapitalize="none" autoCorrect={false} placeholder="Як тебе називати?" placeholderTextColor={colors.muted} style={styles.input} />
        <TouchableOpacity accessibilityRole="button" disabled={saving || loading} onPress={()=>void save()} style={styles.secondary}><Text style={styles.link}>{saving?'Зберігаємо нікнейм…':'Зберегти нікнейм'}</Text></TouchableOpacity>
        {notice && <Text style={styles.label} accessibilityLiveRegion="polite">{notice}</Text>}
      </View>
      <View style={styles.card}>
        <View style={styles.yearRow}><Text style={styles.heading}>Твоя активність</Text><View style={styles.yearButtons}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Попередній рік" disabled={year<=1900||saving||loading} style={styles.arrow} onPress={()=>setYear(n=>n-1)}><Text style={styles.link}>‹</Text></TouchableOpacity>
          <Text style={styles.year}>{year}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Наступний рік" disabled={year>=currentYear||saving||loading} style={styles.arrow} onPress={()=>setYear(n=>n+1)}><Text style={[styles.link,year>=currentYear&&styles.disabled]}>›</Text></TouchableOpacity>
        </View></View>
        <View onLayout={event=>{
          if (!loading && currentProfile.activity.year === year && event.nativeEvent.layout.height > 0) setCalendarHeight(event.nativeEvent.layout.height);
        }}>
        {loading || currentProfile.activity.year !== year ? <View style={[styles.calendarPlaceholder,{minHeight:calendarHeight}]}>
          {loading ? <ActivityIndicator color={colors.accentText} accessibilityLabel="Оновлення календаря"/> : <><Text style={styles.label}>Календар не завантажився.</Text><TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={()=>setAttempt(n=>n+1)}><Text style={styles.link}>Повторити календар</Text></TouchableOpacity></>}
        </View> : <ActivityCalendar key={currentProfile.activity.year} activity={currentProfile.activity}/>}
        </View>
      </View>
    </>}
  </View>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({calendarPlaceholder:{minHeight:280,alignItems:'center',justifyContent:'center',gap:12},wrapper:{gap:18},card:{backgroundColor:colors.surface,borderRadius:20,padding:18,gap:12},heading:{fontSize:18,fontWeight:'600',color:colors.text},label:{fontSize:13,lineHeight:20,color:colors.muted},email:{fontSize:16,color:colors.text},input:{backgroundColor:colors.raised,borderRadius:12,borderWidth:1,borderColor:colors.border,color:colors.text,fontSize:17,padding:14},secondary:{alignSelf:'flex-start',paddingVertical:12,minHeight:44},link:{color:colors.accentText,fontSize:15,fontWeight:'600'},error:{color:colors.error,fontSize:15,lineHeight:22},yearRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8},yearButtons:{flexDirection:'row',alignItems:'center'},year:{color:colors.text,fontSize:15},arrow:{padding:12,minWidth:40,alignItems:'center'},disabled:{opacity:0.3}});
