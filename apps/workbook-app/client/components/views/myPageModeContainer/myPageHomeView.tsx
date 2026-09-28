import {summarizeConsoleValue} from '../../functionals/consoleLevels';
import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useMemo, useContext, useEffect, useState} from 'react';
import Constants from 'expo-constants';
import tw from '../../../tailwind.custom';
import Spacer from '../../parts/spacer';
import Background from '../../parts/background';
import {ModalManagerContext} from '../../hooks/useModalManagerContext';
import AppText from '../../identities/appText';
import List from '../../parts/list';
import HumanIcon from '../../../assets/svg/human_tab-bar-icon.svg';
import TwoArrowIcon from '../../../assets/svg/two-arrows_change-grade-icon.svg';
import BasicHalfModal from '../../parts/basicHalfModal';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import {AuthContext} from '../../hooks/useAuthContext';
import {GlobalSaveDataContext} from '../../hooks/useGlobalSaveDataContext';
import SpeechBubbleIcon from '../../../assets/svg/speech-bubble_inquiry-form.svg';
import {InquiryFormContext} from '../../hooks/useInquiryFormContextProvider';
import InquiryFormModalItems from '../../organisms/inquiryFormModalItems';
import {inquiryFormModalStates} from '../../../types/commonUnionType';
import DataBaseIcon from '../../../assets/svg/database_delete-cache-icon.svg';
import {useImageAsset} from '../../hooks/useImageAssetContext';
import LinkIcon from '../../../assets/svg/link_unlink-account.svg';
import {SnapshotManagerContext} from '../../hooks/useSnapshotManagerContext';

export type QuestionHomeViewProps = Record<string, never>;

export const modalStates = {
  editUserName: 'editUserName',
  help: 'help',
  resetGrade: 'resetGrade',
  gradeReseted: 'gradeReseted',
  askDeleteCache: 'askDeleteCache',
  cacheDeleted: 'cacheDeleted',
  askUnlinkAccount: 'askUnlinkAccount',
  reconfirmUnlinkAccount: 'reconfirmUnlinkAccount',
  accountUnlinked: 'accountUnlinked',
  termsOfUse: 'termsOfUse',
  privacyPolicy: 'privacyPolicy',
  chacheDeleteFailed: 'chacheDeleteFailed',
  accountUnlinkFailed: 'accountUnlinkFailed',
  ...inquiryFormModalStates,
};

