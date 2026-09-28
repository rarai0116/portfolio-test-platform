import {ScrollView} from 'react-native-gesture-handler';
import Spacer from '../parts/spacer';
import ModalAccordionMenu from './modalCategoryAccordionMenu';

export type PracticeQuestionSettingStepThreeProps = Record<string, never>;

const PracticeQuestionSettingStepThree = (
  _props: PracticeQuestionSettingStepThreeProps,
) => {
  return (
    <ScrollView>
      <ModalAccordionMenu />
      <Spacer isHorizontal={false} size={300} />
    </ScrollView>
  );
};

export default PracticeQuestionSettingStepThree;
