import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { calculateOneRepMax, formatKg, OneRepMax } from '../calculators/oneRepMax';
import { Colors, useThemedStyles, useTheme } from '../ui/theme';

export default function OneRepMaxScreen() {
  const styles = useThemedStyles(createStyles), { colors } = useTheme();
  const [weight,setWeight] = useState(''), [reps,setReps] = useState('');
  const [result,setResult] = useState<OneRepMax|null>(null), [error,setError] = useState<string|null>(null);
  function change(field:'weight'|'reps',value:string) {
    if (field==='weight') setWeight(value); else setReps(value);
    setResult(null);setError(null);
  }
  function calculate() {
    const next = calculateOneRepMax(weight,reps);
    if(typeof next==='string'){setResult(null);setError(next);return;}
    Keyboard.dismiss();setError(null);setResult(next);
  }
  return <SafeAreaView style={styles.screen} edges={['left','right','bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={96}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.overline}>СИЛА В ЦИФРАХ</Text>
        <Text accessibilityRole="header" style={styles.title}>Калькулятор 1RM</Text>
        <Text style={styles.hint}>1RM — вага на одне повторення. Введи вагу й кількість повторень одного виконаного підходу, щоб отримати оцінку за формулою Еплі.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Вага, кг</Text>
          <TextInput accessibilityLabel="Вага для розрахунку 1RM" value={weight} onChangeText={value=>change('weight',value)} keyboardType="decimal-pad" maxLength={7} placeholder="Наприклад, 60" placeholderTextColor={colors.muted} style={styles.input}/>
          <Text style={styles.label}>Повторення</Text>
          <TextInput accessibilityLabel="Кількість повторень для 1RM" value={reps} onChangeText={value=>change('reps',value)} keyboardType="number-pad" maxLength={4} placeholder="Наприклад, 6" placeholderTextColor={colors.muted} style={styles.input}/>
          <Text style={styles.hint}>Для оцінки радимо дані вже виконаного підходу на 2–10 повторень. Більше теж можна ввести, але похибка може бути більшою.</Text>
          <Text style={styles.hint}>Вкажи загальну вагу снаряда з грифом. Для гантелей використовуй однаковий спосіб обліку ваги в усіх порівняннях.</Text>
          {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" style={styles.calculate} onPress={calculate}><Text style={styles.calculateText}>Розрахувати 1RM</Text></TouchableOpacity>
        </View>
        {result&&<View accessibilityLiveRegion="polite" style={styles.results}>
          {result.reps>10&&<View style={styles.card}><Text accessibilityRole="alert" style={styles.hint}>Понад 10 повторень: результат поза рекомендованим діапазоном і може мати більшу похибку. Відсотки нижче також розраховані з цієї приблизної оцінки.</Text></View>}
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{result.reps===1?'Вага одного повторення':'Орієнтовний 1RM'}</Text>
            <Text accessibilityLabel={`Результат 1RM: ${formatKg(result.estimatedKg)} кг`} style={styles.resultValue}>{result.reps>1?'≈ ':''}{formatKg(result.estimatedKg)} <Text style={styles.unit}>кг</Text></Text>
            <Text style={styles.resultHint}>{formatKg(result.weightKg)} кг × {result.reps} повтор.</Text>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.section}>Відсотки від {result.reps===1?'введеного':'оціненого'} 1RM</Text>
            <Text style={styles.hint}>Математичний перерахунок, не готова програма тренувань. Значення округлено до 0,1 кг, без підбору дисків.</Text>
            {result.percentages.map(row=><View key={row.percent} style={styles.row}><Text style={styles.percent}>{row.percent}%</Text><Text style={styles.kg}>{formatKg(row.weightKg)} кг</Text></View>)}
          </View>
        </View>}
        <View style={styles.card}>
          <Text style={styles.section}>Як рахуємо</Text>
          <Text style={styles.hint}>Для 2 і більше повторень: вага × (1 + повторення / 30). Для одного повторення беремо введену вагу без надбавки.</Text>
          <Text style={styles.hint}>Це приблизна оцінка, а не виміряний максимум і не гарантія безпечної ваги. Легкий підхід із запасом не показує твій максимум. Не потрібно йти до відмови заради калькулятора.</Text>
          <Text style={styles.hint}>Розрахунок працює на телефоні й не записує результат у твої тренування.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <BottomNavigation active="calculator"/>
  </SafeAreaView>;
}
const createStyles=(colors:Colors)=>StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},content:{padding:22,paddingBottom:32,gap:18},overline:{color:colors.accentText,fontSize:11,fontWeight:'600',letterSpacing:1.5},title:{color:colors.text,fontSize:28,fontWeight:'700'},hint:{color:colors.muted,fontSize:14,lineHeight:21},
  card:{backgroundColor:colors.surface,borderRadius:20,padding:18,gap:12},label:{color:colors.text,fontSize:16,fontWeight:'600'},input:{color:colors.text,backgroundColor:colors.raised,borderWidth:1,borderColor:colors.border,padding:15,borderRadius:12,fontSize:20},calculate:{padding:17,backgroundColor:colors.accent,borderRadius:12,alignItems:'center'},calculateText:{color:colors.ink,fontSize:16,fontWeight:'700'},error:{color:colors.error,fontSize:14,lineHeight:21},
  results:{gap:18},resultCard:{backgroundColor:colors.accent,borderRadius:20,padding:22,gap:8},resultLabel:{color:colors.ink,fontSize:15,fontWeight:'600'},resultValue:{color:colors.ink,fontSize:43,fontWeight:'700'},unit:{fontSize:23},resultHint:{color:colors.ink,fontSize:14},section:{color:colors.text,fontSize:18,fontWeight:'600'},row:{flexDirection:'row',justifyContent:'space-between',gap:16,paddingVertical:10,borderTopWidth:1,borderColor:colors.border},percent:{color:colors.muted,fontSize:16},kg:{color:colors.text,fontSize:17,fontWeight:'600'},
});
