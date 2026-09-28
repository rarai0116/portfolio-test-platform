import {View} from 'react-native';
import {useState, useCallback} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import QuestionMarkIcon from '../../assets/svg/question-mark_tool-tip-icon.svg';
import BasisButton from '../identities/button';
import CrossButton from './crossButton';

export type ToolTipProps = {
  readonly textPosition: string;
  readonly toolTipText: string;
};

const ToolTip = (props: ToolTipProps) => {
  const [visibility, setVisibility] = useState(false);

  const hideToolTip = useCallback(() => {
    setVisibility(false);
  }, []);
  const showToolTip = useCallback(() => {
    setVisibility(true);
  }, []);

  return (
    <View>
      {visibility ? (
        <View
          style={tw`w-44 min-h-[36px] bg-primary/80
					rounded-lg z-10 absolute ${props.textPosition} pl-3 py-2`}
        >
          <View style={tw`flex-row`}>
            <View style={tw`w-36`}>
              <AppText style={tw`text-white text-xxs`}>
                {props.toolTipText}
              </AppText>
            </View>
            <View>
              <ButtonContextProvider
                state={ButtonStates.released}
                onPressIn={hideToolTip}
              >
                <CrossButton color="white" crossSize="8px" />
              </ButtonContextProvider>
            </View>
          </View>
        </View>
      ) : null}
      <ButtonContextProvider
        state={ButtonStates.released}
        onPressOut={visibility ? hideToolTip : showToolTip}
      >
        <BasisButton width="24px" height="24px" pressedOpacity={1}>
          <QuestionMarkIcon />
        </BasisButton>
      </ButtonContextProvider>
    </View>
  );
};

export default ToolTip;
