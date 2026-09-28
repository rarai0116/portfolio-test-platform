import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import {
  LeftArrowHeaderButton,
  RightArrowHeaderButton,
} from '../../../organisms/headerButtons';

export type CalendarHeaderProps = {
  readonly headerStyle?: string;
  readonly headerWidth?: number;
  readonly textStyle?: string;
  readonly buttonColor?: string;
};

const CalendarHeader = (props: CalendarHeaderProps) => {
  const {ymData, currentIndex, scrollFoward, scrollBackward} = useContext(
    CustomCalendarContext,
  );

  const ymText = useMemo(() => {
    if (currentIndex === null || currentIndex === undefined) return '';
    return `${ymData[currentIndex].year} 年 ${ymData[currentIndex].month}月`;
  }, [ymData, currentIndex]);

  const slide: string[] = useMemo(() => {
    return Object.keys(ymData);
  }, [ymData]);

  return (
    <View
      style={props.headerWidth ? tw`w-[${props.headerWidth}px]` : tw`w-full`}
    >
      <View
        style={
          props.headerStyle
            ? tw`${props.headerStyle}`
            : tw`flex-row h-[56px] justify-between px-3.5 pt-4 pb-4 bg-workbookblue-500`
        }
      >
        {currentIndex === 0 ? (
          <View style={tw`w-6`} />
        ) : (
          <LeftArrowHeaderButton
            color={props.buttonColor}
            onPressOut={() => {
              scrollBackward();
            }}
          />
        )}
        <AppText
          style={
            props.textStyle ? tw`${props.textStyle}` : tw`text-white text-base`
          }
        >
          {ymText}
        </AppText>
        {currentIndex === slide.length - 1 ? (
          <View style={tw`w-6`} />
        ) : (
          <RightArrowHeaderButton
            color={props.buttonColor}
            onPressOut={() => {
              scrollFoward(slide);
            }}
          />
        )}
      </View>
    </View>
  );
};

export default CalendarHeader;
