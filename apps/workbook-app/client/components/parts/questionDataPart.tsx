import {useWindowDimensions, View} from 'react-native';
import {useContext, useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import {QuestionAndChoicesViewContext} from '../hooks/useQuestionsAndChoicesViewContext';
import TimerBarPart from './timerBarPart';
import Spacer from './spacer';

export type QuestionDataPartProps = Record<string, never>;

const QuestionDataPart = (_props: QuestionDataPartProps) => {
  const {currentPlayData} = useContext(GlobalUserSettingContext);
  const {currentPlayNo, testDataNoList, isFinished, currentTestDatalist} =
    useContext(QuestionAndChoicesViewContext);
  const {limitTime} = currentPlayData ?? {
    limitTime: -1,
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const {grade, subject, nengoYearTestNum, difficulty} = useMemo(() => {
    const data = currentTestDatalist[currentPlayNo];
    // console.log('currentTestDatalist[current]', data);
    // console.log('currentTestDatalist', currentTestDatalist);
    // console.log('currentPlayNo', currentPlayNo);
    if (data === undefined)
      return {grade: '', subject: '', nengoYearTestNum: '', difficulty: ''};
    const grade = `${data.grade + 1}級`;
    const subject = `${data.subject}`;
    const nengo = data.nengo === '令和' ? 'R' : 'H';
    const nengoYearTestNumber = `${nengo}${data.year}-${data.testNo}`;
    const difficulty =
      data.difficult === '1' ? '☆' : data.difficult === '2' ? '☆☆' : '☆☆☆';
    return {grade, subject, nengoYearTestNum: nengoYearTestNumber, difficulty};
  }, [testDataNoList, currentPlayNo]);

  const {width} = useWindowDimensions();
  const timerBarPartWidth = useMemo(() => {
    // grade~difficultyの最大幅126px(より少し大きめの132)、padding、問題番号の幅を引いたもの
    return width - 132 - 24 - 76;
  }, [width]);

  const displayTimerBarPart = useMemo(() => {
    if (!isFinished) {
      if (limitTime > 0) {
        return <TimerBarPart isStart width={timerBarPartWidth} />;
      }

      return <View />;
    }

    return <View />;
  }, [isFinished, limitTime, timerBarPartWidth]);

  const textStyle = useMemo(() => {
    return tw`text-secondary text-xs -tracking-0.2`;
  }, []);

  const timeBar = useMemo(() => {
    return (
      <View style={tw`w-[${timerBarPartWidth}px]`}>{displayTimerBarPart}</View>
    );
  }, [timerBarPartWidth, displayTimerBarPart]);

  return (
    <View style={tw`w-full bg-white px-3 py-2 flex-row justify-between`}>
      {/*    grade~difficultyの最大幅128px */}
      <View
        style={tw`w-32 flex-row`}
        /* onLayout={(e) => {
          console.log(e.nativeEvent.layout.width);
        }} */
      >
        <AppText style={textStyle}>{grade}</AppText>
        <Spacer isHorizontal size={2} />
        <AppText style={textStyle}>{subject}</AppText>
        <Spacer isHorizontal size={2} />
        <AppText style={textStyle}>{nengoYearTestNum}</AppText>
        <Spacer isHorizontal size={2} />
        <AppText style={textStyle}>{difficulty}</AppText>
        <Spacer isHorizontal size={4} />
      </View>

      {timeBar}

      <View
        style={tw`flex-row`}
        /* onLayout={(e) => {
          console.log(e.nativeEvent.layout.width);
        }} */
      >
        <Spacer isHorizontal size={4} />
        <View style={tw`w-18 items-end`}>
          {/*   letter-spacingを指定すると一文字下がるので幅を指定 */}
          <AppText style={tw`text-secondary text-xs`}>
            {String(currentPlayNo + 1)}/{testDataNoList.length}問
          </AppText>
        </View>
      </View>
    </View>
  );
};

export default QuestionDataPart;
