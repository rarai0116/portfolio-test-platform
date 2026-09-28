import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ReportBugCheckBox from "../../components/parts/reportBugCheckBox";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";

type T = typeof ReportBugCheckBox;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ReportBugCheckBox",
  component: ReportBugCheckBox,
  args: {},
};

const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "問題文に誤字脱字",
    initialState: CheckButtonStates.unchecked,
  },
];

const Template: Story = (args) => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <ReportBugCheckBox {...args} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    buttonInfo: buttonInfoList[0],
    hasTextInput: true,
    /* sentence:
          '住宅の動線計画に関する次の記述のうち、最も不適当なものはどれか。この問題はダミーです。',
      sentenceStyle: '', */
  },
};

export default meta;
