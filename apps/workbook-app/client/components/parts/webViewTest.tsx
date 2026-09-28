import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {WebView} from 'react-native-webview';
import type {WebViewSource} from 'react-native-webview/lib/WebViewTypes';
import {View} from 'react-native';
import AppText from '../identities/appText';
import tw from '../../tailwind.custom';
import iosAnswerWebView from '../../web/html/answerWebview.html';
import iosQuestionWebView from '../../web/html/questionWebview.html';
import {
  createLocalOriginWhitelist,
  resolveWebViewSourceUri,
} from '../functionals/webViewSecurity';

export type WebViewTestProps = {
  readonly currentTestNo: number;
  readonly targetType: 'question' | 'answer';
};

const WebViewTest = (props: WebViewTestProps) => {
  //  const [uri, setUri] = useState<string>('');
  const webviewRef = useRef<WebView>(null);
  const [isLoad, setIsLoad] = useState<boolean>(false);
  /** Defined Memos */
  // 基準キャッシュディレクトリパス
  const webViewSource = useMemo<WebViewSource>(() => {
    if (props.targetType === 'question')
      return iosQuestionWebView as WebViewSource;
    return iosAnswerWebView as WebViewSource;
  }, [props.targetType]);
  const mode = useMemo(() => {
    return 'test';
  }, []);
  const sourceUri = useMemo(() => {
    const uri = resolveWebViewSourceUri(webViewSource);
    return uri
      ? `${uri}?mode=${mode}&testNo=${props.currentTestNo}`
      : undefined;
  }, [mode, props.currentTestNo, webViewSource]);
  /** Defined Functions */
  // biome-ignore lint/correctness/useExhaustiveDependencies: ログ削除前の依存関係を維持し、処理の再実行条件を変更しない。
  const webViewSetup = useCallback(() => {
    setIsLoad(true);
  }, [props.currentTestNo]);
  /** Defined Effects */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!props.targetType) return;
    if (props.currentTestNo < 0) return;
    webViewSetup();
  }, [props.targetType]);

  return (
    <>
      {/*      <AppText>{String(props.boxNo)}</AppText>
      <AppText>{String(props.currentPlayNo)}</AppText>
  */}
      {isLoad ? (
        <WebView
          key="webview_test_storybook"
          ref={webviewRef}
          allowFileAccess
          allowsProtectedMedia
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs={false}
          scrollEnabled
          javaScriptCanOpenWindowsAutomatically
          nestedScrollEnabled
          incognito
          javaScriptEnabled
          decelerationRate="normal"
          cacheEnabled={false}
          style={tw`w-full`}
          containerStyle={tw``}
          webviewDebuggingEnabled={__DEV__}
          originWhitelist={createLocalOriginWhitelist(sourceUri)}
          source={{
            uri: sourceUri ?? '',
          }}
          onMessage={(event: {nativeEvent: {data: string}}) => {
            const data = JSON.parse(event.nativeEvent.data) as Record<
              string,
              any
            >;
            console.error(
              'WebViewエラー検知',
              summarizeConsoleValue(JSON.stringify(data)),
            );
            /*
            if (typeof data === 'object' && data?.quitTest) {
            }

            if (typeof data === 'object' && data?.isReady) {
            }
            */
          }}
        />
      ) : (
        <View>
          <AppText>ロード中......</AppText>
        </View>
      )}
    </>
  );
};

export default WebViewTest;
