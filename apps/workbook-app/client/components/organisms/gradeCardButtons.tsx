import {View} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import BuildingIcon from '../../assets/svg/building_grade1-button.svg';
import HouseIcon from '../../assets/svg/house_common.svg';
import {questionGrade} from '../../types/commonUnionType';
import CardButton from '../parts/cardButton';
import Spacer from '../parts/spacer';

export type GradeCardButtonsProps = {
  readonly onPressOutGradeOne: () => void;
  readonly onPressOutGradeTwo: () => void;
};
/**
 * @module GradeCardButtons
 * @desc 級選択ボタン
 * @param onPressGradeOne
 * @param onPressGradeTwo
 * @example <View style={tw`items-center justify-center`}>
				<GradeCardButtons
					onPressOutGradeOne={() => {
						console.log('1級');
					}}
					onPressOutGradeTwo={() => {
						console.log('2級');
					}}
				/>
			</View>
 * @param props 
 * @returns 
 */
const GradeCardButtons = (props: GradeCardButtonsProps) => {
  return (
    <View style={tw`items-center bg-background w-11/12 py-6 rounded-md`}>
      <AppText style={tw`text-primary text-lg`}>級を選択してください</AppText>
      <AppText style={tw`text-primary text-sm`}>
        マイページ→設定から変更できます
      </AppText>
      <Spacer isHorizontal={false} size={27} />
      <CardButton
        width="47%"
        height="88px"
        text={questionGrade.gradeOne}
        onPressOut={props.onPressOutGradeOne}
      >
        <BuildingIcon width={30} height={30} />
      </CardButton>
      <Spacer isHorizontal={false} size={16} />
      <CardButton
        width="47%"
        height="88px"
        text={questionGrade.gradeTwo}
        onPressOut={props.onPressOutGradeTwo}
      >
        <HouseIcon fill="#289DF4" width={30} height={30} />
      </CardButton>
    </View>
  );
};

export default GradeCardButtons;
