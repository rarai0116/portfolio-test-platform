export type CalenderYmData = {
  year: number;
  month: number;
};

export const calendarTheme = {
  basic: 'basic',
  taskSetting: 'taskSetting',
};
export type CalendarThemeType =
  (typeof calendarTheme)[keyof typeof calendarTheme];

export type CalendarYmdPeriod = {
  start: string | undefined;
  end: string | undefined;
};

export type CalendarDatePeriod = {
  start: Date | undefined;
  end: Date | undefined;
};

export type DayTextStyle = {
  weekday: string;
  saturday: string;
  sunday: string;
};

export type CalendarTextStyle = {
  text: DayTextStyle;
  pressedText: DayTextStyle;
  otherMonthText: DayTextStyle;
  todayText: string;
};

export type CellStyle = {
  touchableHighlight?: string;
  cellView?: string;
};

export type CellState = {
  basic: CellStyle;
  pressed?: CellStyle;
  pressedStart?: CellStyle;
  pressedEnd?: CellStyle;
  pressedBetween?: CellStyle;
};
