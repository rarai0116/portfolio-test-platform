import {View} from 'react-native';
import {useCallback, useContext, useMemo} from 'react';
import {useNavigation} from '@react-navigation/native';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import Background from '../../../parts/background';
import {displaySettingCardList} from '../../../parts/displaySettingCardList';
import type {QuestionViewsProps} from '../../../../types/viewParameter';
import BackButton from '../../../parts/backButton';
import CalendarSavedSettingViewModal from '../viewModals/calendarSavedSettingViewModal';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import {GlobalUserSettingContext} from '../../../hooks/useGlobalUserSettingContext';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';

export type CalendarSavedSettingProps = Record<string, never>;

const CalendarSavedSetting = (_props: CalendarSavedSettingProps) => {
  const navigation = useNavigation<QuestionViewsProps<'Home'>['navigation']>();

  const {grade} = useContext(GlobalUserSettingContext);
  const {savedSettingListArray} = useContext(QuestionSettingViewContext);
  const {showModal} = useContext(ModalManagerContext);
  const {setCurrentSettingId, initializeQuestionInfo} = useContext(
    QuestionSettingViewContext,
  );

  const onPressOutSavedSettingCard = useCallback(
    (id: string) => {
      initializeQuestionInfo();
      setCurrentSettingId(id);
      showModal(calendarTaskSettingModalStates.savedSettingViewModal);
    },
    [setCurrentSettingId, showModal, initializeQuestionInfo],
  );
  // フィルタリングされたIDリストを取得
  const filteredSettingIds = useMemo(() => {
    return savedSettingListArray
      .filter((v) => v.grade === grade)
      .map((v) => v.id);
  }, [savedSettingListArray, grade]);
  /** 保存した設定のリスト */
  const savedSettingCardList = useMemo(() => {
    return displaySettingCardList(
      filteredSettingIds,
      'saved',
      false,
      onPressOutSavedSettingCard,
    );
  }, [filteredSettingIds, onPressOutSavedSettingCard]);
  /** 保存した設定がない場合の表示 */
  const hasSetting = useMemo(() => {
    if (filteredSettingIds.length === 0) {
      return (
        <View style={tw`flex-1 items-center pt-20`}>
          <AppText style={tw`text-lg text-secondary`}>
            保存した設定はありません
          </AppText>
        </View>
      );
    }
  }, [filteredSettingIds]);

  return (
    <>
      <CalendarSavedSettingViewModal
        id={calendarTaskSettingModalStates.savedSettingViewModal}
      />
      {/* FlashList は自前でスクロール・仮想化する。ScrollView でラップすると
          仮想化が無効化され全件が一度に描画されるため、ラップしないこと。 */}
      <Background>
        <View style={tw`flex-1 w-full`}>
          {filteredSettingIds.length === 0 ? hasSetting : savedSettingCardList}
        </View>
        <View style={tw`flex-row px-5`}>
          <BackButton
            onPressOut={() => {
              navigation.goBack();
            }}
          />
          <View style={tw`h-5`} />
        </View>
      </Background>
    </>
  );
};

export default CalendarSavedSetting;
