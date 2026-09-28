import { Meta, StoryObj, StoryFn } from "@storybook/react";
import RadioButtonList from "../../components/parts/radioButtonList";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";

type T = typeof RadioButtonList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/RadioButtonList",
  component: RadioButtonList,
  args: {},
};
const buttonInfoList: ButtonInfoList = [
  { id: "0", name: "ラジオボタン１", initialState: CheckButtonStates.disabled },
  { id: "1", name: "ラジオボタン２", initialState: CheckButtonStates.checked },
  {
    id: "2",
    name: "ラジオボタン３",
    initialState: CheckButtonStates.unchecked,
  },
  { id: "3", name: "ラジオボタン４", initialState: CheckButtonStates.disabled },
  {
    id: "4",
    name: "ラジオボタン５",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "5",
    name: "ラジオボタン６",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "6",
    name: "ラジオボタン７",
    initialState: CheckButtonStates.disabledChecked,
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
      <RadioButtonList {...args} />
    </CheckButtonContextProvider>
  );
};

export const Basic = {
  render: Template,

  args: {
    title: "タイトルテキスト",
  },
};

export default meta;
