import {createContext, useMemo} from 'react';
import type {ReactNode} from 'react';
import type {QuestionSettingStateType} from '../../types/commonUnionType';

type QuestionCategoryAccordionViewContextObject = {
  id: string;
  settingState: QuestionSettingStateType;
};

type Props = {
  readonly children: ReactNode;
  readonly id: string;
  readonly settingState: QuestionSettingStateType;
};

export const QuestionCategoryAccordionViewContext =
  createContext<QuestionCategoryAccordionViewContextObject>(
    {} as QuestionCategoryAccordionViewContextObject,
  );

export const QuestionCategoryAccordionViewContextProvider = (props: Props) => {
  const id: string = useMemo(() => props.id, [props.id]);
  const settingState = useMemo(() => {
    return props.settingState;
  }, [props.settingState]);

  const value = useMemo(() => {
    return {
      id,
      settingState,
    };
  }, [id, settingState]);

  return (
    <QuestionCategoryAccordionViewContext.Provider value={value}>
      {props.children}
    </QuestionCategoryAccordionViewContext.Provider>
  );
};
