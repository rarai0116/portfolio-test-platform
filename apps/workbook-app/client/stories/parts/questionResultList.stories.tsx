import {summarizeConsoleValue} from '../../components/functionals/consoleLevels';
import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionResultList from "../../components/parts/questionResultList";
import type {
  ButtonInfoList,
  ButtonInfo,
} from "../../components/hooks/useCheckButtonContext";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import { resultState } from "../../components/parts/questionResultPart";

type T = typeof QuestionResultList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/QuestionResultList",
  component: QuestionResultList,
  args: {},
};

const isCorrectList = [
  {
    questionNumber: "1",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[0].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "2",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[1].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "3",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[2].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "4",
    result: resultState.wrong,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[3].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "5",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[4].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "6",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[5].questionNumber}の解説ページへ`);
    },
  },
  {
    questionNumber: "7",
    result: resultState.correct,
    onPressOutExplanationButton() {
      console.info(`no.${isCorrectList[66].questionNumber}の解説ページへ`);
    },
  },
];

const isCorrectListArray = Object.values(isCorrectList); // 配列に変換
console.info("questionResultList.stories：処理情報", summarizeConsoleValue(isCorrectListArray));

const buttonInfoList: ButtonInfoList = /* useMemo(() => {
	return */ isCorrectList.map((v, i) => {
  const checkBoxState =
    isCorrectList[i].result === resultState.correct
      ? CheckButtonStates.unchecked
      : CheckButtonStates.checked;
  const buttonInfo: ButtonInfo = {
    id: `${i}`,
    name: `No.${i + 1}`,
    initialState: checkBoxState,
  };
  return buttonInfo;
});
/* }, [isCorrectList]); */
console.info("questionResultList.stories：処理情報", summarizeConsoleValue(buttonInfoList));

const Template: Story = (args) => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <QuestionResultList {...args} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    data: isCorrectList,
  },
};

// 書き方
/* <CheckButtonContextProvider buttonInfoList={buttonInfoList}>
		<QuestionResultList {...isCorrectList} />
	</CheckButtonContextProvider> */

export default meta;
