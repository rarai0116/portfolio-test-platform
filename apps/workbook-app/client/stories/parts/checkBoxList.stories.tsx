import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CheckBoxList from "../../components/parts/checkBoxList";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";

type T = typeof CheckBoxList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/CheckBoxList",
  component: CheckBoxList,
  args: {},
};
const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "チェックボックス１",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "1",
    name: "チェックボックス２",
    initialState: CheckButtonStates.checked,
  },
  {
    id: "2",
    name: "チェックボックス３",
    initialState: CheckButtonStates.disabled,
  },
  {
    id: "3",
    name: "チェックボックス４",
    initialState: CheckButtonStates.disabledChecked,
  },
  {
    id: "4",
    name: "チェックボックス５",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "5",
    name: "チェックボックス６",
    initialState: CheckButtonStates.checked,
  },
  {
    id: "6",
    name: "チェックボックス７",
    initialState: CheckButtonStates.disabled,
  },
  {
    id: "7",
    name: "チェックボックス８",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "8",
    name: "チェックボックス９",
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: "9",
    name: "チェックボックス10",
    initialState: CheckButtonStates.unchecked,
  },
  /* {id: '10', name: 'チェックボックス11', initialState: CheckButtonStates.unchecked}, */
  /* {id: '11', name: 'チェックボックス12', initialState: CheckButtonStates.unchecked}, */
];

const Template: Story = (args) => {
  const saveIdData = new Set(["0", "2", "3"]);
  /*
	const resoreButtonInfolist = buttonInfoList.map((buttonInfo) => {
		if (saveIdData.has(buttonInfo.id)) {
			return {
				...buttonInfo,
				initialState: CheckButtonStates.disabledChecked,
			};
			// return { ...buttonInfo, initialState: CheckButtonStates.disabled };
		}
	});
	*/
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <CheckBoxList {...args} />
    </CheckButtonContextProvider>
  );
};

export const Basic = {
  render: Template,

  args: {
    title: "タイトルテキスト",
    row: 2,
  },
};

export default meta;
