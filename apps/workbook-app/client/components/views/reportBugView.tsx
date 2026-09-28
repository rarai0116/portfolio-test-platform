import {ScrollView} from 'react-native';
import {useMemo} from 'react';
import type {ButtonStateType} from '../hooks/useButtonContext';
import Background from '../parts/background';
import PrimaryShortButtonFooter from '../organisms/primaryShortButtonFooter';
import ReportBug from '../organisms/reportBug';
import type {ButtonInfo, ButtonInfoList} from '../hooks/useCheckButtonContext';
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from '../hooks/useCheckButtonContext';
import type {QuestionDataType} from '../../types/commonUnionType';
import {questionData} from '../../types/commonUnionType';

export type ReportBugViewProps = {readonly footerButtonState: ButtonStateType};

const ReportBugView = (props: ReportBugViewProps) => {
  const questionDataList: Array<{
    dataType: QuestionDataType;
    sentence: string | null | undefined;
  }> = useMemo(() => {
    return [
      {
        dataType: questionData.answer,
        sentence: null,
      },
      {
        dataType: questionData.img,
        sentence: null,
      },
      {
        dataType: questionData.questionSentence,
        sentence:
          '住宅の動線計画に関する次の記述のうち、<strong>最も不適当な</strong>ものはどれか。この問題はダミーです。',
      },
      {
        dataType: questionData.choiceOneSentence,
        sentence:
          '家事動線は、台所、洗面・脱衣室、物干し場などの関係を考慮し、移動距離が過度に長くならないように計画する。',
      },
      {
        dataType: questionData.choiceTwoSentence,
        sentence:
          '来客動線は、家族の私的空間を通過しなくても応接できるよう、玄関、客間、便所などの関係に配慮する。',
      },
      {
        dataType: questionData.choiceThreeSentence,
        sentence:
          '高齢者が居住する住宅では、寝室から便所までの動線を短くし、夜間の移動にも配慮することが望ましい。',
      },
      {
        dataType: questionData.choiceFourSentence,
        sentence:
          '住宅内の動線は、居室相互のつながりを強めるため、家族動線、家事動線、来客動線をできるだけ同一経路に集中させる。',
      },
      {
        dataType: questionData.generalExplanationSentence,
        sentence: null,
      },
      {
        dataType: questionData.explanationOneSentence,
        sentence:
          '<p>適当である。台所、洗面・脱衣室、洗濯機置場、物干し場などは使用頻度が高く、<u>家事動線を整理する</u>ことが重要である。</p>',
      },
      {
        dataType: questionData.explanationTwoSentence,
        sentence:
          '適当である。来客が私的空間を通らずに応接できると、プライバシーを確保しやすい。',
      },
      {
        dataType: questionData.explanationThreeSentence,
        sentence:
          '適当である。高齢者の居住では、寝室と便所の距離、段差、照明、手すりの設置などに配慮することが望ましい。',
      },
      {
        dataType: questionData.explanationFourSentence,
        sentence:
          '最も不適当である。動線をすべて同一経路に集中させると、生活上の干渉や混雑が生じやすい。家族動線、家事動線、来客動線は必要に応じて分離し、生活のしやすさとプライバシーを両立させる。',
      },
      {
        dataType: questionData.other,
        sentence: null,
      },
    ];
  }, []);

  const buttonInfoList: ButtonInfoList = useMemo(() => {
    return questionDataList.map((_v, i) => {
      let name: string;
      switch (questionDataList[i].dataType) {
        case questionData.answer: {
          name = '解答が間違っている';
          break;
        }

        case questionData.img: {
          name = '間違った画像が挿入されている';
          break;
        }

        case questionData.other: {
          name = 'その他・補足欄';
          break;
        }

        default: {
          name = `${questionDataList[i].dataType}に誤字・脱字がある`;
          break;
        }
      }

      const buttonInfo: ButtonInfo = {
        id: `${i}`,
        name: `${name}`,
        initialState: CheckButtonStates.unchecked,
      };
      return buttonInfo;
    });
  }, [questionDataList]);
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <>
      <ScrollView>
        <Background>
          {/*
					<GlobalSaveDataContextProvider
						isAnswering={false}
						grade={questionGrade.gradeTwo}
						subject={questionSubject['学科Ⅰ']}
						year="H28"
						pastExamQuestionNumber="08"
					> */}
          <CheckButtonContextProvider
            buttonInfoList={buttonInfoList}
            checkedButtonList={checkedButtonList}
            setCheckedButtonList={setCheckedButtonList}
          >
            <ReportBug questionNumber="5" questionDataList={questionDataList} />
          </CheckButtonContextProvider>
          {/* </GlobalSaveDataContextProvider> */}
        </Background>
      </ScrollView>
      <PrimaryShortButtonFooter
        buttonState={props.footerButtonState}
        buttonText="報告"
        onPressOut={() => {}}
      />
    </>
  );
};

export default ReportBugView;
