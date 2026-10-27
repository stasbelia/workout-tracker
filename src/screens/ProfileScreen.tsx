import React, { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../auth/SessionProvider';
import AvatarPicker from '../components/AvatarPicker';
import BottomNavigation from '../components/BottomNavigation';
import ProfileDetails from '../components/ProfileDetails';
import ThemeSelector from '../components/ThemeSelector';
import { Colors, useThemedStyles } from '../ui/theme';
export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const {signOut}=useSession();
  const [leaving,setLeaving]=useState(false),busy=useRef(false);
  async function logout() {
    if(busy.current)return;
    busy.current=true;setLeaving(true);
    try {await signOut();} catch {Alert.alert('Помилка виходу','Не вдалося видалити сесію з пристрою. Спробуйте ще раз.');}
    finally {busy.current=false;setLeaving(false);}
  }
  return <SafeAreaView style={styles.screen} edges={['left','right','bottom']}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?96:0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.overline}>ТВІЙ АКАУНТ</Text>
      <Text style={styles.title}>Твій профіль</Text>
      <View style={styles.card}><AvatarPicker/></View>
      <ProfileDetails/>
      <ThemeSelector/>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{disabled:leaving,busy:leaving}} disabled={leaving} onPress={()=>void logout()} style={[styles.logout,leaving&&styles.disabled]}>
        <Text style={styles.logoutText}>{leaving?'Виходимо…':'Вийти з акаунта'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
    <BottomNavigation active="profile"/>
  </SafeAreaView>;
}
const createStyles = (colors: Colors) => StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:22,gap:18},overline:{color:colors.accentText,fontSize:11,letterSpacing:1.4,fontWeight:'600'},title:{color:colors.text,fontSize:30,fontWeight:'700'},card:{backgroundColor:colors.surface,borderRadius:22,padding:24},hint:{color:colors.muted,fontSize:15,lineHeight:23},logout:{alignSelf:'flex-start',borderWidth:1,borderColor:colors.border,borderRadius:12,paddingHorizontal:18,paddingVertical:14,marginTop:12},logoutText:{color:colors.error,fontSize:15,fontWeight:'600'},disabled:{opacity:0.6}});
