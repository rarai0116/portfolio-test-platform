import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import tw from '../../tailwind.custom';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import CheckBox from '../identities/checkBox';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import DownArrow from '../../assets/svg/down-arrow.svg';
import UpArrow from '../../assets/svg/up-arrow.svg';
import BasisButton from '../identities/button';
import {AccordionMenuContext} from '../hooks/useAccordionMenuContext';
import Spacer from './spacer';

export type CategoryAccordionHeaderProps = {
  readonly buttonInfo: ButtonInfo;
  readonly style?: string;
  readonly checkBoxStyle?: string;
  readonly arrowColor: string;
};

const CategoryAccordionHeader = (props: CategoryAccordionHeaderProps) => {
  const {arrowDirection, handleAccordionMenu, buttonNameAliasList} =
    useContext(AccordionMenuContext);

  const buttonCount = useMemo(() => {
    if (!buttonNameAliasList[props.buttonInfo.id]) return 0;
    return Number(buttonNameAliasList[props.buttonInfo.id]);
  }, [props.buttonInfo.id, buttonNameAliasList]);

  const buttonName = useMemo(() => {
    return `${props.buttonInfo.name}(${buttonCount})`;
  }, [props.buttonInfo, buttonCount]);

  return (
    <View
      style={tw.style(
        `flex-row items-center`,
        props.style,
        buttonCount === 0 ? 'absolute top-[20000] left-[20000]' : '',
      )}
    >
      <Spacer isHorizontal size={16} />
      <CheckBox
        checkBoxStyle={`flex-1 h-13 items-center ${props.checkBoxStyle}`}
        info={props.buttonInfo}
        name={buttonName}
      />
      <ButtonContextProvider
        state={ButtonStates.released}
        onPressOut={() => {
          handleAccordionMenu();
        }}
      >
        <BasisButton width="56px" height="52px" pressedOpacity={1}>
          <Spacer isHorizontal size={16} />
          {arrowDirection === 'down' ? (
            <DownArrow width={24} height={24} fill={props.arrowColor} />
          ) : (
            <UpArrow width={24} height={24} fill={props.arrowColor} />
          )}

          <Spacer isHorizontal size={16} />
        </BasisButton>
      </ButtonContextProvider>
    </View>
  );
};

export default CategoryAccordionHeader;