const MyPageHomeView = (_props: QuestionHomeViewProps) => {
  /*  const navigation =
    useNavigation<MyPageViewsProps<'MyPageHome'>['navigation']>();
*/
  const {clearAllListener, isClearedListeners} = useContext(
    SnapshotManagerContext,
  );
  const {showModal, hideModal, activeModal} = useContext(ModalManagerContext);
  const {grade, setIsDisabledInput} = useContext(GlobalUserSettingContext);
  const {setAnswerlingTestSettingData} = useContext(GlobalSaveDataContext);
  const {
    setIsResetApp,
    updateCustomClaims,
    loginUser,
    googleLogout,
    isAuthenticated,
  } = useContext(AuthContext);
  const {setIsInitialOpen} = useContext(InquiryFormContext);
  const {deleteAllAssets} = useImageAsset();
  const [mode, setMode] = useState<
    'unAccountLinkage' | 'resetGrade' | 'cacheCleared' | null
  >(null);

  /**  級の切り替えモーダル */
  const resetGradeModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="選択級のリセット"
        text={`級を切り替えると、切り替え前の級の全てのテスト結果や統計は元の級に戻すまで表示できなくなり、中断データがある場合は削除されます。
また試験データや画像データをダウンロードし直す必要がある場合があります。選択している級をリセットしてもよろしいですか？`}
        id={modalStates.resetGrade}
        hasInput={false}
        primaryButtonText="リセットする"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          setMode('resetGrade');
          setIsDisabledInput(true, async () => {
            return new Promise<void>((resolve) => {
              clearAllListener();
              hideModal();
              resolve();
            });
          });
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      >
        <AppText style={tw`text-base font-bold text-primary text-left`}>
          現在の選択級：{grade}
        </AppText>
      </BasicHalfModal>
    );
  }, [grade, hideModal, clearAllListener, setIsDisabledInput]);

  /** 級選択リセット完了モーダル */
  const gradeResetedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="級選択情報リセット完了"
        text="級の選択情報をリセットしました。ローディング画面に戻ります。"
        id={modalStates.gradeReseted}
        hasInput={false}
        thirdlyButtonText="OK"
        onPressOutThirdlyButton={() => {
          hideModal();
          setIsResetApp(true);
        }}
      />
    );
  }, [hideModal, setIsResetApp]);

  /** キャッシュ削除モーダル */
  const askDeleteCacheModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="アセット削除"
        text={`保存されている画像・テストデータを削除します
※テスト履歴や統計、個人の記録は削除されません
          `}
        id={modalStates.askDeleteCache}
        hasInput={false}
        primaryButtonText="削除"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          setIsDisabledInput(true, async () => {
            return new Promise<void>((resolve) => {
              deleteAllAssets()
                .then((result) => {
                  setIsDisabledInput(false);
                  if (result === 'success') {
                    console.log('削除完了', summarizeConsoleValue(result));
                    showModal(modalStates.cacheDeleted);
                  } else {
                    console.error('削除失敗', result);
                    showModal(modalStates.chacheDeleteFailed);
                  }
                })
                .catch((error: unknown) => {
                  console.error('削除失敗', error);
                  showModal(modalStates.chacheDeleteFailed);
                });
              resolve();
            });
          });
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [hideModal, showModal, deleteAllAssets, setIsDisabledInput]);

  /** キャッシュ削除完了モーダル */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const cacheDeletedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="キャッシュが削除されました"
        text="アプリを再起動します"
        id={modalStates.cacheDeleted}
        hasInput={false}
        thirdlyButtonText="OK"
        onPressOutThirdlyButton={() => {
          setIsDisabledInput(true, async () => {
            return new Promise<void>((resolve) => {
              hideModal(() => {
                clearAllListener();
                setMode('cacheCleared');
                resolve();
              });
            });
          });
        }}
      />
    );
  }, [hideModal, setMode, clearAllListener, setIsDisabledInput]);
  /** キャッシュ削除失敗モーダル */
  const cacheDeleteFailedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="キャッシュの削除に失敗しました"
        text="アプリを再起動します。動作がおかしい場合は再度キャッシュ削除をお試しください"
        id={modalStates.chacheDeleteFailed}
        hasInput={false}
        thirdlyButtonText="OK"
        onPressOutThirdlyButton={() => {
          setIsDisabledInput(true, async () => {
            return new Promise<void>((resolve) => {
              hideModal(() => {
                clearAllListener();
                setMode('cacheCleared');
                resolve();
              });
            });
          });
        }}
      />
    );
  }, [hideModal, clearAllListener, setIsDisabledInput]);
  /** アカウント連携解除モーダル */
  const askUnlinkAccountModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="アカウント連携を解除しますか？"
        text="別のアカウントで再連携する必要がある場合のみ使用してください"
        id={modalStates.askUnlinkAccount}
        hasInput={false}
        primaryButtonText="解除"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          showModal(modalStates.reconfirmUnlinkAccount);
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [showModal, hideModal]);

  /** アカウント連携解除再確認 */
  const reconfirmUnlinkAccountModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="本当に解除しますか？"
        id={modalStates.reconfirmUnlinkAccount}
        hasInput={false}
        primaryButtonText="解除"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          setIsDisabledInput(true, async () => {
            return new Promise<void>((resolve) => {
              hideModal(() => {
                clearAllListener();
                setMode('unAccountLinkage');
                resolve();
              });
            });
          });
        }}
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [hideModal, clearAllListener, setIsDisabledInput]);
  /** アカウント連携解除失敗 */
  const accountUnlinkFailedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="アカウント連携解除に失敗しました"
        text="再度お試しください"
        id={modalStates.accountUnlinkFailed}
        hasInput={false}
        thirdlyButtonText="OK"
        onPressOutThirdlyButton={() => {
          hideModal();
        }}
      />
    );
  }, [hideModal]);

  /** アカウント連携解除完了 */
  const accountUnlinkedModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="連携が解除されました"
        text="アプリを再起動します"
        id={modalStates.accountUnlinked}
        hasInput={false}
        thirdlyButtonText="OK"
        onPressOutThirdlyButton={() => {
          hideModal();
          setIsResetApp(true);
        }}
      />
    );
  }, [hideModal, setIsResetApp]);

  /**  利用規約 */
  const termsOfUseModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="利用規約"
        id={modalStates.termsOfUse}
        hasInput={false}
        isBackDropPressFreeze={false}
      >
        <Spacer isHorizontal={false} size={8} />
        <ScrollView style={tw`px-2 bg-background h-10/12`}>
          <AppText style={tw`text-sm text-primary`}>
            ダミー
            この利用規約（以下，「本規約」といいます。）は，＿＿＿＿＿（以下，「当社」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下，「ユーザー」といいます。）には，本規約
            に従って，本サービスをご利用いただきます。第1条（適用）本規約は，ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。当社は本サービスに関し，本規約のほか，ご利用にあたってのルール等，各種の定め（以下，「個別規定」といいます。）をすることがあります。
            この利用規約（以下，「本規約」といいます。）は，＿＿＿＿＿（以下，「当社」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下，「ユーザー」といいます。）には，本規約
            に従って，本サービスをご利用いただきます。第1条（適用）本規約は，ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。当社は本サービスに関し，本規約のほか，ご利用にあたってのルール等，各種の定め（以下，「個別規定」といいます。）をすることがあります。
            この利用規約（以下，「本規約」といいます。）は，＿＿＿＿＿（以下，「当社」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下，「ユーザー」といいます。）には，本規約
            に従って，本サービスをご利用いただきます。第1条（適用）本規約は，ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。当社は本サービスに関し，本規約のほか，ご利用にあたってのルール等，各種の定め（以下，「個別規定」といいます。）をすることがあります。
            この利用規約（以下，「本規約」といいます。）は，＿＿＿＿＿（以下，「当社」といいます。）がこのウェブサイト上で提供するサービス（以下，「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下，「ユーザー」といいます。）には，本規約
            に従って，本サービスをご利用いただきます。第1条（適用）本規約は，ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。当社は本サービスに関し，本規約のほか，ご利用にあたってのルール等，各種の定め（以下，「個別規定」といいます。）をすることがあります。
          </AppText>
          <Spacer isHorizontal={false} size={20} />
        </ScrollView>
        <Spacer isHorizontal={false} size={20} />
      </BasicHalfModal>
    );
  }, []);

  /** プライバシーポリシー */
  const PrivacyPolicyModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="プライバシーポリシー"
        id={modalStates.privacyPolicy}
        hasInput={false}
        isBackDropPressFreeze={false}
      >
        <Spacer isHorizontal={false} size={8} />
        <ScrollView style={tw`px-2 py-3 bg-background h-10/12`}>
          <AppText style={tw`text-sm text-primary`}>
            ダミー
            ＿＿＿＿＿＿＿（以下，「当社」といいます。）は，本ウェブサイト上で提供するサービス（以下,「本サービス」といいます。）における，ユーザーの個人情報の取扱いについて，以下のとおりプライバシーポリシー（以下，「本ポリシー」といいます。）を定めます。
            第1条（個人情報）
            「個人情報」とは，個人情報保護法にいう「個人情報」を指すものとし，生存する個人に関する情報であって，当該情報に含まれる氏名，生年月日，住所，電話番号，連絡先その他の記述等により特定の個人を識別できる情報及び容貌，指紋，声紋にかかるデータ，
            及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
            第2条（個人情報の収集方法）
            当社は，ユーザーが利用登録をする際に氏名，生年月日，住所，電話番号，メールアドレス，銀行口座番号，クレジットカード番号，運転免許証番号などの個人情報をお尋ねすることがあります。また，ユーザーと提携先などとの間でなされたユーザーの個人情報を含む
            取引記録や決済に関する情報を,当社の提携先（情報提供元，広告主，広告配信先などを含みます。以下，｢提携先｣といいます。）などから収集することがあります。
          </AppText>
          <Spacer isHorizontal={false} size={20} />
        </ScrollView>
        <Spacer isHorizontal={false} size={20} />
      </BasicHalfModal>
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isClearedListeners) return;
    if (mode === 'resetGrade') {
      updateCustomClaims('')
        .then((result) => {
          console.log('リセット完了', summarizeConsoleValue(result));
          setAnswerlingTestSettingData(null)
            .then((result) => {
              console.log('データ削除完了', summarizeConsoleValue(result));
              showModal(modalStates.gradeReseted);
            })
            .catch((error: unknown) => {
              console.error('エラー', error);
              hideModal();
            });
        })
        .catch((error: unknown) => {
          console.error('エラー', error);
          hideModal();
        });
    }

    if (mode === 'cacheCleared') {
      setIsResetApp(true);
    }

    if (mode === 'unAccountLinkage') {
      googleLogout()
        .then((_result) => {
          console.log('ログアウト処理完了');
          showModal(modalStates.accountUnlinked);
        })
        .catch((error: unknown) => {
          console.error('エラー', error);
          showModal(modalStates.accountUnlinkFailed);
        });
    }
  }, [mode, isClearedListeners]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isAuthenticated) showModal(modalStates.accountUnlinked);
  }, [isAuthenticated]);

  return (
    <Background>
      <InquiryFormModalItems />
      {resetGradeModal}
      {gradeResetedModal}
      {askDeleteCacheModal}
      {cacheDeleteFailedModal}
      {cacheDeletedModal}
      {askUnlinkAccountModal}
      {reconfirmUnlinkAccountModal}
      {accountUnlinkedModal}
      {accountUnlinkFailedModal}

      {termsOfUseModal}

      {PrivacyPolicyModal}

      <Spacer isHorizontal={false} size={12} />
      <View style={tw`items-center`}>
        <View style={tw` w-11/12 items-start bg-white rounded-md px-4 py-3`}>
          <View style={tw`flex-row pt-1`}>
            <HumanIcon fill="#727272" width={20} height={20} />
            <AppText style={tw`pl-2 text-primary items-start ml-2`}>
              {loginUser?.displayName ?? '不明なユーザー'}
            </AppText>

            {/* <AppTextInputWithIcon
                  id="myPageUserNameInput"
                  inputStyle="pl-4"
                  placeholder={loginUser?.displayName ?? 'ユーザー名'}
                  placeholderTextColor="#3F3F3F"
                  maxLength={20}
                  icon={<PenIcon fill="#BABABA" width={14} height={14} />}
                />
                */}
          </View>

          <Spacer isHorizontal size={16} />

          {/*
              <AppText style={tw`w-full pl-9`}>学部</AppText>
              */}
          <AppText style={tw`w-full pl-9`}>{loginUser?.email ?? ''}</AppText>

          <View style={tw``}>
            {/* <AppTextInputWithIcon
									inputStyle=""
									placeholder="ユーザー名"
									placeholderTextColor="#3F3F3F"
									maxLength={20}
									icon={<PenIcon fill="#BABABA" width={14} height={14} />}
								/> */}

            <Spacer isHorizontal size={12} />
          </View>
        </View>
      </View>

      <Spacer isHorizontal={false} size={12} />
      {/*
          <List
            hasIcon
            hasArrow
            hasAlert // MyPageViewContextから渡す
            icon={<MailIcon width={20} height={20} />}
            title="メッセージ"
            onPressOut={() => {
              navigation.navigate('MyPageMessage', {});
              console.log('メッセージページへ');
            }}
          />
          <Spacer isHorizontal={false} size={12} />
          */}
      <List
        hasIcon
        icon={<SpeechBubbleIcon width={20} height={20} />}
        title="お問い合わせ"
        onPressOut={() => {
          if (activeModal !== null) return;
          setIsInitialOpen(true);
          showModal(modalStates.inquiryFormViewModal);
          /*
              navigation.navigate('MyPageInquiryForm', {});
              console.log('お問い合わせページへ');
              */
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      {/*
          <List
            hasIcon
            hasArrow
            icon={<GearIcon width={20} height={20} />}
            title="設定"
            onPressOut={() => {
              navigation.navigate('MyPageSetting', {});
              console.log('設定ページへ');
            }}
          />
          <Spacer isHorizontal={false} size={12} />
          <List
            hasIcon
            icon={<QuestionMarkIcon width={20} height={20} />}
            title="ヘルプ"
            onPressOut={() => {
              console.log('ヘルプページへ');
            }}
          />
          <Spacer isHorizontal={false} size={12} />
          */}
      <List
        hasIcon
        icon={<TwoArrowIcon width={20} height={20} />}
        title="選択級のリセット"
        onPressOut={() => {
          showModal(modalStates.resetGrade);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasIcon
        icon={<DataBaseIcon width={20} height={20} />}
        title="アセット削除"
        onPressOut={() => {
          showModal(modalStates.askDeleteCache);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasIcon
        icon={<LinkIcon width={20} height={20} />}
        title="アカウント連携解除"
        onPressOut={() => {
          showModal(modalStates.askUnlinkAccount);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      {/*
          <List
            title="利用規約"
            onPressOut={() => {
              showModal(modalStates.termsOfUse);
              console.log('利用規約ページへ');
            }}
          />
          <Spacer isHorizontal={false} size={12} />
          <List
            title="プライバシーポリシー"
            onPressOut={() => {
              showModal(modalStates.privacyPolicy);
              console.log('プライバシーポリシーページへ');
            }}
          />
          <Spacer isHorizontal={false} size={12} />
          */}
      <View style={tw`items-end`}>
        <AppText style={tw` text-primary text-sm pr-6`}>
          {`バージョン情報 ver ${Constants.expoConfig?.extra?.CURRENT_VERSION ?? 'Error'}`}
        </AppText>
      </View>
    </Background>
  );
};

/*
const MyPageHomeView = () => {
  const route = useRoute<MyPageViewsProps<'MyPageHome'>['route']>();
  useEffect(() => {
    console.log('渡されたparams', route.params);
  }, [route.params]);
  return (
    <ModalManagerContextProvider>
      <InnerView />
    </ModalManagerContextProvider>
  );
};
*/

export default MyPageHomeView;
