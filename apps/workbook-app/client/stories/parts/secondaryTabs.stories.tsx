import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SecondaryTabs from "../../components/parts/secondaryTabs";
import {
  CheckButtonContextProvider,
  useCheckedButtonList,
  CheckButtonStates,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";

type T = typeof SecondaryTabs;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/SecondaryTabs",
  component: SecondaryTabs,
  args: {},
};

const buttonInfoList: ButtonInfoList = [
  { id: "0", name: "タブ１", initialState: CheckButtonStates.unchecked },
  { id: "1", name: "タブ２", initialState: CheckButtonStates.checked },
  { id: "2", name: "タブ３", initialState: CheckButtonStates.unchecked },
  { id: "3", name: "タブ４", initialState: CheckButtonStates.unchecked },
  { id: "4", name: "タブ５", initialState: CheckButtonStates.unchecked },
];

const list = [
  () => {
    console.info("タブ1を押した");
  },
  () => {
    console.info("タブ2を押した");
  },
  () => {
    console.info("タブ3を押した");
  },
  () => {
    console.info("タブ4を押した");
  },
  () => {
    console.info("タブ5を押した");
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
      <SecondaryTabs {...args} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    onActivateFunctionList: list,
  },
};

export default meta;
