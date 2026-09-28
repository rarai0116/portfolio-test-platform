import {View, ScrollView} from 'react-native';
import {useState, useContext, useMemo, useEffect} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  allScreenIdList,
  type MyPageViewsProps,
} from '../../../types/viewParameter';
import tw from '../../../tailwind.custom';
import AppText from '../../identities/appText';
import Background from '../../parts/background';
import Spacer from '../../parts/spacer';
import AppTextInput from '../../identities/appTextInput';
import PrimaryShortButtonFooter from '../../organisms/primaryShortButtonFooter';
import type {ButtonStateType} from '../../hooks/useButtonContext';
import {ButtonStates} from '../../hooks/useButtonContext';
import BasicHalfModal from '../../parts/basicHalfModal';
import ModalManagerContextProvider, {
  ModalManagerContext,
} from '../../hooks/useModalManagerContext';
import {TextInputContextProvider} from '../../hooks/useTextInputContextProvider';

export type MyPageInquiryFormViewProps = Record<string, never>;

const modalStates = {
  askSubmit: 'askSubmit',
  submitCompleted: 'submitCompleted',
  submitFailed: 'submitFailed',
};

const InnerView = (_props: MyPageInquiryFormViewProps) => {
  const navigation =
    useNavigation<MyPageViewsProps<'MyPageInquiryForm'>['navigation']>();

  const {showModal, hideModal} = useContext(ModalManagerContext);

  const [footerButtonState, setFooterButtonState] = useState<ButtonStateType>(
    ButtonStates.disabled,
  );

  useEffect(() => {
    // もし入力されたらFooterButtonStateをtrueに
    setFooterButtonState(ButtonStates.released);
  }, []);

  const askSubmitModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="送信しますか？"
        id={modalStates.askSubmit}
        hasInput={false}
        primaryButtonText="送信"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          showModal(modalStates.submitCompleted);
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [showModal, hideModal]);

  const submitCompletedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="ご意見・ご報告ありがとうございました"
        id={modalStates.submitCompleted}
        hasInput={false}
        thirdlyButtonText="OK"
        backDropPress={() => {
          navigation.navigate('MyPageHome', {
            userId: allScreenIdList.MyPageHome,
          });
        }}
        onPressOutThirdlyButton={() => {
          hideModal(() => {
            navigation.navigate('MyPageHome', {
              userId: allScreenIdList.MyPageHome,
            });
          });
        }}
      />
    );
  }, [navigation, hideModal]);

  const submitFailedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="送信に失敗しました"
        id={modalStates.submitFailed}
        hasInput={false}
        primaryButtonText="再送信"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          showModal(modalStates.submitCompleted);
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [showModal, hideModal]);

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Background>
          {askSubmitModal}
          {submitCompletedModal}
          {submitFailedModal}
          <View style={tw`items-center`}>
            <Spacer isHorizontal={false} size={48} />
            <View style={tw`items-center w-10/12 text-center`}>
              <AppText style={tw`text-primary text-base`}>
                アプリに関するご意見・ご要望や不備の報告
              </AppText>
              <Spacer isHorizontal={false} size={12} />
              <AppText style={tw`text-primary text-sm w-10/12`}>
                ※頂いたご意見・ご要望へはお返事できないことを予めご了承ください
              </AppText>
              <Spacer isHorizontal={false} size={24} />
            </View>
            <View style={tw`w-10/12`}>
              <AppTextInput
                isShowWordCount
                hasMultiline
                id="myPageInquiryFormInput"
                inputStyle="w-full bg-white py-3 px-3 border border-quaternary rounded"
                height={160}
                placeholder="お問い合わせ内容を入力してください"
                focusStyle="border-workbookblue-500"
                // focusStyle={{outlineColor: '#289DF4'}}
                maxLength={10}
              />
            </View>
          </View>
        </Background>
      </ScrollView>
      <PrimaryShortButtonFooter
        buttonState={footerButtonState}
        buttonText="送信"
        onPressOut={() => {
          showModal(modalStates.askSubmit);
        }}
      />
    </>
  );
};

const MyPageInquiryFormView = () => {
  const _route = useRoute<MyPageViewsProps<'MyPageInquiryForm'>['route']>();

  return (
    <TextInputContextProvider>
      <ModalManagerContextProvider>
        <InnerView />
      </ModalManagerContextProvider>
    </TextInputContextProvider>
  );
};

export default MyPageInquiryFormView;
