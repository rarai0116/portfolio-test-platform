import {View} from 'react-native';
import {useContext, useMemo, memo} from 'react';
import tw from '../../tailwind.custom';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import CheckBox from '../identities/checkBox';
import {AccordionMenuContext} from '../hooks/useAccordionMenuContext';
import Spacer from './spacer';

export type SmallCategoryAccordionHeaderProps = {
  readonly buttonInfo: ButtonInfo;
  readonly style?: string;
  readonly checkBoxStyle?: string;
};

const SmallCategoryAccordionHeader = memo(
  ({
    buttonInfo,
    style = '',
    checkBoxStyle = '',
  }: SmallCategoryAccordionHeaderProps) => {
    const {buttonNameAliasList} = useContext(AccordionMenuContext);
    const buttonCount = useMemo(
      () => buttonNameAliasList[buttonInfo.id] || 0,
      [buttonInfo.id, buttonNameAliasList],
    );
    const buttonName = useMemo(() => {
      return `${buttonInfo.name}(${buttonCount})`;
    }, [buttonInfo, buttonCount]);

    //    if (buttonCount === 0) return null;
    return (
      <View style={tw.style(`flex-row items-center`, style)}>
        <Spacer isHorizontal size={16} />
        <CheckBox
          checkBoxStyle={`flex-1 h-13 items-center ${checkBoxStyle ?? ''}`}
          info={buttonInfo}
          name={buttonName}
        />
      </View>
    );
  },
);

export default SmallCategoryAccordionHeader;
