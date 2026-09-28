import {View} from 'react-native';
import {useContext} from 'react';
import {ScrollView} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from '../parts/spacer';
import AppTextInput from '../identities/appTextInput';
import {TextInputContext} from '../hooks/useTextInputContextProvider';

export type InquiryFormModalProps = {
  readonly onFocus?: () => void;
};

const InquiryFormModal = (props: InquiryFormModalProps) => {
  const {textValue} = useContext(TextInputContext);
  return (
    <ScrollView style={tw`w-full`} contentContainerStyle={tw`items-center`}>
      <View style={tw`items-center w-11/12 text-center`}>
        <AppText style={tw`text-primary text-base`}>
          アプリに関するご意見・ご要望や不備の報告
        </AppText>
        <Spacer isHorizontal={false} size={8} />
        <View style={tw`w-11/12`}>
          <AppText style={tw`text-primary text-sm text-left`}>
            ※頂いたご意見・ご要望へはお返事できないことを予めご了承ください
          </AppText>
        </View>
      </View>
      <Spacer isHorizontal={false} size={16} />
      <View style={tw`w-10/12 `}>
        <AppTextInput
          isFixHeight
          isShowWordCount
          hasMultiline
          id="inQuiryFormModalInput"
          defaultValue={textValue}
          inputStyle="bg-background py-3 px-3 border border-quaternary rounded"
          height={160}
          placeholder="お問い合わせ内容を入力してください"
          maxLength={800}
          onFocus={() => {
            if (props.onFocus) props.onFocus();
          }}
        />
      </View>
    </ScrollView>
  );
};

export default InquiryFormModal;
