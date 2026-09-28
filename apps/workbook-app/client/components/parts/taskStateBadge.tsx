import {View} from 'react-native';
import {useCallback} from 'react';
import type {ClassInput} from 'twrnc';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import type {QuestionStateType} from '../../types/commonUnionType';
import {questionState} from '../../types/commonUnionType';

export type TaskStateBadgeProps = {readonly state: QuestionStateType};

const TaskStateBadge = (props: TaskStateBadgeProps) => {
  const [viewStyle, textStyle]: ClassInput[] = useCallback(() => {
    const commonViewStyle = [
      /* 'w-40px', */
      'h-20px',
      'px-2',
      'py-0.5',
      'my-0.5',
      'rounded-xl',
      'justify-center',
      'items-center',
    ];
    const commonTextStyle = ['text-xxs'];

    if (props.state === questionState.completed) {
      return [
        commonViewStyle.concat(['bg-successgreen-400 w-40px']),
        commonTextStyle.concat(['text-white']),
      ];
    }

    if (props.state === questionState.progress) {
      return [
        commonViewStyle.concat(['bg-cautionyellow-300 w-40px']),
        commonTextStyle.concat(['text-primary']),
      ];
    }

    /* if (props.state === questionState.notStarted) {
			return [
				commonViewStyle.concat(['bg-workbookblue-500 w-52px']),
				commonTextStyle.concat(['text-white']),
			];
		} */

    return [];
  }, [props.state])();

  return (
    <View>
      {props.state !== questionState.notStarted && (
        <View style={tw.style(viewStyle)}>
          <AppText style={tw.style(textStyle)}>{props.state}</AppText>
        </View>
      )}
    </View>
  );
};

export default TaskStateBadge;
