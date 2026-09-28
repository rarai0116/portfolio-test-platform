import {useCallback, useContext, useRef} from 'react';
import {ErrorReporfFormContext} from '../hooks/useErrorReporfFormContext';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';
import {TextInputContext} from '@/components/hooks/useTextInputContextProvider';
import {AuthContext} from '@/components/hooks/useAuthContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';
import BasicHalfModal from '@/components/parts/basicHalfModal';
import {errorReportFormModalStates} from '@/types/commonUnionType';
import {callWriteProblemReport} from '@/components/functionals/connectFunctions';
import {QuestionAndChoicesViewContext} from '@/components/hooks/useQuestionsAndChoicesViewContext';

export type ErrorReporfFormAskSubmitModalProps = Record<string, never>;

const ErrorReporfFormAskSubmitModal = (
  _props: ErrorReporfFormAskSubmitModalProps,
) => {
  const {showModal, hideModal} = useContext(ModalManagerContext);
  const {errorCheckedButtonInfoList} = useContext(ErrorReporfFormContext);
  const {textValue} = useContext(TextInputContext);
  const {loginUser} = useContext(AuthContext);
  const {setIsDisabledInput} = useContext(GlobalUserSettingContext);
  const isAsyncProcess = useRef<boolean>(false);
  const {currentTestDatalist, currentPlayNo} = useContext(
    QuestionAndChoicesViewContext,
  );

  const onPressOut = useCallback(
    async (context: string) => {
      try {
        isAsyncProcess.current = true;
        const uid = loginUser?.uid;
        if (!uid) throw new Error('uid is not found');
        const result = await callWriteProblemReport(
          uid,
          currentTestDatalist[currentPlayNo],
          errorCheckedButtonInfoList.map((item) => item.id),
          context,
          'test',
        );

        isAsyncProcess.current = false;
        return result;
      } catch (error: unknown) {
        console.error('onPressOut：処理失敗', error);
        isAsyncProcess.current = false;
        const error_ =
          error instanceof Error
            ? new Error('お問い合わせの送信に失敗しました', error)
            : new Error('お問い合わせの送信に失敗しました');
        throw error_;
      }
    },
    [
      currentPlayNo,
      currentTestDatalist,
      errorCheckedButtonInfoList,
      loginUser?.uid,
    ],
  );

  return (
    <BasicHalfModal
      isBackDropPressFreeze
      title="送信してよろしいですか？"
      text={textValue}
      id={errorReportFormModalStates.askSubmit}
      hasInput={false}
      primaryButtonText="送信"
      thirdlyButtonText="戻る"
      basicHalfModalInputId=""
      onPressOutPrimaryButton={() => {
        if (isAsyncProcess.current) return;
        setIsDisabledInput(true, async () => {
          return new Promise<void>((resolve) => {
            hideModal(() => {
              onPressOut(textValue ?? '').then(
                () => {
                  showModal(errorReportFormModalStates.submitCompleted);
                  setIsDisabledInput(false).catch((error: unknown) => {
                    console.error('setIsDisabledInput failed', error);
                  });
                  resolve();
                },
                (error: unknown) => {
                  console.error('送信失敗', error);
                  if (error instanceof Error) {
                    throw error;
                  }

                  throw new Error('お問い合わせの送信に失敗しました');
                },
              );
            });
          }).catch((error: unknown) => {
            console.error('送信失敗', error);
            showModal(errorReportFormModalStates.submitFailed);
            setIsDisabledInput(false).catch((error: unknown) => {
              console.error('setIsDisabledInput failed', error);
            });
            if (error instanceof Error) {
              throw error;
            }

            throw new Error('お問い合わせの送信に失敗しました');
          });
        }).catch((_error: unknown) => {
          showModal(errorReportFormModalStates.submitFailed);
          setIsDisabledInput(false).catch((error: unknown) => {
            console.error('setIsDisabledInput failed', error);
          });
        });
      }}
      onPressOutThirdlyButton={() => {
        if (isAsyncProcess.current) return;
        showModal(errorReportFormModalStates.viewModal);
      }}
    />
  );
};

export default ErrorReporfFormAskSubmitModal;
