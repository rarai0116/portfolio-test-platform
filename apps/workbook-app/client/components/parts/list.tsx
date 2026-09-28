import {View, Pressable} from 'react-native';
import {useMemo, useContext, memo} from 'react';
import type {ReactNode} from 'react';
// import {Pressable} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import AlertIcon from '../../assets/svg/exclamation-mark_alert-icon.svg';
import RightArrow from '../../assets/svg/right-arrow.svg';
import {AccordionMenuContext} from '../hooks/useAccordionMenuContext';
import Spacer from './spacer';

export type ListProps = {
  readonly icon?: ReactNode;
  readonly hasIcon?: boolean;
  readonly title?: string | ReactNode;
  readonly hasAlert?: boolean;
  readonly hasArrow?: boolean;
  readonly onPressOut?: () => void;
  readonly onPressIn?: () => void;
  readonly headerTitle?: string;
  readonly height?: string;
  readonly textNumberOfLines?: number;
  readonly isHidden?: boolean;
  readonly children?: ReactNode;
  readonly isDisabled?: boolean;
  readonly hasAccordionArrow?: boolean;
};

const List = memo((props: ListProps) => {
  const {arrowDirection: _arrowDirection} = useContext(AccordionMenuContext);
  const textWidth: string = useMemo(() => {
    if (props.hasAlert && props.hasArrow) {
      return 'w-9/12';
    } else if (props.hasAlert || props.hasArrow || props.hasAccordionArrow) {
      return 'w-10/12';
    }

    return 'w-11/12';
  }, [props.hasAlert, props.hasArrow, props.hasAccordionArrow]);

  const header = useMemo(() => {
    if (props.headerTitle) {
      return (
        <>
          <AppText style={tw`text-primary text-sm pl-8`}>
            {props.headerTitle}
          </AppText>
          <Spacer isHorizontal={false} size={4} />
        </>
      );
    }

    return null;
  }, [props.headerTitle]);

  const children = useMemo(() => {
    return (
      <View style={tw`flex-row justify-between`}>
        <View style={tw`${textWidth} flex-row items-center`}>
          {props.hasIcon ? (
            <>
              <View>{props.icon}</View>
              <Spacer isHorizontal size={16} />
            </>
          ) : null}
          {typeof props.title === 'string' ? (
            <AppText
              style={tw`text-primary text-base`}
              numberOfLines={props.textNumberOfLines ?? 1}
            >
              {props.title}
            </AppText>
          ) : (
            props.title
          )}
        </View>
        <View style={tw`flex-row items-center`}>
          {props.hasAlert ? <AlertIcon width={24} height={24} /> : null}
          <Spacer isHorizontal size={4} />
          {props.hasArrow ? (
            <RightArrow fill="#BABABA" width="20px" height="20px" />
          ) : null}
        </View>
      </View>
    );
  }, [
    props.hasIcon,
    props.icon,
    props.title,
    props.textNumberOfLines,
    props.hasAlert,
    props.hasArrow,
    textWidth,
  ]);

  if (props.isHidden) return null;
  return (
    <View key={`list-${props.title}`}>
      {header}
      <View style={tw`w-full items-center`}>
        <Pressable
          style={({pressed}) =>
            tw.style(
              `w-11/12 ${props.height ?? 'h-12'} rounded-md px-4 py-3 opacity-90`,
              pressed || props.isDisabled ? 'bg-[#ECECEC]' : 'bg-white',
            )
          }
          disabled={props.isDisabled}
          onPressOut={props.onPressOut}
          onPressIn={props.onPressIn}
        >
          {props.children ?? children}
        </Pressable>
      </View>
    </View>
  );
});

export default List;
