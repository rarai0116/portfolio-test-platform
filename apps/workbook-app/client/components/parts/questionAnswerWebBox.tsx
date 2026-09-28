import {Platform, View} from 'react-native';
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useContext,
  memo,
} from 'react';
import {WebView} from 'react-native-webview';
import type {WebViewSource} from 'react-native-webview/lib/WebViewTypes';
import type {ICustomViewStyle} from 'react-native-reanimated-skeleton/src/constants';
import Skeleton from 'react-native-reanimated-skeleton';
import tw from '../../tailwind.custom';
import {
  type TestData,
  GlobalSaveDataContext,
} from '../hooks/useGlobalSaveDataContext';
import {ImageAssetContext} from '../hooks/useImageAssetContext';
import {
  QuestionAndChoicesViewContext,
  webViewState,
  type WebViewState,
} from '../hooks/useQuestionsAndChoicesViewContext';
import iosAnswerWebView from '../../web/html/answerWebview.html';
import iosQuestionWebView from '../../web/html/questionWebview.html';
import {
  createLocalOriginWhitelist,
  resolveWebViewSourceUri,
} from '../functionals/webViewSecurity';

export type WebViewTestProps = {
  readonly targetType: WebViewState;
  readonly currentPlayNo: number;
  readonly testData: TestData | null;
  readonly boxNo?: number;
  readonly onQuitTest: () => void;
  readonly handleWebViewRendered?: () => void; // WebViewがレンダリングされたときのコールバック
};
const SkeletonArea = memo((props: {readonly isLoading: boolean}) => {
  const skeletonLayout: ICustomViewStyle[] = [
    // ヘッダー部分のタイトル
    {
      key: 'No',
      width: '12%',
      height: 24,
      marginLeft: '3%',
      marginTop: 12,
      marginBottom: 5,
      borderRadius: 4,
    },

    // 本文
    {
      key: 'honbun',
      width: '90%',
      height: 72,
      marginLeft: '5%',
      marginTop: 0,
      marginBottom: 16,
      borderRadius: 10,
    },

    // 選択肢1
    {
      key: 'choice1',
      width: '87%',
      height: 64,
      marginLeft: '8%',
      marginBottom: 16,
      borderRadius: 10,
    },

    // 選択肢2
    {
      key: 'choice2',
      width: '87%',
      height: 64,
      marginLeft: '8%',
      marginBottom: 16,
      borderRadius: 10,
    },
    // 選択肢3
    {
      key: 'choice3',
      width: '87%',
      height: 64,
      marginLeft: '8%',
      marginBottom: 16,
      borderRadius: 10,
    },
    // 選択肢4
    {
      key: 'choice4',
      width: '87%',
      height: 64,
      marginLeft: '8%',
      marginBottom: 16,
      borderRadius: 10,
    },
    // 選択肢5
    {
      key: 'choice5',
      width: '87%',
      height: 64,
      marginLeft: '8%',
      marginBottom: 16,
      borderRadius: 10,
    },
    // 終了して結果を見る
    {
      key: 'quit-test',
      width: '50%',
      height: 16,
      marginLeft: '25%',
      marginBottom: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E1E9EE',
    },
  ];
  return (
    <Skeleton
      isLoading={props.isLoading}
      containerStyle={tw`flex-1 bg-white p-0 pl-4 w-full h-full`}
      animationDirection="horizontalLeft"
      layout={skeletonLayout}
    />
  );
});

