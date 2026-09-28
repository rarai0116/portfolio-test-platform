import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import type {ResultStateType} from './questionResultPart';
import QuestionResultPart from './questionResultPart';

export type QuestionResultListProps = {
  readonly data: Array<{
    questionNumber: string;
    result: ResultStateType;
    onPressOutExplanationButton: () => void;
  }>;
};

const QuestionResultList = (properties: QuestionResultListProps) => {
  const {buttonInfoList} = useContext(CheckButtonContext);
  const array: React.JSX.Element[] = useMemo(() => {
    return buttonInfoList.map((_v, i) => {
      const key = `QuestionResultPart_${i}`;
      return (
        <QuestionResultPart
          key={key}
          result={properties.data[i].result}
          buttonInfo={buttonInfoList[i]}
          onPressOut={properties.data[i].onPressOutExplanationButton}
        />
      );
    });
  }, [buttonInfoList, properties]);

  return <View>{array}</View>;
};

export default QuestionResultList;
