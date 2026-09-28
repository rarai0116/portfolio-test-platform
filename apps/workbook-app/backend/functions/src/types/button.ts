export const CheckButtonStates = {
  unchecked: 'Unchecked',
  checked: 'Checked',
  disabled: 'Disabled',
  disabledChecked: 'DisabledChecked',
} as const;

export type CheckButtonStateType =
  (typeof CheckButtonStates)[keyof typeof CheckButtonStates]; // 'Checked','Unchecked','Disabled'

export type ButtonInfo = {
  id: string;
  name: string;
  initialState: CheckButtonStateType;
  level?: string; // 階層
  value?: string | number; // ボタンの値
  parentName?: string;
};
export type ButtonInfoList = ButtonInfo[];
