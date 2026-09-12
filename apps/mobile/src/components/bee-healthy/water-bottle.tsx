import { BOTTLE_HTML } from '@beegreat/hive-3d';
import { useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
const source = { html: BOTTLE_HTML, baseUrl: 'https://water.beegreat.local/' };
export function WaterBottle({ valueMl }: { valueMl: number }) {
  const view = useRef<WebView>(null);
  const amount = Number.isFinite(valueMl) ? Math.max(0, valueMl) : 0;
  const script = `window.hive?.setState({balance:${amount}});true;`;
  useEffect(() => { view.current?.injectJavaScript(script); }, [script]);
  return <WebView ref={view} source={source} style={{ width: '100%', height: 190, backgroundColor: 'transparent' }} containerStyle={{ flex: 0 }}
    accessibilityLabel={`${amount} of 2000 millilitres. Drag to rotate bottle.`}
    originWhitelist={['*']} onShouldStartLoadWithRequest={({ url }) => url === source.baseUrl || url === 'about:blank'}
    javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never" allowFileAccess={false}
    injectedJavaScript={script} onLoadEnd={() => view.current?.injectJavaScript(script)} onMessage={() => {}} />;
}
