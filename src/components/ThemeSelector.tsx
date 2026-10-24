import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, ThemeMode, useTheme, useThemedStyles } from '../ui/theme';
export default function ThemeSelector() {
  const {mode,setMode}=useTheme(),styles=useThemedStyles(createStyles);
  const [saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null);const busy=useRef(false);
  async function choose(next:ThemeMode){if(busy.current||mode===next)return;busy.current=true;setSaving(true);setError(null);try{await setMode(next);}catch{setError('Не вдалося зберегти тему. Спробуй ще раз.');}finally{busy.current=false;setSaving(false);}}
  return <View style={styles.card}><Text style={styles.heading}>Вигляд</Text><View style={styles.row}>
    {(['light','dark'] as const).map(value=><TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{checked:mode===value,disabled:saving}} disabled={saving} style={[styles.option,mode===value&&styles.selected]} onPress={()=>void choose(value)}><Text style={[styles.label,mode===value&&styles.selectedLabel]}>{value==='light'?'Світла тема':'Темна тема'}</Text></TouchableOpacity>)}
  </View>{error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({card:{backgroundColor:colors.surface,padding:18,borderRadius:20,gap:14},heading:{color:colors.text,fontSize:18,fontWeight:'600'},row:{flexDirection:'row',gap:10},option:{flex:1,paddingVertical:15,paddingHorizontal:8,borderRadius:12,backgroundColor:colors.raised,alignItems:'center',borderWidth:1,borderColor:colors.border},selected:{backgroundColor:colors.accent,borderColor:colors.accent},label:{color:colors.text,fontSize:15,fontWeight:'600'},selectedLabel:{color:colors.ink},error:{color:colors.error,fontSize:14,lineHeight:21}});
