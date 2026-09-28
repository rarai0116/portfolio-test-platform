import {createContext, useMemo, useContext, useState} from 'react';
import type {ReactNode} from 'react';
import {
  type ButtonInfoList,
  CheckButtonStates,
  useCheckedButtonList,
} from '@/components/hooks/useCheckButtonContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';
import {questionGrade} from '@/types/commonUnionType';

type ErrorReporfFormContextObject = {
  errorParts: Record<string, string>;
  errorButtonInfoList: ButtonInfoList;
  errorCheckedButtonInfoList: ButtonInfoList;
  setErrorCheckedButtonInfoList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  isInitialOpen: boolean;
  setIsInitialOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type Props = {
  readonly children: ReactNode;
};

export const ErrorReporfFormContext =
  createContext<ErrorReporfFormContextObject>(
    {} as ErrorReporfFormContextObject,
  );

export const ErrorReporfFormContextProvider = (props: Props) => {
  const {grade} = useContext(GlobalUserSettingContext);

  const errorParts: Record<string, string> = useMemo(() => {
    return {
      text: '問題文',
      ch1: '選択肢1',
      ch2: '選択肢2',
      ch3: '選択肢3',
      ch4: '選択肢4',
      ...(grade === questionGrade.gradeTwo && {ch5: '選択肢5'}),
      answerText: '全体解説',
      answerText1: '解説1',
      answerText2: '解説2',
      answerText3: '解説3',
      answerText4: '解説4',
      ...(grade === questionGrade.gradeTwo && {answerText4: '解説5'}),
    };
  }, [grade]);

  const errorAnswerButtonInfo = useMemo(() => {
    return {
      id: 'error_answer',
      name: '正解が間違っている',
      initialState: CheckButtonStates.unchecked,
    };
  }, []);

  const errorTypeButtonInfoList = useMemo(() => {
    return [
      {
        id: 'error_display',
        name: 'レイアウトの崩れ',
        initialState: CheckButtonStates.unchecked,
      },
      {
        id: 'error_text',
        name: '誤字・脱字',
        initialState: CheckButtonStates.unchecked,
      },
      {
        id: 'error_image',
        name: '画像が表示されない',
        initialState: CheckButtonStates.unchecked,
      },
    ];
  }, []);

  const errorButtonInfoList: ButtonInfoList = useMemo(() => {
    const buttonInfoList = Object.keys(errorParts).reduce<ButtonInfoList>(
      (acc, errorPart, _index) => {
        const list: ButtonInfoList = errorTypeButtonInfoList.map(
          (buttonInfo) => {
            return {
              ...buttonInfo,
              id: `${buttonInfo.id}_${errorPart}`,
            };
          },
        );
        // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
        return [...acc, ...list];
      },
      [],
    );

    return [errorAnswerButtonInfo, ...buttonInfoList];
  }, [errorParts, errorTypeButtonInfoList, errorAnswerButtonInfo]);

  /* useEffect(() => {
    console.log('errorButtonInfoList', errorButtonInfoList);
  }, [errorButtonInfoList]);
 */
  const [errorCheckedButtonInfoList, setErrorCheckedButtonInfoList] =
    useCheckedButtonList(errorButtonInfoList);

  const [isInitialOpen, setIsInitialOpen] = useState<boolean>(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      errorParts,
      errorButtonInfoList,
      errorCheckedButtonInfoList,
      setErrorCheckedButtonInfoList,
      isInitialOpen,
      setIsInitialOpen,
    };
  }, [
    errorParts,
    errorButtonInfoList,
    errorCheckedButtonInfoList,
    setErrorCheckedButtonInfoList,
    isInitialOpen,
    setIsInitialOpen,
  ]);

  return (
    <ErrorReporfFormContext.Provider value={value}>
      {props.children}
    </ErrorReporfFormContext.Provider>
  );
};
