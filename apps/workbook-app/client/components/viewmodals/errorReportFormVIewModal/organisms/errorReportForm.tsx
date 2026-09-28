import {View} from 'react-native';
import {useContext} from 'react';
import {ScrollView} from 'react-native-gesture-handler';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import Spacer from '../../../parts/spacer';
import AppTextInput from '../../../identities/appTextInput';
import {TextInputContext} from '../../../hooks/useTextInputContextProvider';
import {CheckButtonContextProvider} from '../../../hooks/useCheckButtonContext';
import CheckBox from '../../../identities/checkBox';
import {ErrorReporfFormContext} from '../hooks/useErrorReporfFormContext';

export type ErrorReportFormProps = Record<string, never>;

const ErrorReportForm = (_props: ErrorReportFormProps) => {
  const {textValue} = useContext(TextInputContext);
  const {
    errorParts,
    errorButtonInfoList,
    errorCheckedButtonInfoList,
    setErrorCheckedButtonInfoList,
  } = useContext(ErrorReporfFormContext);

  return (
    <ScrollView style={tw`w-full `} contentContainerStyle={tw`items-center`}>
      <View style={tw`items-center w-11/12 text-center`}>
        <AppText style={tw`text-primary text-base`}>不備の報告</AppText>
      </View>

      <Spacer isHorizontal={false} size={16} />

      <View style={tw`w-10/12`}>
        <CheckButtonContextProvider
          buttonInfoList={errorButtonInfoList}
          checkedButtonList={errorCheckedButtonInfoList}
          setCheckedButtonList={setErrorCheckedButtonInfoList}
        >
          {errorButtonInfoList.map((buttonInfo) => {
            return (
              <View key={`${buttonInfo.id}`}>
                {(() => {
                  if (buttonInfo.id.includes('error_display')) {
                    const title =
                      errorParts[buttonInfo.id.replace('error_display_', '')];
                    return (
                      <>
                        <Spacer isHorizontal={false} size={12} />
                        <AppText style={tw`text-primary`}>{title}</AppText>
                        <Spacer isHorizontal={false} size={4} />
                      </>
                    );
                  }

                  return null;
                })()}
                <CheckBox
                  info={buttonInfo}
                  id={buttonInfo.id}
                  name={buttonInfo.name}
                  checkBoxStyle="flex-1"
                />
                <Spacer isHorizontal={false} size={12} />
              </View>
            );
          })}
          <Spacer isHorizontal={false} size={8} />
        </CheckButtonContextProvider>
      </View>

      <View style={tw`w-10/12`}>
        <Spacer isHorizontal={false} size={12} />
        <AppText style={tw`text-primary`}>その他・補足欄</AppText>
        <Spacer isHorizontal={false} size={4} />
        <AppTextInput
          isFixHeight
          isShowWordCount
          hasMultiline
          id="inquiryFormModalInput"
          defaultValue={textValue}
          inputStyle="bg-background py-3 px-3 border border-quaternary rounded"
          height={160}
          maxLength={800}
        />
      </View>
    </ScrollView>
  );
};

export default ErrorReportForm;
