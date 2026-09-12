import { api } from '@beegreat/backend/convex/_generated/api';
import { useConvexAuth, useQuery } from 'convex/react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const trackers = ['mood', 'water', 'journal'] as const;
const accents = ['#75A469', '#55BEE2', '#E4A72C'];
function ringPath(radius: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * Math.PI / 180
    return `${i ? 'L' : 'M'}${50 + radius * Math.cos(angle)} ${50 + radius * Math.sin(angle)}`
  }).join(' ') + ' Z'
}
const dateOf = (key: string) => new Date(`${key}T12:00:00Z`);
export function HealthStreaks({ localDate }: { localDate: string }) {
  const { isAuthenticated } = useConvexAuth();
  const theme = useTheme();
  const [month, setMonth] = useState(localDate.slice(0, 7));
  const [width, setWidth] = useState(0);
  const first = dateOf(`${month}-01`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const throughDate = last.toISOString().slice(0, 10) < localDate ? last.toISOString().slice(0, 10) : localDate;
  const stats = useQuery(api.healthJournal.overview, isAuthenticated ? { throughDate } : 'skip');
  const offset = (first.getUTCDay() + 6) % 7;
  const rows = Math.ceil((offset + last.getUTCDate()) / 7);
  const diameter = width / 6.63;
  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1, 12));
    setMonth(next.toISOString().slice(0, 7));
  }
  return <View style={{ gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><ThemedText style={{ flex: 1, fontSize: 22, fontWeight: '600' }}>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</ThemedText>{[-1, 1].map(delta => <Pressable key={delta} accessibilityRole="button" accessibilityLabel={delta < 0 ? 'Previous month' : 'Next month'} disabled={delta > 0 && month >= localDate.slice(0, 7)} onPress={() => changeMonth(delta)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: delta > 0 && month >= localDate.slice(0, 7) ? .25 : 1 }}><ThemedText style={{ fontSize: 28 }}>{delta < 0 ? '‹' : '›'}</ThemedText></Pressable>)}</View>
    <View style={{ flexDirection: 'row', gap: 8 }}>{trackers.map((key, i) => <View key={key} style={{ flex: 1, gap: 4 }}><ThemedText type="small" style={{ color: accents[i] }}>{key[0].toUpperCase() + key.slice(1)}</ThemedText><ThemedText style={{ fontSize: 20, fontWeight: '600' }}>{stats ? stats[key].windowDays ? `${stats[key].current}${stats[key].currentCapped ? '+' : ''} ${stats[key].current === 1 ? 'day' : 'days'}` : '—' : '—'}</ThemedText></View>)}</View>
    {!stats ? <ThemedText type="small">Loading calendar…</ThemedText> : <>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', height: diameter * (1 + (rows - 1) * .75) }}>
        {width > 0 && Array.from({ length: last.getUTCDate() }, (_, index) => {
          const key = `${month}-${String(index + 1).padStart(2, '0')}`;
          const item = stats.calendar.find(value => value.localDate === key);
          const row = Math.floor((offset + index) / 7), col = (offset + index) % 7;
          const progress = [item?.mood ? 1 : 0, item?.water ?? 0, item?.journal ? 1 : 0];
          const future = key > localDate;
          const description = `${dateOf(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}. ${future ? 'Future day' : `Mood ${item?.mood ? 'logged' : 'not logged'}. Water ${Math.round((item?.water ?? 0) * 100)} percent. Journal ${item?.journal === null ? 'history unavailable' : item?.journal ? 'logged' : 'not logged'}`}`;
          return <View key={key} accessible accessibilityRole="image" accessibilityLabel={description} style={{ position: 'absolute', left: diameter * .866 * (col + row % 2 * .5), top: diameter * row * .75, width: diameter, height: diameter, opacity: future ? .35 : 1 }}>
            <Svg viewBox="0 0 100 100" width="100%" height="100%"><Path fill={theme.card} stroke={key === localDate ? theme.primary : theme.border} strokeWidth={key === localDate ? 2.4 : 1.5} d="M50 3 Q52 3 54 5 L88 25 Q91 27 91 30 L91 70 Q91 73 88 75 L54 95 Q50 98 46 95 L12 75 Q9 73 9 70 L9 30 Q9 27 12 25 L46 5 Q48 3 50 3Z" />{progress.map((value, i) => { const radius = 38 - i * 9; const perimeter = 6 * radius; return <G key={i} fill="none" stroke={accents[i]} strokeWidth={4.3} strokeLinejoin="round"><Path d={ringPath(radius)} opacity={.16} />{value > 0 && <Path d={ringPath(radius)} strokeDasharray={value < 1 ? [perimeter * value, perimeter] : undefined} strokeLinecap="round" />}</G>; })}<SvgText x={50} y={51} fill={theme.text} fontSize={17} textAnchor="middle" alignmentBaseline="central">{index + 1}</SvgText></Svg>
          </View>;
        })}
      </View>
    </>}
  </View>;
}
