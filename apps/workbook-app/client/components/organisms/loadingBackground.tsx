import {
  View,
  Image,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import {useContext, useMemo, type ReactNode} from 'react';
import tw from '../../tailwind.custom';
import BuildingPhoto from '../../assets/png/demoschool-building-photo.png';
import {ModalManagerContext} from '../hooks/useModalManagerContext';

export type LoadingBackgroundProps = {readonly children: ReactNode};

const InnerOrganisms = (props: LoadingBackgroundProps) => {
  const {width, height} = useWindowDimensions();
  const buildingPhoto = BuildingPhoto as ImageSourcePropType;
  const {activeModal} = useContext(ModalManagerContext);

  const _statusBarBackgroundColor = useMemo(() => {
    return activeModal === null || activeModal === undefined
      ? '#68B9F6'
      : '#4982AD';
  }, [activeModal]);

  return (
    <View style={tw`flex-1 h-[${height}px] bg-[#68B9F6] pt-[40%]`}>
      <View style={tw`absolute bottom-0`}>
        <Image
          style={tw`w-[${width}px] h-[${width * 1.176}px] `}
          resizeMode="contain"
          source={buildingPhoto}
        />
      </View>
      {props.children}
    </View>
  );
};

const LoadingBackground = (props: LoadingBackgroundProps) => {
  return <InnerOrganisms {...props} />;
  /* Platform.OS === 'ios' ? (
    <InnerOrganisms {...props} />
  ) : (
    <View style={tw`flex-1 bg-[#68B9F6]`}>
      <InnerOrganisms {...props} />
    </View>
  ); */
};

export default LoadingBackground;
