import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import tw from '../../tailwind.custom';
import RightIcon from '../../assets/svg/circle_right-answer_small.svg';
import WrongIcon from '../../assets/svg/cross_wrong-answer_small.svg';
import {ButtonContextProvider} from '../hooks/useButtonContext';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import {
  CheckButtonContext,
  CheckButtonStates,
} from '../hooks/useCheckButtonContext';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import {ErrorReporfFormContext} from '../viewmodals/errorReportFormVIewModal/hooks/useErrorReporfFormContext';
import AnswerPart from './answerPart';
import SmallButton from './smallButton';
import Spacer from './spacer';
import {errorReportFormModalStates} from '@/types/commonUnionType';

export type AnswerDataPartProps = {
  readonly correctAnswer: string;
  readonly usersAnswer: string;
  readonly isCorrect: boolean;
  readonly buttonInfo: ButtonInfo;
  readonly isQaa: boolean;
};

const AnswerDataPart = (props: AnswerDataPartProps) => {
  const {showModal} = useContext(ModalManagerContext);
  const {checkedButtonList: _checkedButtonList} =
    useContext(CheckButtonContext);
  const {setIsInitialOpen} = useContext(ErrorReporfFormContext);
  const _buttonInfo = useMemo(() => {
    return {
      ...props.buttonInfo,
      initialState: props.isCorrect
        ? CheckButtonStates.unchecked
        : CheckButtonStates.checked,
    };
  }, [props.buttonInfo, props.isCorrect]);
  const usersAnswer = useMemo(() => {
    if (props.isQaa) {
      switch (props.usersAnswer) {
        case '1': {
          return '○';
        }

        case '2': {
          return '×';
        }

        default: {
          return 'ー';
        }
      }
    }

    return props.usersAnswer;
  }, [props.usersAnswer, props.isQaa]);
  const correctAnswer = useMemo(() => {
    if (props.isQaa) {
      switch (props.correctAnswer) {
        case '1': {
          return '○';
        }

        case '2': {
          return '×';
        }

        default: {
          return 'ー';
        }
      }
    }

    return props.correctAnswer;
  }, [props.correctAnswer, props.isQaa]);

  return (
    <View style={tw`items-center`}>
      <View
        style={tw`w-11/12 flex-row px-4 pt-1 pb-2 bg-white rounded justify-between`}
      >
        <View style={tw`flex-row items-center`}>
          <AnswerPart answerType="正解" answerData={correctAnswer} />
          <Spacer isHorizontal size={12} />
          <AnswerPart answerType="あなたの解答" answerData={usersAnswer} />
          <Spacer isHorizontal size={12} />
          {props.isCorrect ? <RightIcon /> : <WrongIcon />}
        </View>

        <View style={tw`flex-row items-center pt-1`}>
          <ButtonContextProvider
            onPressOut={() => {
              setIsInitialOpen(true);
              showModal(errorReportFormModalStates.viewModal);
            }}
          >
            <SmallButton text="不備を報告" width="80px" />
          </ButtonContextProvider>

          {/* チェックボックスが機能していないためコメントアウト */}
          {/*
            <Spacer isHorizontal size={16} />
            <View style={tw`pb-3`}>
            <AppText style={tw`text-xxs`}>苦手</AppText>
            <Spacer isHorizontal size={4} />
             <CheckBox checkBoxStyle="" info={buttonInfo} />
          </View> */}
        </View>
      </View>
    </View>
  );
};

export default AnswerDataPart;
