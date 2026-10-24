import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import AppIcon from './AppIcon';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
export default function BottomNavigation({ active }: { active: 'home' | 'profile' | 'calculator' }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router=useRouter();
  return <View style={styles.bar}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Головна" accessibilityState={{selected:active==='home'}} style={styles.item} onPress={()=>router.dismissTo('/')}>
      <AppIcon name="home" color={active==='home'?colors.accentText:colors.muted}/><Text style={[styles.text,active==='home'&&styles.active]}>Головна</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Калькулятор 1RM" accessibilityState={{selected:active==='calculator'}} style={styles.item} onPress={()=>{if(active!=='calculator')router.push('/one-rep-max');}}><AppIcon name="calculator" color={active==='calculator'?colors.accentText:colors.muted}/><Text style={[styles.text,active==='calculator'&&styles.active]}>1RM</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Профіль" accessibilityState={{selected:active==='profile'}} style={styles.item} onPress={()=>{if(active!=='profile')router.push('/profile');}}>
      <AppIcon name="profile" color={active==='profile'?colors.accentText:colors.muted}/><Text style={[styles.text,active==='profile'&&styles.active]}>Профіль</Text>
    </TouchableOpacity>
  </View>;
}
const createStyles = (colors: Colors) => StyleSheet.create({bar:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:10,paddingBottom:4,flexDirection:'row',alignItems:'center',justifyContent:'space-around',backgroundColor:colors.background},item:{minWidth:88,minHeight:52,alignItems:'center',gap:4},text:{color:colors.muted,fontSize:11},active:{color:colors.accentText}});
