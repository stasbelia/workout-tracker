import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity } from '../profile/profileApi';
import { activityWeeks } from '../profile/activityCalendar';
import { displayWorkoutDate } from '../workouts/workoutDate';
import { Colors, useTheme, useThemedStyles } from '../ui/theme';
export default function ActivityCalendar({ activity }: { activity: Activity }) {
  const { colors } = useTheme(), styles = useThemedStyles(createStyles);
  const weeks = useMemo(() => activityWeeks(activity), [activity]);
  const [selected, setSelected] = useState<{ date: string; count: number } | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positioned = useRef(false);
  const months = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  return <View style={styles.container}>
    <View style={styles.stats}>
      <View><Text style={styles.value}>{activity.totalWorkouts}</Text><Text style={styles.hint}>Виконано всього</Text></View>
      <View><Text style={styles.value}>{activity.yearWorkouts}</Text><Text style={styles.hint}>За {activity.year} рік</Text></View>
      <View><Text style={styles.value}>{activity.activeDays}</Text><Text style={styles.hint}>Активних днів</Text></View>
    </View>
    <View style={styles.grid}>
      <View style={styles.weekdays}><Text style={styles.weekday}>Пн</Text><Text style={styles.weekday}>Ср</Text><Text style={styles.weekday}>Пт</Text><Text style={styles.weekday}>Нд</Text></View>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.weeks}
        onContentSizeChange={() => {
          if (positioned.current) return;
          positioned.current = true;
          const index = weeks.findIndex(week => week.some(day => day.date === activity.today));
          scroll.current?.scrollTo({ x: Math.max(0, (index - 9) * 21), animated: false });
        }}>
        {weeks.map((week, index) => {
          const monthDay = week.find(day => day.inYear && day.date.endsWith('-01'));
          return <View key={week[0].date} style={styles.week}>
            <Text style={styles.month}>{monthDay ? months[Number(monthDay.date.slice(5,7)) - 1] : index === 0 ? months[0] : ''}</Text>
            {week.map(day => <TouchableOpacity key={day.date} accessibilityRole="button"
              accessibilityLabel={`${displayWorkoutDate(day.date)}: тренувань — ${day.count}`} disabled={!day.inYear || day.future}
              onPress={() => setSelected(day)} style={[styles.day, { backgroundColor: day.inYear ? (day.count > 0 ? colors.accentText : colors.heat[0]) : 'transparent' }, day.future && styles.future,
                selected?.date === day.date && { borderColor: colors.accentText, borderWidth: 2 }]} />)}
          </View>;
        })}
      </ScrollView>
    </View>
    <View style={styles.legend}><View style={[styles.legendCell,{backgroundColor:colors.heat[0]}]} /><Text style={styles.hint}>Без тренування</Text><View style={[styles.legendCell,{backgroundColor:colors.accentText}]} /><Text style={styles.hint}>Тренувальний день</Text></View>
    {selected && <Text accessibilityLiveRegion="polite" style={styles.selection}>{displayWorkoutDate(selected.date)} · виконаних тренувань: {selected.count}</Text>}
    <Text style={styles.hint}>Зелений день — є виконане тренування. Усі вправи й групи м’язів додавай усередині нього.</Text>
  </View>;
}
const createStyles = (colors: Colors) => StyleSheet.create({
  container: { gap: 16 }, stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, value: { color: colors.text, fontSize: 27, fontWeight: '700', marginBottom: 5 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, grid: { flexDirection: 'row', gap: 8 }, weekdays: { width: 20, paddingTop: 28, gap: 23 }, weekday: { color: colors.muted, fontSize: 10, height: 19 },
  weeks: { gap: 4, paddingBottom: 10 }, week: { gap: 4, width: 17 }, day: { width: 17, height: 17, borderRadius: 4 }, month: { color: colors.muted, fontSize: 10, height: 20, width: 45 }, future: { opacity: 0.3 },
  legend: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'flex-end' }, legendCell: { width: 13, height: 13, borderRadius: 3 }, selection: { color: colors.accentText, fontSize: 14 },
});
