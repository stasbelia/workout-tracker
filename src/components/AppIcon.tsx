import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../ui/theme';
export default function AppIcon({ name, color: overrideColor }: { name: 'home' | 'profile' | 'plus' | 'dumbbell' | 'calculator'; color?: string }) {
  const { colors } = useTheme();
  const color = overrideColor ?? colors.accentText;
  return <View accessible={false} style={styles.box}>
    {name === 'plus' ? <><View style={[styles.horizontal,{backgroundColor:color}]} /><View style={[styles.vertical,{backgroundColor:color}]} /></> :
      name === 'dumbbell' ? <><View style={[styles.horizontal,{backgroundColor:color}]} />{[3,8,18,23].map((left,index)=><View key={left} style={[styles.plate,{left,height:index===1||index===2?20:12,top:index===1||index===2?4:8,borderColor:color}]} />)}</> :
      name === 'calculator' ? <><View style={[styles.calculator,{borderColor:color}]} /><View style={[styles.display,{borderColor:color}]} />{[0,1,2,3,4,5].map(i=><View key={i} style={[styles.key,{left:7+(i%3)*6,top:14+Math.floor(i/3)*6,backgroundColor:color}]} />)}</> :
      name === 'profile' ? <><View style={[styles.head,{borderColor:color}]} /><View style={[styles.body,{borderColor:color}]} /></> :
        <><View style={[styles.roof,{borderColor:color}]} /><View style={[styles.house,{borderColor:color}]} /><View style={[styles.door,{borderColor:color}]} /></>}
  </View>;
}
const styles=StyleSheet.create({
  calculator:{position:'absolute',left:3,top:1,width:22,height:26,borderWidth:1.7,borderRadius:4},display:{position:'absolute',left:7,top:5,width:14,height:5,borderWidth:1.5,borderRadius:1},key:{position:'absolute',width:3,height:3,borderRadius:1},
  box:{width:28,height:28},horizontal:{height:2,width:22,left:3,top:13,position:'absolute',borderRadius:1},vertical:{height:22,width:2,left:13,top:3,position:'absolute',borderRadius:1},
  plate:{position:'absolute',borderWidth:1.7,width:4,borderRadius:2},head:{position:'absolute',width:9,height:9,borderWidth:1.7,borderRadius:5,left:9.5,top:3},
  body:{position:'absolute',width:20,height:12,left:4,top:16,borderWidth:1.7,borderTopLeftRadius:10,borderTopRightRadius:10,borderBottomWidth:0},
  roof:{position:'absolute',width:15,height:15,left:6.5,top:4,borderTopWidth:1.7,borderLeftWidth:1.7,transform:[{rotate:'45deg'}]},
  house:{position:'absolute',width:18,height:14,left:5,top:12,borderWidth:1.7,borderTopWidth:0,borderRadius:2},door:{position:'absolute',width:6,height:9,left:11,top:17,borderWidth:1.7,borderBottomWidth:0},
});
