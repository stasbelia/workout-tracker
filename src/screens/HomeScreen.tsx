import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WorkoutList from '../components/WorkoutList';
import BottomNavigation from '../components/BottomNavigation';
import AppIcon from '../components/AppIcon';
import AvatarThumbnail from '../components/AvatarThumbnail';
import HomeGreeting from '../components/HomeGreeting';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const date = new Date().toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long'});
  return <SafeAreaView style={styles.screen} edges={['top','left','right','bottom']}>
    <WorkoutList header={<View style={styles.header}>
      <View style={styles.greeting}>
        <View style={styles.greetingText}><Text style={styles.date}>{date}</Text><HomeGreeting/></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Відкрити профіль" style={styles.profile} onPress={()=>router.push('/profile')}><AvatarThumbnail/></TouchableOpacity>
      </View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ТВОЄ НАСТУПНЕ ТРЕНУВАННЯ</Text>
        <View style={styles.heroTitle}><Text style={styles.heroHeading}>Час для себе.</Text><AppIcon name="dumbbell" color={colors.ink}/></View>
        <Text style={styles.heroHint}>Твої вправи, підходи та особистий прогрес.</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="+ Створити тренування" style={styles.create} onPress={()=>router.push('/workouts/new')}>
          <Text style={styles.createText}>＋ Створити тренування</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.templates} onPress={()=>router.push('/workout-templates')}>
        <View style={{flex:1,gap:5}}><Text style={styles.templateTitle}>Мої шаблони тренувань</Text><Text style={styles.templateHint}>Усі вправи й підходи — одним вибором</Text></View><Text style={styles.templateArrow}>›</Text>
      </TouchableOpacity>
      <Text accessibilityRole="header" style={styles.section}>Мої тренування</Text>
    </View>} />
    <BottomNavigation active="home"/>
  </SafeAreaView>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  templates:{backgroundColor:colors.surface,padding:18,borderRadius:18,flexDirection:'row',gap:12,alignItems:'center'},templateTitle:{color:colors.text,fontSize:17,fontWeight:'600'},templateHint:{color:colors.muted,fontSize:13,lineHeight:19},templateArrow:{color:colors.accentText,fontSize:26},
  screen:{flex:1,backgroundColor:colors.background},header:{gap:24,marginBottom:4},greeting:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},greetingText:{flex:1,gap:5},
  date:{color:colors.muted,fontSize:13,textTransform:'capitalize'},title:{color:colors.text,fontSize:27,fontWeight:'700',letterSpacing:-0.7},accent:{color:colors.accentText},profile:{width:48,height:48,borderRadius:24,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
  hero:{backgroundColor:colors.accent,padding:18,borderRadius:22,gap:12},eyebrow:{color:colors.ink,fontSize:11,fontWeight:'600',letterSpacing:1},heroTitle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},heroHeading:{color:colors.ink,fontSize:29,fontWeight:'700',letterSpacing:-0.7,flex:1},heroHint:{color:'#43522D',fontSize:14,lineHeight:21},
  create:{backgroundColor:colors.ink,borderRadius:13,padding:16,alignItems:'center'},createText:{color:colors.onDark,fontSize:16,fontWeight:'600'},section:{color:colors.text,fontSize:21,fontWeight:'600',letterSpacing:-0.4},
});
