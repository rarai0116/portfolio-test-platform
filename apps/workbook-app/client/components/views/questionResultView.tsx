import {ScrollView, View} from 'react-native';
import {useMemo, useContext, useCallback, useEffect, useState} from 'react';
import {useRoute, useNavigation, useIsFocused} from '@react-navigation/native';
import {Timestamp} from '@react-native-firebase/firestore';
import {logErrorToAnalytics} from '@functionals/analyticsController';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Background from '../parts/background';
import {
  type ButtonInfo,
  type ButtonInfoList,
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from '../hooks/useCheckButtonContext';
import QuestionResultList from '../parts/questionResultList';
import CorrectAnswerRateCard from '../parts/correctAnswerRateCard';
import Spacer from '../parts/spacer';
import {type TestViewsProps, allScreenIdList} from '../../types/viewParameter';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';
import {resultState, type ResultStateType} from '../parts/questionResultPart';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import {generateTestDataId} from '../functionals/testDataController';
import {
  type DailyLog,
  updateDailyLog,
} from '../functionals/firestoreController';
import {QuestionAndChoicesViewContext} from '../hooks/useQuestionsAndChoicesViewContext';
import {HomeHeaderButton} from '../organisms/headerButtons';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import {questionSettingState, questionState} from '../../types/commonUnionType';
import {TaskDataContext} from '../hooks/useTaskDataContext';
import PrimaryShortButton from '@/components/parts/primaryShortButton';

export type QuestionResultViewProps = Record<string, never>; // footerButtonState: ButtonStateType

const QuestionResultView = (_props: QuestionResultViewProps) => {
  const isFocused = useIsFocused();
  const route = useRoute<TestViewsProps<'QuestionResultView'>['route']>();
  const navigation =
    useNavigation<TestViewsProps<'QuestionResultView'>['navigation']>();
  const {
    currentDailyLog,
    testIdList,
    gradeNumber,
    currentRecordKey,
    setCurrentPlayData,
    currentPlayData,
  } = useContext(GlobalUserSettingContext);
  const {
    answerList,
    testDataNoList,
    selectedAnswerList,
    correctAnswerCount,
    isQaa,
  } = useContext(QuestionAndChoicesViewContext);
  const {setAnswerlingTestSettingData, getTestDataList, addSavedSettingList} =
    useContext(GlobalSaveDataContext);
  const {taskSettingList} = useContext(TaskDataContext);
  const [isQuit, setIsQuit] = useState<boolean>(false);

  const resultList = useMemo(() => {
    return selectedAnswerList.map((choice, index) => {
      let result: ResultStateType;
      const _no = testDataNoList[index];
      // seed値から選択肢配列を作成
      /*
      const seed = getSeed(no);
      console.log('⭐️seed', seed);
      const choicesArray = createChoicesArray(grade!, seed);
      console.log('⭐️choicesArray', choicesArray);
      */

      if (choice === 0) {
        result = resultState.unanswered;
      } else if (choice === answerList[index]) {
        result = resultState.correct;
      } else {
        result = resultState.wrong;
      }

      return {
        questionNumber: String(index + 1),
        result,
        onPressOutExplanationButton() {
          navigation.navigate('QuestionResultAnswerView', {
            userId: allScreenIdList.QuestionResultAnswerView,
            currentPlayNo: index,
          });
        },
      };
    });
  }, [answerList, selectedAnswerList, testDataNoList, navigation]);

  const buttonInfoList: ButtonInfoList = useMemo(() => {
    return resultList.map((_v, index) => {
      const checkBoxState =
        resultList[index].result === resultState.correct // 正解以外はチェック
          ? CheckButtonStates.unchecked
          : CheckButtonStates.checked;
      // console.log(checkBoxState);
      const buttonInfo: ButtonInfo = {
        id: `${index}`,
        name: `No.${index + 1}`,
        initialState: checkBoxState,
      };
      return buttonInfo;
    });
  }, [resultList]);
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  /** Defined Memos */

  const moveToQuestionHome = useCallback(
    async (_currentDailyLog: DailyLog) => {
      console.log('問題ホームへ移動');
      if (!currentRecordKey) throw new Error('currentRecordKeyがありません');
      if (!gradeNumber) throw new Error('gradeNumberがありません');
      if (
        currentDailyLog !== _currentDailyLog &&
        (_currentDailyLog.newWeaklyAnswerIdRegisted.length > 0 ||
          _currentDailyLog.newWeaklyAnswerIdUnRegisted.length > 0)
      ) {
        updateDailyLog({
          gradeNumber,
          _answerList: [],
          _answerIdList: [],
          _correctAnswerList: [],
          _newWeaklyAnswerIdRegisted:
            _currentDailyLog.newWeaklyAnswerIdRegisted,
          _newWeaklyAnswerIdUnRegisted:
            _currentDailyLog.newWeaklyAnswerIdUnRegisted,
          _newCorrectlyAnswerIdRegisted: [],
          startAt: _currentDailyLog.playRecord[currentRecordKey].startAt,
          weaklyAnswerIdList: testIdList.weakPoint.total,
        }).catch((_error: unknown) => {
          testIdList.weakPoint.set(
            _currentDailyLog.newWeaklyAnswerIdRegisted,
            _currentDailyLog.newWeaklyAnswerIdUnRegisted,
          );
          return {status: 'error'};
        });
      }

      if (
        currentPlayData?.settingCardData.settingState ===
        questionSettingState.task
      ) {
        const {id} = currentPlayData.settingCardData;
        const taskSetting = taskSettingList[id]?.taskSetting;
        if (taskSetting) {
          addSavedSettingList({
            ...taskSettingList[id],
            taskSetting: {
              ...taskSetting,
              taskState: questionState.completed,
            },
          }).catch((error: unknown) => {
            console.error('課題の状態を更新できませんでした', error);
          });
        }
      } else {
        // タスク以外の場合は、中断データを削除
        setAnswerlingTestSettingData(null).catch((error: unknown) => {
          console.error('moveToQuestionHome：処理失敗', error);
        });
      }

      setCurrentPlayData(() => null);
      navigation.getParent()?.navigate('Tab', {
        userId: allScreenIdList.Tab,
        screen: 'QuestionTab',
        params: {
          userId: allScreenIdList.QuestionTab,
          screen: 'Home',
          params: {
            userId: allScreenIdList.Home,
          },
        },
      });
    },
    [
      gradeNumber,
      navigation,
      setCurrentPlayData,
      setAnswerlingTestSettingData,
      currentDailyLog,
      currentRecordKey,
      testIdList,
      addSavedSettingList,
      taskSettingList,
      currentPlayData,
    ],
  );

  const testList = useMemo(() => {
    if (!currentPlayData) return [];
    return getTestDataList(currentPlayData.settingCardData.isQaa ?? false);
  }, [currentPlayData, getTestDataList]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (!currentDailyLog) return;
    if (isQuit) {
      // buttonInfoListとcheckedButtonListを比較して、新たにチェックされたボタンがあれば、それをcurrentDailyLog.newWeaklyAnswerIdRegistedに追加する

      const newWeaklyAnswerIdRegisted: string[] = checkedButtonList
        .filter((v, _index) => {
          return (
            buttonInfoList[Number(v.id)].initialState ===
            CheckButtonStates.unchecked
          );
        })
        .reduce((acc: string[], v) => {
          try {
            const id = generateTestDataId(
              testList[testDataNoList[Number(v.id)]],
              isQaa,
            );
            // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
            return [...acc, id];
          } catch (error: unknown) {
            console.error('終了時苦手問題登録失敗', error);
            const {name, message} =
              error instanceof Error
                ? error
                : {name: 'unknown error', message: 'unknown error'};
            logErrorToAnalytics(name, message, 'QuestionResultView registing', {
              testDataNo: testDataNoList[Number(v.id)],
              isQaa,
            });
            return acc;
          }
        }, []);

      const newWeaklyAnswerIdUnRegisted: string[] = buttonInfoList
        .filter(
          (v, index) =>
            buttonInfoList[index].initialState === CheckButtonStates.checked &&
            !checkedButtonList.includes(v),
        )
        .reduce((acc: string[], v) => {
          try {
            const id = generateTestDataId(
              testList[testDataNoList[Number(v.id)]],
              isQaa,
            );
            // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
            return [...acc, id];
          } catch (error: unknown) {
            console.error('終了時苦手問題解除失敗', error);
            const {name, message} =
              error instanceof Error
                ? error
                : {name: 'unknown error', message: 'unknown error'};
            logErrorToAnalytics(
              name,
              message,
              'QuestionResultView unregisting',
              {
                testDataNo: testDataNoList[Number(v.id)],
                isQaa,
              },
            );
            return acc;
          }
        }, []);

      const _recordKey = Timestamp.now().toMillis();
      const _currentDailyLog: DailyLog = {
        ...currentDailyLog,
        newWeaklyAnswerIdRegisted: [...newWeaklyAnswerIdRegisted],
        newWeaklyAnswerIdUnRegisted: [...newWeaklyAnswerIdUnRegisted],
        playRecord: {
          ...currentDailyLog.playRecord,
          [_recordKey]: {
            startAt: _recordKey,
            endAt: _recordKey,
          },
        },
      };

      moveToQuestionHome(_currentDailyLog).catch((error: unknown) => {
        console.error('遷移前エラー', error);
      });
    } else {
      navigation.setOptions({
        headerLeft() {
          return (
            <HomeHeaderButton
              color="#ffffff"
              buttonState={ButtonStates.released}
              onPressOut={() => {
                setIsQuit(true);
              }}
            />
          );
        },
      });
    }
  }, [isFocused, isQuit]);

  // 親のナビゲーション（Bottom Tab Navigator）を取得してタブバーを非表示にする
  /*
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (isFocused) {
      parent?.setOptions({tabBarStyle: {display: 'none'}});
    } else {
      // 画面がアンマウントされたら元に戻す
      parent?.setOptions({tabBarStyle: {}});
    }
  }, [isFocused]);
  */

  return (
    <>
      <ScrollView>
        <Background>
          <Spacer isHorizontal={false} size={36} />
          <CorrectAnswerRateCard
            numberOfCorrectAnswers={correctAnswerCount}
            totalNumberOfQuestionsinTest={answerList.length}
          />
          <Spacer isHorizontal={false} size={24} />
          <AppText style={tw`text-primary text-sm pl-7`}>苦手</AppText>
          <CheckButtonContextProvider
            buttonInfoList={buttonInfoList}
            checkedButtonList={checkedButtonList}
            setCheckedButtonList={setCheckedButtonList}
          >
            <QuestionResultList data={resultList} />
          </CheckButtonContextProvider>
          <Spacer isHorizontal={false} size={72} />
        </Background>
      </ScrollView>
      <View style={tw`w-full items-center py-4 bg-white`}>
        <ButtonContextProvider
          state={route.params.footerButtonState}
          onPressOut={() => {
            setIsQuit(true);
          }}
        >
          <PrimaryShortButton text="問題ホーム" />
        </ButtonContextProvider>
      </View>
    </>
  );
};

export default QuestionResultView;
