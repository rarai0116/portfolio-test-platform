import { Meta, StoryObj, StoryFn } from "@storybook/react";
import BasicPicker from "../../components/parts/basicPicker";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import ModalManagerContextProvider from "../../components/hooks/useModalManagerContext";

type T = typeof BasicPicker;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/BasicPicker",
  component: BasicPicker,
  args: {},
};
const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "0",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "1",
    name: "1",
    initialState: CheckButtonStates.unchecked,
  },
];

const Template: Story = (args) => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <ModalManagerContextProvider>
      <CheckButtonContextProvider
        buttonInfoList={buttonInfoList}
        checkedButtonList={checkedButtonList}
        setCheckedButtonList={setCheckedButtonList}
      >
        <BasicPicker isEnabled idForIoS="test_bascpicker" />
      </CheckButtonContextProvider>
    </ModalManagerContextProvider>
  );
};

export const basic = {
  render: Template,
  args: {},
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;
