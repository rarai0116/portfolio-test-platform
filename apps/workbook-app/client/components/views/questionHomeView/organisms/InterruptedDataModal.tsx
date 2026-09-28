import {summarizeConsoleValue} from '../../../functionals/consoleLevels';
import {useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  questionHomeViewModalStates,
  questionSettingModalStates,
} from '../../../../types/commonUnionType';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';
import BasicHalfModal from '../../../parts/basicHalfModal';
import {displaySettingCardList} from '../../../parts/displaySettingCardList';
import {
  pressMode,
  QuestionHomeViewContext,
} from '../hooks/useQuestionHomeViewContext';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import {GlobalUserSettingContext} from '../../../hooks/useGlobalUserSettingContext';
import {GlobalSaveDataContext} from '../../../hooks/useGlobalSaveDataContext';
import {QuestionAndChoicesViewContext} from '../../../hooks/useQuestionsAndChoicesViewContext';
import {deleteTestData} from '../../../functionals/firestoreController';
import {
  allScreenIdList,
  type RootViewsProps,
} from '../../../../types/viewParameter';

export type InterruptedDataModalProps = Record<string, never>;

const InterruptedDataModal = (_props: InterruptedDataModalProps) => {
  const navigation = useNavigation<RootViewsProps<'Tab'>['navigation']>();
  const {showModal, hideModal} = useContext(ModalManagerContext);
  const {setCurrentSettingId, initializeQuestionInfo} = useContext(
    QuestionSettingViewContext,
  );
  const {setCurrentPlayData, readyForTest, setIsDisabledInput, isLoading} =
    useContext(GlobalUserSettingContext);
  const {initializePlayData} = useContext(QuestionAndChoicesViewContext);
  const {
    answerlingTestSettingData,
    setAnswerlingTestSettingData,
    previousSavedSetting,
  } = useContext(GlobalSaveDataContext);
  const {onPressOutMode, setOnPressOutMode} = useContext(
    QuestionHomeViewContext,
  );

  return (
    <BasicHalfModal
      isBackDropPressFreeze
      id={questionHomeViewModalStates.InterruptedData}
      hasInput={false}
      title="中断データがあります"
      text="※中断データを再開するか削除するまで、課題以外の問題をあらたに始めることはできません"
      primaryButtonText="再開"
      secondaryButtonText="データを破棄"
      thirdlyButtonText="キャンセル"
      onPressOutPrimaryButton={() => {
        if (answerlingTestSettingData === null) return;
        if (isLoading) return;
        console.log('再開');
        readyForTest.initialize();
        setIsDisabledInput(true, async () => {
          try {
            await initializePlayData(answerlingTestSettingData);
            hideModal(() => {
              readyForTest.setIsUser(true);
            });
          } catch (error: unknown) {
            console.error('InterruptedDataModal：復元失敗', error);
            readyForTest.initialize();
            await setIsDisabledInput(false);
            showModal(questionSettingModalStates.QuestionStartFailed);
          }
        }).catch((error: unknown) => {
          console.error('InterruptedDataModal：処理失敗', error);
          readyForTest.initialize();
          setIsDisabledInput(false).catch((error: unknown) => {
            console.error('InterruptedDataModal：処理失敗', error);
          });
          showModal(questionSettingModalStates.QuestionStartFailed);
        });
      }}
      onPressOutSecondaryButton={() => {
        if (answerlingTestSettingData === null) return;
        console.log(
          'データを破棄',
          summarizeConsoleValue(answerlingTestSettingData?.testId),
        );
        setIsDisabledInput(true, async () => {
          return new Promise<void>((resolve) => {
            setCurrentPlayData(null);
            deleteTestData(answerlingTestSettingData?.testId)
              .then((result) => {
                console.log(
                  'データを破棄しました',
                  summarizeConsoleValue(result),
                );
              })
              .catch((error: unknown) => {
                console.error('InterruptedDataModal：処理失敗', error);
              });
            setAnswerlingTestSettingData(null)
              .then(() => {
                if (onPressOutMode !== undefined) {
                  switch (onPressOutMode) {
                    case pressMode.practice: {
                      setCurrentSettingId('initialSetting-practice-0');
                      initializeQuestionInfo();
                      showModal(questionSettingModalStates.viewModal);
                      setOnPressOutMode(undefined);
                      break;
                    }

                    case pressMode.exam: {
                      setCurrentSettingId('initialSetting-exam-0');
                      showModal(questionSettingModalStates.viewModal);
                      break;
                    }

                    case pressMode.saved: {
                      hideModal();
                      navigation.navigate('Tab', {
                        userId: allScreenIdList.Tab,
                        screen: 'QuestionTab',
                        params: {
                          userId: allScreenIdList.QuestionTab,
                          screen: 'SavedSetting',
                          params: {
                            userId: allScreenIdList.SavedSetting,
                          },
                        },
                      });
                      setIsDisabledInput(false).catch((error: unknown) => {
                        console.error('InterruptedDataModal：処理失敗', error);
                      });
                      break;
                    }

                    case pressMode.previous: {
                      setCurrentSettingId(previousSavedSetting!.id);
                      showModal(questionSettingModalStates.viewModal);
                      break;
                    }
                    // No default
                  }

                  setOnPressOutMode(undefined);
                }
              })
              .catch((error: unknown) => {
                console.error('InterruptedDataModal：処理失敗', error);
              });
            resolve();
          });
        }).catch((error: unknown) => {
          console.error('InterruptedDataModal：処理失敗', error);
          setIsDisabledInput(false).catch((error: unknown) => {
            console.error('InterruptedDataModal：処理失敗', error);
          });
        });
      }}
      onPressOutThirdlyButton={() => {
        setOnPressOutMode(undefined);
        hideModal();
      }}
    >
      {answerlingTestSettingData !== null &&
        displaySettingCardList(
          [answerlingTestSettingData.settingCardData.id],
          'interrupted',
          true,
          () => {},
        )}
    </BasicHalfModal>
  );
};

export default InterruptedDataModal;
