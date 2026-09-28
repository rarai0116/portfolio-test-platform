import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SecondaryTabPart from "../../components/parts/secondaryTabPart";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";
import { useCheckButtonState } from "../../components/hooks/useCheckButtonState";

type T = typeof SecondaryTabPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/SecondaryTabPart",
  component: SecondaryTabPart,
  args: {},
};

const buttonInfoList: ButtonInfoList = [
  { id: "0", name: "storiesで指定", initialState: CheckButtonStates.unchecked },
];

const Template: Story = () => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <SecondaryTabPart info={buttonInfoList[0]} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;
