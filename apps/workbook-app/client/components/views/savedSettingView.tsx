import {View} from 'react-native';
import {useContext, useMemo, useEffect, useCallback} from 'react';
import {
  useIsFocused,
  useNavigation,
  CommonActions,
} from '@react-navigation/native';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Background from '../parts/background';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import BasicHalfModal from '../parts/basicHalfModal';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';
import {savedSettingModalStates} from '../../types/commonUnionType';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import QuestionSettingViewModal from '../viewmodals/questionSettingViewModal';
import FailedStartTestModals from '../organisms/failedStartTestModal';
import {DisplaySavedSettingCardList} from '../parts/displaySettingCardList';
import {type QuestionViewsProps, allScreenIdList} from '@/types/viewParameter';

export type SavedSettingViewProps = Record<string, never>;

const modalStates = {
  deleteSettingModal: 'deleteSettingModal',
};

const InnerView = () => {
  const isFocused = useIsFocused();
  const navigation =
    useNavigation<QuestionViewsProps<'SavedSetting'>['navigation']>();
  const {hideModal} = useContext(ModalManagerContext);
  const {removeTargetSavedSettingList, setTargetSavedSettingId} = useContext(
    GlobalSaveDataContext,
  );
  const {readyForTest} = useContext(GlobalUserSettingContext);
  const {savedSettingListArray, initializeQuestionInfo, setCurrentSettingId} =
    useContext(QuestionSettingViewContext);
  const {showModal} = useContext(ModalManagerContext);
  const onPressOutSavedSettingcard = useCallback(
    (id: string) => {
      initializeQuestionInfo();
      setCurrentSettingId(id);
      showModal(savedSettingModalStates.viewModal);
    },
    [initializeQuestionInfo, setCurrentSettingId, showModal],
  );

  /** 保存した設定のIDリスト */
  const savedSettingIdList = useMemo(() => {
    return savedSettingListArray.map((v) => v.id);
  }, [savedSettingListArray]);
  /** 保存した設定がない場合の表示 */
  const hasSetting = useMemo(() => {
    if (savedSettingIdList.length === 0) {
      return (
        <View style={tw`flex-1 items-center pt-20`}>
          <AppText style={tw`text-lg text-secondary`}>
            保存した設定はありません
          </AppText>
        </View>
      );
    }
  }, [savedSettingIdList]);

  /**  保存した設定の削除モーダル */
  const deleteSettingModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="この設定を削除しますか"
        id={modalStates.deleteSettingModal}
        primaryButtonText="削除"
        thirdlyButtonText="キャンセル"
        hasInput={false}
        onPressOutPrimaryButton={async () => {
          // console.log(deleteTargetSettingId);
          await removeTargetSavedSettingList().catch((error: unknown) => {
            console.error('deleteSettingModal：処理失敗', error);
            setTargetSavedSettingId(null);
          });
          hideModal();
        }}
        onPressOutThirdlyButton={() => {
          setTargetSavedSettingId(null);
          hideModal();
        }}
      />
    );
  }, [hideModal, removeTargetSavedSettingList, setTargetSavedSettingId]);
  // テスト開始チェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (!readyForTest.isComplete) return;
    // navigation.getParent()?.setOptions({tabBarStyle: {display: 'none'}});
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Test',
            params: {
              userId: allScreenIdList.Test,
              screen: 'QuestionAndChoicesView',
              params: {
                userId: allScreenIdList.QuestionAndChoicesView,
              },
            },
          },
        ],
      }),
    );
  }, [readyForTest.isComplete]);
  return (
    <>
      <QuestionSettingViewModal id={savedSettingModalStates.viewModal} />
      <FailedStartTestModals
        notEnoughQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
          onPressOutCancelButton() {},
        }}
        noQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
        }}
        questionStartFailedModalProps={{
          onPressOutCloseButton() {},
        }}
      />
      {deleteSettingModal}
      {/* FlashList は自前でスクロール・仮想化する。ScrollView でラップすると
          仮想化が無効化され全件が一度に描画されるため、ラップしないこと。 */}
      <View style={tw`flex-1 w-full`}>
        {savedSettingIdList.length === 0 ? (
          hasSetting
        ) : (
          <DisplaySavedSettingCardList
            list={savedSettingIdList}
            isDisablePress={false}
            onPressOut={onPressOutSavedSettingcard}
          />
        )}
      </View>
    </>
  );
};

const SavedSettingView = () => {
  return (
    <Background>
      <InnerView />
    </Background>
  );
};

export default SavedSettingView;