const QuestionAnswerWebBox = (props: WebViewTestProps) => {
  /** Load Context */
  const {localAssetList} = useContext(ImageAssetContext);
  const {
    isFinished,
    isQaa,
    footerHeight,
    isAnswerMode,
    testDataNoList,
    getSeed,
  } = useContext(QuestionAndChoicesViewContext);
  const {basisDir} = useContext(GlobalSaveDataContext);
  /*
  Const {testDataNoList, isFinished, webViewLoadCount} = useContext(
    GlobalUserSettingContext,
  );
  */
  /** Defined States */
  // const [uri, setUri] = useState<string>('');
  const webviewRef = useRef<WebView>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isWebViewReady, setIsWebViewReady] = useState<boolean>(false);

  /** Defined Memos */
  // 基準キャッシュディレクトリパス
  const webViewSource = useMemo(() => {
    if (props.targetType === webViewState.question) {
      return iosQuestionWebView as WebViewSource;
    }

    if (props.targetType === webViewState.answer) {
      return iosAnswerWebView as WebViewSource;
    }

    return iosQuestionWebView as WebViewSource;
  }, [props.targetType]);

  const seed = useMemo(
    () => getSeed(props.currentPlayNo),
    [getSeed, props.currentPlayNo],
  );

  /*
  const mode = useMemo(() => {
    if (Constants.expoConfig?.extra?.APP_ENV === 'test') {
      return 'test';
    }

    return 'build';
  }, []);
  */
  const uri = useMemo(() => {
    if (Platform.OS === 'ios') {
      return 'dummyButNecessary';
    }

    if (!basisDir) {
      return '';
    }

    if (props.targetType === webViewState.question) {
      return `file://${basisDir}${localAssetList?.questionWebview?.localPath}`;
    }

    if (props.targetType === webViewState.answer) {
      return `file://${basisDir}${localAssetList?.answerWebview?.localPath}`;
    }

    return '';
  }, [basisDir, localAssetList, props.targetType]);
  const source = useMemo(
    () => (Platform.OS === 'android' ? {uri} : webViewSource),
    [uri, webViewSource],
  );
  const sourceUri = useMemo(() => resolveWebViewSourceUri(source), [source]);
  const injectJavaScript = useCallback(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    if (uri.length === 0) {
      return undefined;
    }

    if (!props.testData) {
      return undefined;
    }

    if (props.targetType === webViewState.question) {
      return `(function(){
      try{
			const isFinished = ${isFinished};
			if(isFinished){
				document.getElementById('quit-test').style.display = 'none'
			}
			const quitTestButton = document.getElementById('quit-test');
      if(quitTestButton){
  			quitTestButton.addEventListener('click',()=>{
	  			window.ReactNativeWebView.postMessage(JSON.stringify({quitTest: true}));
		  	})
      }
			const dataNo = \`${props.testData.testNo}\`;
			const testNo = \`${String(props.currentPlayNo + 1)}\`;
			const honbun = \`${props.testData.text ?? ''}\`;
      const isQaa = \`${isQaa}\`;
			const ch1 = \`${props.testData.ch1 ?? ''}\`;
			const ch2 = \`${props.testData.ch2 ?? ''}\`;
			const ch3 = \`${props.testData.ch3 ?? ''}\`;
			const ch4 = \`${props.testData.ch4 ?? ''}\`;
			const ch5 = \`${props.testData.ch5 ?? ''}\`;
      const seed = \`${seed}\`;
      const answerFinished = false;
      window.footerHeight = \`${footerHeight}\`;
      if(typeof onloadProcess === 'function') onloadProcess(honbun,ch1,ch2,ch3,ch4,ch5,dataNo,testNo,isQaa,seed);
      }catch(e){
        alert(e);
        console.error('error',e);
        window.ReactNativeWebView.postMessage(JSON.stringify(e));
      }
			})();
      true;`;
    }

    if (props.targetType === webViewState.answer) {
      // Console.log('testData', testData);
      return `(function(){
      try{
			const isFinished = ${isFinished};
			if(isFinished){
				document.getElementById('quit-test').style.display = 'none'
			}
			const quitTestButton = document.getElementById('quit-test');
      if(quitTestButton){
  			quitTestButton.addEventListener('click',()=>{
	  			window.ReactNativeWebView.postMessage(JSON.stringify({quitTest: true}));
		  	})
      }
			const nengo = \`${props.testData.nengo}\`;
			const year = \`${props.testData.year}\`;
			const dataNo = \`${props.testData.testNo}\`;
			const testNo = \`${String(props.currentPlayNo + 1)}\`;
      const isQaa = \`${isQaa}\`;
			const honbun = \`${props.testData.answerText ?? ''}\`;
			const ch1 = \`${props.testData.answerText1 ?? ''}\`;
			const ch2 = \`${props.testData.answerText2 ?? ''}\`;
			const ch3 = \`${props.testData.answerText3 ?? ''}\`;
			const ch4 = \`${props.testData.answerText4 ?? ''}\`;
			const ch5 = \`${props.testData.answerText5 ?? ''}\`;
      const seed = \`${seed}\`;
      window.footerHeight = \`${footerHeight}\`;
			if(typeof onloadProcess === 'function') onloadProcess(honbun,ch1,ch2,ch3,ch4,ch5,dataNo,testNo,nengo,year,isQaa,seed);
      }catch(e){
        console.error('error',e);
        window.ReactNativeWebView.postMessage(JSON.stringify(e));
      }
			})();
      true;`;
    }

    return undefined;
  }, [
    footerHeight,
    props.testData,
    props.targetType,
    isFinished,
    props.currentPlayNo,
    uri,
    isQaa,
    seed,
  ]);

  /** Defined Functions */
  /*
  const webViewSetup = useCallback(() => {
    console.log(
      `★QuestionAnswerWebBox/WebViewセットアップNo:${props.currentPlayNo}`,
    );
    const path = (() => {
      if (Platform.OS === 'ios') return 'dummyButNecessary';
      if (!basisDir) return '';
      if (props.targetType === webViewState.question)
        return `${basisDir}${localAssetList?.questionWebview?.localPath}`;
      if (props.targetType === webViewState.answer)
        return `${basisDir}${localAssetList?.answerWebview?.localPath}`;
      return '';
    })();
    console.log('path', path);
    webviewRef.current?.reload();
    setUri(path);
    if (path !== '' && props.testData) {
      const localUri = `${path}?dataNo=${props.testData.testNo}&testNo=${String(
        props.currentPlayNo + 1,
      )}&mode=${mode}`;
      console.log('localUri', localUri);
      setUri(localUri);
    }
  }, [basisDir, localAssetList, props.currentPlayNo]);
  */

  const _handleLoadEnd = useCallback(() => {
    setIsWebViewReady(true);
  }, []);
  /** Defined Effects */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // If (props.boxNo === 0) console.log('0番のprops', props);
    if (!props.testData) {
      return;
    }

    if (!props.targetType) {
      return;
    }

    if (props.currentPlayNo < 0) {
      return;
    }

    if (isLoaded) {
      return;
    }

    // WebviewRef.current?.reload();
  }, [props.targetType, props.testData, props.currentPlayNo]);

  useEffect(() => {
    if (isWebViewReady && injectJavaScript !== undefined) {
      /* Console.log(
        '★QuestionAnswerWebBox/WebView読み込み完了',
        webviewRef.current,
        injectJavaScript(),
      ); */
      webviewRef.current!.injectJavaScript(injectJavaScript() ?? 'true;');
      setIsLoaded(true);
    }
  }, [isWebViewReady, injectJavaScript]);

  return (
    <>
      <View
        style={tw`items-center justify-center absolute z-10 w-[95%] h-auto mb-[${footerHeight}px]`}
      >
        <SkeletonArea isLoading={!isLoaded} />
      </View>
      <WebView
        key={uri}
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
        webviewDebuggingEnabled={__DEV__}
        limitsNavigationsToAppBoundDomains
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.998}
        cacheEnabled={false}
        scalesPageToFit={false}
        androidLayerType="hardware"
        thirdPartyCookiesEnabled={false}
        setBuiltInZoomControls={false}
        textZoom={100}
        pullToRefreshEnabled={false}
        style={tw`w-full`}
        originWhitelist={createLocalOriginWhitelist(sourceUri)}
        source={source}
        onLoadEnd={_handleLoadEnd}
        onMessage={(event: {nativeEvent: {data: string}}) => {
          console.info('WebView通知受信');
          const data = JSON.parse(event.nativeEvent.data) as Record<
            string,
            any
          >;
          // , data);
          const answerFinished =
            isAnswerMode && props.currentPlayNo + 1 >= testDataNoList.length;
          if (typeof data === 'object' && data?.quitTest && !answerFinished) {
            props.onQuitTest();
          }

          if (typeof data === 'object' && data?.isRendered) {
            console.info(
              'WebView描画完了通知',
              data.isRendered,
              props.boxNo,
              props.targetType,
            );
            props.handleWebViewRendered?.();
          }
        }}
      />
    </>
  );
};

export default QuestionAnswerWebBox;
