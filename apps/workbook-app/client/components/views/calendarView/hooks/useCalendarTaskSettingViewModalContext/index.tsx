import {createContext, useMemo} from 'react';
import type {ReactNode} from 'react';
import useSaveTaskSetting, {type SaveTaskSetting} from './useSaveTaskSetting';
import useSettingHandlers, {type SettingHandlers} from './useSettingHandlers';

type CalendarTaskSettingViewModalContextObject = {} & SaveTaskSetting &
  SettingHandlers;

type Props = {
  readonly children: ReactNode;
};

export const CalendarTaskSettingViewModalContext =
  createContext<CalendarTaskSettingViewModalContextObject>(
    {} as CalendarTaskSettingViewModalContextObject,
  );

export const CalendarTaskSettingViewModalContextProvider = (props: Props) => {
  const saveTaskSettings = useSaveTaskSetting();

  const {
    initialTaskSetting,
    temporaryTaskSetting,
    setTemporaryTaskSetting,
    setTemporaryPracticeQuestionSetting,
    setTemporaryExamQuestionSetting,
    currentTaskSettingCardId,
    calendarTaskSettingMode,
    saveTaskSettingRef,
    saveTaskSetting,
    autoSaveTaskSetting,
    isDefaultTitle,
    setIsDefaultTitle,
    setCalendarTaskSettingMode,
    setCurrentTaskSettingCardId,
  } = saveTaskSettings;

  const settingHandlers = useSettingHandlers({
    initialTaskSetting,
    temporaryTaskSetting,
    setTemporaryTaskSetting,
    setTemporaryPracticeQuestionSetting,
    setTemporaryExamQuestionSetting,
    currentTaskSettingCardId,
    calendarTaskSettingMode,
    saveTaskSettingRef,
    saveTaskSetting,
    autoSaveTaskSetting,
    isDefaultTitle,
    setIsDefaultTitle,
    setCalendarTaskSettingMode,
    setCurrentTaskSettingCardId,
  });

  const value = useMemo(() => {
    return {
      ...saveTaskSettings,
      ...settingHandlers,
    };
  }, [saveTaskSettings, settingHandlers]);

  return (
    <CalendarTaskSettingViewModalContext.Provider value={value}>
      {props.children}
    </CalendarTaskSettingViewModalContext.Provider>
  );
};
