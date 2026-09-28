import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CheckBox from "../../components/identities/checkBox";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";

const Template: StoryFn = (args) => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <CheckBox checkBoxStyle="flex-1 ml-4" info={buttonInfoList[0]} />
    </CheckButtonContextProvider>
  );
};
const meta = {
  title: "Identities/CheckBox",
  component: CheckBox,
  decorators: [Template],
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
} satisfies Meta<typeof CheckBox>;

const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "storiesで指定aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    initialState: CheckButtonStates.unchecked,
  },
];

export const Basic = {
  render: Template,
  args: {},
};

export default meta;
