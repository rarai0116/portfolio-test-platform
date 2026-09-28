import {View} from 'react-native';
import {useContext, useEffect, useState} from 'react';
import tw from '../../tailwind.custom';
import QuestionAnswerWebBox from '../parts/questionAnswerWebBox';
import {
  QuestionAndChoicesViewContext,
  webViewState,
} from '../hooks/useQuestionsAndChoicesViewContext';
import type {TestData} from '../hooks/useGlobalSaveDataContext';

export type SwitchQuestionBoxesProps = {
  readonly onQuitTest: () => void; // テストを終了するための関数
  readonly handleWebViewRendered?: () => void; // WebViewがレンダリングされたときのコールバック
};

export type PreloadedQuestionAnswerWebBoxProps = {
  readonly boxNo: number;
  readonly targetType: (typeof webViewState)[keyof typeof webViewState];
  readonly currentPlayNo: number;
  readonly testData: TestData | null; // 適切な型に置き換えてください
  readonly onQuitTest: () => void; // テストを終了するための関数
  readonly handleWebViewRendered?: () => void; // WebViewがレンダリングされたときのコールバック
};
const PreloadedQuestionAnswerWebBox = (
  props: PreloadedQuestionAnswerWebBoxProps,
) => {
  const {boxNo, targetType, currentPlayNo, testData, onQuitTest} = props;
  const [refreshKey, setRefreshKey] = useState(0);

  // testData や currentPlayNo が変わった際に内部 key を更新してWebViewを再生成する
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [currentPlayNo, testData]);

  return (
    <QuestionAnswerWebBox
      key={`${boxNo}-${targetType}-${refreshKey}`}
      boxNo={boxNo}
      targetType={targetType}
      currentPlayNo={currentPlayNo}
      testData={testData}
      handleWebViewRendered={props.handleWebViewRendered}
      onQuitTest={onQuitTest}
    />
  );
};

// 解説用と問題用のWebViewのペアを２つのレイヤーに合計４層で表示する
// 実際に表示するwebViewはselectLayerとisQuestionの組み合わせによって一つに絞られる
// 0: 問題用WebView, 1: 解説用WebView
// isQuestion: true: 問題用, false: 解説用
// layerZeroPlayNo: 0層目の再生番号
// layerOnePlayNo: 1層目の再生番号
// displayLayer: 選択されたレイヤー
const SwitchQuestionBoxes = (props: SwitchQuestionBoxesProps) => {
  const {onQuitTest} = props;
  const {
    displayLayer,
    layerZeroPlayNo,
    layerOnePlayNo,
    layerZeroTestData,
    layerOneTestData,
    isAnswerShowed,
  } = useContext(QuestionAndChoicesViewContext);

  return (
    <>
      {/* Layer 0: 表示中の場合も裏でも常にレンダリング */}
      <View
        style={
          displayLayer === 0 && !isAnswerShowed ? tw`flex-1` : tw`opacity-0`
        }
        pointerEvents={displayLayer === 0 && !isAnswerShowed ? 'auto' : 'none'}
      >
        <PreloadedQuestionAnswerWebBox
          boxNo={0}
          targetType={webViewState.question}
          currentPlayNo={layerZeroPlayNo}
          testData={layerZeroTestData}
          handleWebViewRendered={props.handleWebViewRendered}
          onQuitTest={onQuitTest} // テストを終了するための関数を渡す
        />
      </View>
      <View
        style={
          displayLayer === 0 && isAnswerShowed ? tw`flex-1` : tw`opacity-0`
        }
        pointerEvents={displayLayer === 0 && isAnswerShowed ? 'auto' : 'none'}
      >
        <PreloadedQuestionAnswerWebBox
          boxNo={0}
          targetType={webViewState.answer}
          currentPlayNo={layerZeroPlayNo}
          testData={layerZeroTestData}
          handleWebViewRendered={props.handleWebViewRendered}
          onQuitTest={onQuitTest} // テストを終了するための関数を渡す
        />
      </View>

      {/* Layer 1: 表示中の場合も裏でも常にレンダリング */}
      <View
        style={
          displayLayer === 1 && !isAnswerShowed ? tw`flex-1` : tw`opacity-0`
        }
        pointerEvents={displayLayer === 1 && !isAnswerShowed ? 'auto' : 'none'}
      >
        <PreloadedQuestionAnswerWebBox
          boxNo={1}
          targetType={webViewState.question}
          currentPlayNo={layerOnePlayNo}
          testData={layerOneTestData}
          handleWebViewRendered={props.handleWebViewRendered}
          onQuitTest={onQuitTest} // テストを終了するための関数を渡す
        />
      </View>
      <View
        style={
          displayLayer === 1 && isAnswerShowed ? tw`flex-1` : tw`opacity-0`
        }
        pointerEvents={displayLayer === 1 && isAnswerShowed ? 'auto' : 'none'}
      >
        <PreloadedQuestionAnswerWebBox
          boxNo={1}
          targetType={webViewState.answer}
          currentPlayNo={layerOnePlayNo}
          testData={layerOneTestData}
          handleWebViewRendered={props.handleWebViewRendered}
          onQuitTest={onQuitTest} // テストを終了するための関数を渡す
        />
      </View>
    </>
  );
};

export default SwitchQuestionBoxes;
