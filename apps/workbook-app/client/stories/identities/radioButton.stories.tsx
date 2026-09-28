import { Meta, StoryObj, StoryFn } from "@storybook/react";
import RadioButton from "../../components/identities/radioButton";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";

type T = typeof RadioButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Identities/RadioButton",
  component: RadioButton,
  argTypes: {
    /* state: {
			options: [
				CheckButtonStates.unchecked,
				CheckButtonStates.checked,
				CheckButtonStates.disabled,
			],
			control: {type: 'radio'},
		}, */
  },
};

const buttonInfoList: ButtonInfoList = [
  { id: "0", name: "storiesで指定", initialState: CheckButtonStates.disabled },
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
      <RadioButton radioButtonStyle="flex-1 ml-4" info={buttonInfoList[0]} />
    </CheckButtonContextProvider>
  );
};

export const Basic = {
  render: Template,
  args: {},
};

export default meta;
