import {summarizeConsoleValue} from '../../../functionals/consoleLevels';
import {useCallback, useContext, useMemo} from 'react';
import {dataAnalysisModalStates} from '../../../../types/commonUnionType';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';
import BasicHalfModal from '../../../parts/basicHalfModal';
import {displaySettingCardList} from '../../../parts/displaySettingCardList';
import {GlobalUserSettingContext} from '../../../hooks/useGlobalUserSettingContext';
import {GlobalSaveDataContext} from '../../../hooks/useGlobalSaveDataContext';
import {deleteTestData} from '../../../functionals/firestoreController';
import {QuestionAndChoicesViewContext} from '../../../hooks/useQuestionsAndChoicesViewContext';
import {questionSettingModalStates} from '../../../../types/commonUnionType';

export type InterruptedDataModalProps = {readonly id: string};

/** データ分析View用中断データモーダル */
const InterruptedDataModal = (props: InterruptedDataModalProps) => {
  const {showModal, hideModal} = useContext(ModalManagerContext);
  const {setCurrentPlayData, readyForTest, setIsDisabledInput, isLoading} =
    useContext(GlobalUserSettingContext);
  const {initializePlayData} = useContext(QuestionAndChoicesViewContext);
  const {answerlingTestSettingData, setAnswerlingTestSettingData} = useContext(
    GlobalSaveDataContext,
  );

  const onPressOutPrimaryButton = useCallback(() => {
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
      setIsDisabledInput(false).catch((unlockError: unknown) => {
        console.error('InterruptedDataModal：入力ロック解除失敗', unlockError);
      });
      showModal(questionSettingModalStates.QuestionStartFailed);
    });
  }, [
    answerlingTestSettingData,
    initializePlayData,
    readyForTest,
    setIsDisabledInput,
    hideModal,
    showModal,
    isLoading,
  ]);
  const onPressOutSecondaryButton = useCallback(() => {
    if (answerlingTestSettingData === null) return;
    console.log(
      'データを破棄',
      summarizeConsoleValue(answerlingTestSettingData?.testId),
    );
    setCurrentPlayData(null);
    hideModal();
    deleteTestData(answerlingTestSettingData?.testId)
      .then((result) => {
        console.log('データを破棄しました', summarizeConsoleValue(result));
      })
      .catch((error: unknown) => {
        console.error('onPressOutSecondaryButton：処理失敗', error);
      });
    setAnswerlingTestSettingData(null)
      .then(() => {
        showModal(dataAnalysisModalStates.viewModal);
      })
      .catch((error: unknown) => {
        console.error('onPressOutSecondaryButton：処理失敗', error);
      });
  }, [
    answerlingTestSettingData,
    setCurrentPlayData,
    hideModal,
    setAnswerlingTestSettingData,
    showModal,
  ]);
  const cardList = useMemo(() => {
    return (
      answerlingTestSettingData !== null &&
      displaySettingCardList(
        [answerlingTestSettingData.settingCardData.id],
        'interrupted',
        true,
        () => {},
      )
    );
  }, [answerlingTestSettingData]);

  return (
    <BasicHalfModal
      isBackDropPressFreeze
      id={props.id}
      hasInput={false}
      title="中断データがあります"
      text="※中断データを再開するか削除するまで、課題以外の問題をあらたに始めることはできません"
      primaryButtonText="中断データを再開する"
      secondaryButtonText="データを破棄して新しく始める"
      thirdlyButtonText="キャンセル"
      onPressOutPrimaryButton={onPressOutPrimaryButton}
      onPressOutSecondaryButton={onPressOutSecondaryButton}
      onPressOutThirdlyButton={() => {
        hideModal();
      }}
    >
      {cardList}
    </BasicHalfModal>
  );
};

export default InterruptedDataModal;
