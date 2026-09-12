import { HIVE_HTML, HONEY_CAPACITY, honeyState } from '@beegreat/hive-3d';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Spacing } from '@/constants/theme';

export const MVP_HONEY_CAPACITY = HONEY_CAPACITY;
const source = { html: HIVE_HTML, baseUrl: 'https://hive.beegreat.local/' };

export function HoneyVessel({ balance }: { balance: number }) {
  const view = useRef<WebView>(null);
  const { width } = useWindowDimensions();
  const size = Math.min(width - Spacing.three * 2, 340);
  const state = honeyState(balance);
  const script = `window.hive?.setState({balance:${Number.isFinite(balance) ? Math.max(0, balance) : 0}});true;`;
  useEffect(() => { view.current?.injectJavaScript(script); }, [script]);

  return (
    <View style={styles.container}>
      <WebView
        ref={view}
        source={source}
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        containerStyle={{ flex: 0 }}
        accessibilityLabel={`${state.label}. Drag left or right to rotate.`}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => url === source.baseUrl || url === 'about:blank'}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        allowFileAccess={false}
        injectedJavaScript={script}
        onLoadEnd={() => view.current?.injectJavaScript(script)}
        onMessage={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { alignItems: 'center' } });
