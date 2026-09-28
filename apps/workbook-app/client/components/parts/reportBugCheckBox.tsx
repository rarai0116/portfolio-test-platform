import {View} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import CheckBox from '../identities/checkBox';
import AppTextInput from '../identities/appTextInput';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import Spacer from './spacer';

export type ReportBugCheckBoxProps = {
  readonly buttonInfo: ButtonInfo;
  readonly sentence?: string | null | undefined;
  readonly number?: string | null;
  readonly hasTextInput?: boolean;
  readonly sentenceStyle: string;
};

const ReportBugCheckBox = (props: ReportBugCheckBoxProps) => {
  return (
    <View>
      <CheckBox info={props.buttonInfo} checkBoxStyle="flex-1 ml-4" />
      <View style={tw`items-center`}>
        {props.sentence ? (
          <>
            <Spacer isHorizontal={false} size={4} />
            <View
              style={tw`${props.sentenceStyle} w-11/12 rounded bg-white px-4 py-4`}
            >
              <AppText style={tw`text-primary text-sm`}>{props.number}</AppText>
              <AppText style={tw`w-11/12 text-primary text-sm`}>
                {props.sentence}
              </AppText>
            </View>
          </>
        ) : null}

        {props.hasTextInput ? (
          <View style={tw`w-11/12`}>
            <AppTextInput
              isShowWordCount
              hasMultiline
              id="reportBugInput"
              maxLength={400}
              height={100}
              inputStyle="bg-white w-full py-1 px-2 border border-tertiary rounded"
              placeholder="こちらに報告内容を入力してください"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default ReportBugCheckBox;
