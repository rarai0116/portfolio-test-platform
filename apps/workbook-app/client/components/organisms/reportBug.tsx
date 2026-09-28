import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import ReportBugCheckBox from '../parts/reportBugCheckBox';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import type {QuestionDataType} from '../../types/commonUnionType';
import {questionData} from '../../types/commonUnionType';
import Spacer from '../parts/spacer';
import QuestionDataPart from '../parts/questionDataPart';
import Background from '../parts/background';

export type ReportBugProps = {
  readonly questionNumber: string;
  readonly questionDataList: Array<{
    dataType: QuestionDataType;
    sentence: string | null | undefined;
  }>;
};

const ReportBug = (props: ReportBugProps) => {
  const questionDataList = props.questionDataList;

  const {buttonInfoList} = useContext(CheckButtonContext);
  // console.log(checkedButtonList);

  const checkBoxList = useMemo(() => {
    return buttonInfoList.map((_v, i) => {
      const sentenceStyle =
        questionDataList[i].dataType === questionData.questionSentence
          ? ''
          : 'flex-row';
      const hasTextInput = questionDataList[i].dataType === questionData.other;
      const key = `key_${[i]}`;
      let number = '';
      switch (questionDataList[i].dataType) {
        case questionData.answer:
        case questionData.img:
        case questionData.other: {
          break;
        }

        case questionData.questionSentence: {
          number = `No．${props.questionNumber}`;
          break;
        }

        default: {
          number = `${questionDataList[i].dataType.slice(-1)}．`;
          break;
        }
      }

      return (
        <View key={key}>
          <ReportBugCheckBox
            buttonInfo={buttonInfoList[i]}
            sentence={questionDataList[i].sentence ?? null}
            number={number}
            sentenceStyle={sentenceStyle}
            hasTextInput={hasTextInput}
          />
          <Spacer isHorizontal={false} size={16} />
        </View>
      );
    });
  }, [buttonInfoList, questionDataList, props.questionNumber]);

  return (
    <>
      <Background>
        <QuestionDataPart />
        <Spacer isHorizontal={false} size={16} />
        {/* <View style={tw`pl-4`}> */}
        {checkBoxList}
        {/* </View> */}
        <Spacer isHorizontal={false} size={72} />
      </Background>
      {/* <Footer>
				<ButtonContextProvider state={ButtonStates.released}>
					<PrimaryShortButton text="報告" />
				</ButtonContextProvider>
			</Footer> */}
    </>
  );
};

export default ReportBug;
