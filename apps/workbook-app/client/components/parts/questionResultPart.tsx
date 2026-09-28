import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import CheckBox from '../identities/checkBox';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import {ButtonContextProvider} from '../hooks/useButtonContext';
import CircleIcon from '../../assets/svg/circle_right-answer_small.svg';
import CrossIcon from '../../assets/svg/cross_wrong-answer_small.svg';
import LineIcon from '../../assets/svg/line_unanswer.svg';
import SmallButton from './smallButton';

export const resultState = {
  correct: 'correct',
  wrong: 'wrong',
  unanswered: 'unanswered',
} as const;

export type ResultStateType = (typeof resultState)[keyof typeof resultState];

export type QuestionResultPartProps = {
  readonly result: ResultStateType;
  readonly buttonInfo: ButtonInfo;
  readonly onPressOut: () => void;
};

const QuestionResultPart = (props: QuestionResultPartProps) => {
  const icon = useMemo(() => {
    switch (props.result) {
      case resultState.correct: {
        return <CircleIcon />;
      }

      case resultState.wrong: {
        return <CrossIcon />;
      }

      case resultState.unanswered: {
        return <LineIcon />;
      }
    }
  }, [props.result]);
  return (
    <View
      style={tw`h-12 justify-center bg-white px-8 py-3 border-b border-solid border-quaternary`}
    >
      <View style={tw`flex-row justify-center`}>
        <View style={tw`absolute left-0`}>
          <CheckBox checkBoxStyle="" info={props.buttonInfo} />
        </View>
        <View style={tw`h-6 w-6 items-center justify-center`}>
          {/* {props.isCorrect ? <CircleIcon /> : <CrossIcon />} */}
          {icon}
        </View>

        <View style={tw`absolute right-0`}>
          <ButtonContextProvider onPressOut={props.onPressOut}>
            <SmallButton text="解説" width="48px" />
          </ButtonContextProvider>
        </View>
      </View>
    </View>
  );
};

export default QuestionResultPart;
