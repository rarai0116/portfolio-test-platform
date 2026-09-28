import {View, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {MyPageViewsProps} from '../../../types/viewParameter';
import tw from '../../../tailwind.custom';
import GradeCardButtons from '../../organisms/gradeCardButtons';
import Background from '../../parts/background';

export type MyPageChangeGradeViewProps = Record<string, never>;

const MyPageChangeGradeView = (_props: MyPageChangeGradeViewProps) => {
  const _navigation =
    useNavigation<MyPageViewsProps<'MyPageHome'>['navigation']>();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" onLayout={(_event) => {}}>
      <Background>
        <View style={tw`grow items-center justify-center pb-30`}>
          <GradeCardButtons
            onPressOutGradeOne={() => {}}
            onPressOutGradeTwo={() => {}}
          />
        </View>
      </Background>
    </ScrollView>
  );
};

export default MyPageChangeGradeView;
