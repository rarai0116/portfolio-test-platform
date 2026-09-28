import {useCallback, useContext, useRef} from 'react';
import BasicHalfModal from '../parts/basicHalfModal';
import {inquiryFormModalStates} from '../../types/commonUnionType';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import {callWriteContact} from '../functionals/connectFunctions';
import {AuthContext} from '../hooks/useAuthContext';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';

export type InquiryFormAskSubmitModalProps = Record<string, never>;

const InquiryFormAskSubmitModal = (_props: InquiryFormAskSubmitModalProps) => {
  const {showModal} = useContext(ModalManagerContext);
  const {textValue} = useContext(TextInputContext);
  const {loginUser} = useContext(AuthContext);
  const {setIsDisabledInput} = useContext(GlobalUserSettingContext);
  const isAsyncProcess = useRef<boolean>(false);

  const onPressOut = useCallback(
    async (context: string) => {
      try {
        isAsyncProcess.current = true;
        const uid = loginUser?.uid;
        if (!uid) throw new Error('uid is not found');
        const _result = await callWriteContact(uid, context);

        isAsyncProcess.current = false;
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
    [loginUser],
  );

  /* useEffect(() => {
		console.log('送信内容', textValue);
	}, [textValue]); */

  return (
    <BasicHalfModal
      isBackDropPressFreeze
      title="以下の内容で送信しますか？"
      text={textValue}
      id={inquiryFormModalStates.askSubmit}
      hasInput={false}
      primaryButtonText="送信"
      thirdlyButtonText="戻る"
      basicHalfModalInputId=""
      onPressOutPrimaryButton={() => {
        if (isAsyncProcess.current) return;
        setIsDisabledInput(true, async () => {
          return new Promise<void>((resolve) => {
            onPressOut(textValue ?? '').then(
              () => {
                showModal(inquiryFormModalStates.submitCompleted);
                setIsDisabledInput(false);
                resolve();
              },
              (error) => {
                console.error('送信失敗', error);
                showModal(inquiryFormModalStates.submitFailed);
                setIsDisabledInput(false);
                resolve();
              },
            );
          });
        });
      }}
      onPressOutThirdlyButton={() => {
        if (isAsyncProcess.current) return;
        showModal(inquiryFormModalStates.inquiryFormViewModal);
      }}
    />
  );
};

export default InquiryFormAskSubmitModal;
