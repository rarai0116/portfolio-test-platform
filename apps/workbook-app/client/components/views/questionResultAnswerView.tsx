import {useContext, useState, useMemo} from 'react';
import {ScrollView, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Spacer from '../parts/spacer';
import Background from '../parts/background';
import AnswerDataPart from '../parts/answerDataPart';
import type {AnswerDataPartProps} from '../parts/answerDataPart';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import QuestionAnswerWebBox from '../parts/questionAnswerWebBox';
import type {TestViewsProps} from '../../types/viewParameter';
import SecondaryShortButtonWithArrowFooter from '../organisms/secondaryShortButtonWithArrowFooter';
import {CheckButtonStates} from '../hooks/useCheckButtonContext';
import {QuestionAndChoicesViewContext} from '../hooks/useQuestionsAndChoicesViewContext';
import tw from '@/tailwind.custom';
import ModalManagerContextProvider from '../hooks/useModalManagerContext';
import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import ErrorReportFormViewModal from '../viewmodals/errorReportFormVIewModal';
import ErrorReporfFormAskSubmitModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormAskSubmitModal';
import ErrorReportFormSubmitCompletedModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormSubmitCompletedModal';
import ErrorReportFormSubmitFailedModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormSubmitFailedModal';

export type QuestionResultAnswerViewProps = Record<string, never>;

const QuestionResultAnswerView = (_props: QuestionResultAnswerViewProps) => {
  const route = useRoute<TestViewsProps<'QuestionResultAnswerView'>['route']>();
  const _navigation =
    useNavigation<TestViewsProps<'QuestionResultAnswerView'>['navigation']>();
  const {answerList, selectedAnswerList, currentTestDatalist, isQaa} =
    useContext(QuestionAndChoicesViewContext);
  const _currentPlayNo = useMemo(
    () => route.params.currentPlayNo,
    [route.params.currentPlayNo],
  );

  const [webViewTargetType, setWebViewTargetType] = useState<
    'question' | 'answer'
  >('answer');
  const answerDataPartProps: AnswerDataPartProps = useMemo(() => {
    const correctAnswer = String(answerList[_currentPlayNo] ?? 0);
    const usersAnswer =
      selectedAnswerList[_currentPlayNo] === 0
        ? '－'
        : String(selectedAnswerList[_currentPlayNo]);
    const isCorrect = correctAnswer === usersAnswer;
    const buttonInfo: ButtonInfo = {
      id: 'request-report-bug',
      name: '報告',
      initialState: CheckButtonStates.disabled,
    };
    return {
      correctAnswer,
      usersAnswer,
      isCorrect,
      buttonInfo,
      isQaa,
    };
  }, [answerList, selectedAnswerList, _currentPlayNo, isQaa]);

  // 親のナビゲーション（Bottom Tab Navigator）を取得してタブバーを非表示にする
  /*
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({tabBarStyle: {display: 'none'}});
    return () => {
      // 画面がアンマウントされたら元に戻す
      parent?.setOptions({tabBarStyle: {}});
    };
  }, [navigation]);
  */

  return (
    <ModalManagerContextProvider>
      <ScrollView>
        <Background>
          <TextInputContextProvider>
            <ErrorReportFormViewModal />
            <ErrorReporfFormAskSubmitModal />
            <ErrorReportFormSubmitCompletedModal />
            <ErrorReportFormSubmitFailedModal />
          </TextInputContextProvider>
          <Spacer isHorizontal={false} size={12} />
          <AnswerDataPart {...answerDataPartProps} />
          <Spacer isHorizontal={false} size={12} />
          <View
            style={
              webViewTargetType === 'question' ? tw`flex-1` : tw`opacity-0`
            }
            pointerEvents={webViewTargetType === 'question' ? 'auto' : 'none'}
          >
            <QuestionAnswerWebBox
              testData={currentTestDatalist[_currentPlayNo]}
              currentPlayNo={_currentPlayNo}
              targetType="question"
              onQuitTest={() => {}}
            />
          </View>
          <View
            style={webViewTargetType === 'answer' ? tw`flex-1` : tw`opacity-0`}
            pointerEvents={webViewTargetType === 'answer' ? 'auto' : 'none'}
          >
            <QuestionAnswerWebBox
              testData={currentTestDatalist[_currentPlayNo]}
              currentPlayNo={_currentPlayNo}
              targetType="answer"
              onQuitTest={() => {}}
            />
          </View>
        </Background>
      </ScrollView>
      <SecondaryShortButtonWithArrowFooter
        buttonText={
          webViewTargetType === 'question' ? '解説文を表示' : '問題文を表示'
        }
        onPressOutSecondaryButton={() => {
          if (webViewTargetType === 'question') setWebViewTargetType('answer');
          if (webViewTargetType === 'answer') setWebViewTargetType('question');
        }}
      />
    </ModalManagerContextProvider>
  );
};

export default QuestionResultAnswerView;
