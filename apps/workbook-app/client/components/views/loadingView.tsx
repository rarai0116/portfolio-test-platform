import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {View, ScrollView, Platform} from 'react-native';
import {useState, useMemo, useRef, useEffect, useContext} from 'react';
import {useIsFocused} from '@react-navigation/native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import BasicHalfModal from '../parts/basicHalfModal';
import Spacer from '../parts/spacer';
import LoadingBackground from '../organisms/loadingBackground';
import LoadingBar from '../parts/loadingBar';
import {
  LoadingContext,
  loadingProcessState,
  modalInitialList,
} from '../hooks/useLoadingContext';
import GradeCardButtons from '../organisms/gradeCardButtons';
import {questionGrade} from '../../types/commonUnionType';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import GoogleSignInBotton from '../parts/googleSignInBotton';
import {ImageAssetContext} from '../hooks/useImageAssetContext';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';

export type LoadingViewProps = Record<string, never>;

const LoadingView = (_props: LoadingViewProps) => {
  const isFocused = useIsFocused();
  // const {setHasNetworkError} = useContext(AuthContext);
  const {hideModal, activeModal, showModal} = useContext(ModalManagerContext);
  const {errorMessage} = useContext(GlobalSaveDataContext);
  const {loadingBarPercent, setIsDownloadFailed} =
    useContext(ImageAssetContext);
  const {
    loadingProcess,
    setLoadingProcess,
    setIsUserCanceled,
    choicedGrade,
    setChoicedGrade,
    downloadInfo,
    agreeTermsOfUse,
    disagreeTermsOfUse,
    reAuthentication,
    signOut,
    choiceGradeProcess,
    startDownloading,
    requestGoogleSignIn,
    downloadingProcess: _downloadingProcess,
    setCheckFlags,
    openAppStore,
    currentAppVersion,
  } = useContext(LoadingContext);
  const {setIsLoading} = useContext(GlobalUserSettingContext);
  const isAsyncProcess = useRef<boolean>(false);
  const [returnModalname, setReturnModalName] = useState<string | null>(null);
  const _normalLoadingBar = useMemo(() => {
    return (
      <LoadingBar
        title="ローディング中..."
        loadedTitle="ローディング完了！"
        percent={loadingBarPercent ?? 0}
      />
    );
  }, [loadingBarPercent]);

  const _checkVersionBar = useMemo(() => {
    return (
      <LoadingBar
        title="バージョンチェック中..."
        loadedTitle="バージョンチェック完了！"
        percent={loadingBarPercent ?? 0}
      />
    );
  }, [loadingBarPercent]);

  const downloadingBar = useMemo(() => {
    return (
      <LoadingBar
        title="ダウンロード中..."
        loadedTitle="ダウンロード完了！"
        percent={loadingBarPercent ?? 0}
      />
    );
  }, [loadingBarPercent]);

  const _checkAccountLinkageBar = useMemo(() => {
    return (
      <LoadingBar
        title="アカウント連携を確認中..."
        loadedTitle="アカウント連携確認完了！"
        percent={loadingBarPercent ?? 0}
      />
    );
  }, [loadingBarPercent]);

  const AskGradeView = useMemo(() => {
    return (
      <View style={tw`items-center justify-center`}>
        <GradeCardButtons
          onPressOutGradeOne={() => {
            if (activeModal !== null) return;
            setLoadingProcess(loadingProcessState.confirmGrade);
            setChoicedGrade(questionGrade.gradeOne);
            showModal(modalInitialList.ConfirmGrade);
          }}
          onPressOutGradeTwo={() => {
            if (activeModal !== null) return;
            /* setLoadingProcess(loadingProcessState.setGrade); */
            setLoadingProcess(loadingProcessState.confirmGrade);
            setChoicedGrade(questionGrade.gradeTwo);
            showModal(modalInitialList.ConfirmGrade);
          }}
        />
      </View>
    );
  }, [activeModal, setChoicedGrade, setLoadingProcess, showModal]);
  const downloadTotalMegaByte = useMemo(() => {
    const totalMegaByte = Math.floor(downloadInfo.sumSize / 100_000) / 10;
    return totalMegaByte === 0 ? 0.1 : totalMegaByte;
  }, [downloadInfo.sumSize]);

  /** ハーフモーダル */
  const TermsOfUseHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title="利用規約"
        id={modalInitialList.TermsOfUse}
        basicHalfModalInputId={`input_${modalInitialList.TermsOfUse}`}
        hasInput={false}
        primaryButtonText="同意する"
        thirdlyButtonText="同意しない"
        onPressOutPrimaryButton={() => {
          if (isAsyncProcess.current) return;
          isAsyncProcess.current = true;
          setReturnModalName(activeModal);
          agreeTermsOfUse()
            .then(() => {
              isAsyncProcess.current = false;
            })
            .catch((error: unknown) => {
              console.error('TermsOfUseHalfModal：処理失敗', error);
            });
        }}
        onPressOutThirdlyButton={() => {
          if (isAsyncProcess.current) return;
          isAsyncProcess.current = true;
          hideModal();
          disagreeTermsOfUse();
          isAsyncProcess.current = false;
        }}
      >
        <Spacer isHorizontal={false} size={8} />
        <ScrollView style={tw`px-2 py-3 bg-background`}>
          <AppText style={tw`text-sm text-primary`}>
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
        <Spacer isHorizontal={false} size={8} />
      </BasicHalfModal>
    );
  }, [activeModal, agreeTermsOfUse, disagreeTermsOfUse, hideModal]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const AccountLinkageHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title="アカウント連携"
        text=""
        hasInput={false}
        id={modalInitialList.AccountLinkage}
        basicHalfModalInputId={`input_${modalInitialList.AccountLinkage}`}
      >
        <AppText style={tw`text-sm text-primary`}>
          このアプリはデモ専門学校googleアカウントの連携が必要です
        </AppText>
        <GoogleSignInBotton
          width="1/2"
          height="88px"
          onPress={() => {
            if (isAsyncProcess.current) return;
            isAsyncProcess.current = true;
            requestGoogleSignIn()
              .then((_info) => {
                console.log('サインイン成功');
                isAsyncProcess.current = false;
                hideModal();
              })
              .catch((error: unknown) => {
                console.error('AccountLinkageHalfModal：処理失敗', error);
                if (
                  error instanceof Error &&
                  error.message.includes('認証に失敗しました')
                ) {
                  hideModal();
                  setTimeout(() => {
                    showModal(modalInitialList.AuthenticationDenied);
                  }, 500);
                } else {
                  setTimeout(() => {
                    showModal(modalInitialList.SignInDenied);
                  }, 500);
                }

                isAsyncProcess.current = false;
              });
          }}
        />
      </BasicHalfModal>
    );
  }, [requestGoogleSignIn, isAsyncProcess, hideModal, showModal]);
  /*
	const TentativeGoogleSignInHalfModal = useMemo(() => {
		// 仮
		return (
			<BasicHalfModal
				title="(仮)Googleのアカウント連携"
				id={modalInitialList.TentativeGoogleSignIn}
				hasInput={false}
				primaryButtonText="ログイン"
				onPressOutPrimaryButton={() => {
					setLoadingProcess(loadingProcessState.googleSignIn);
					console.log('ログイン画面を表示');
				}}
			/>
		);
	}, []);
	*/

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const ConfirmGradeHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title={`${choicedGrade}でよろしいですか？`}
        id={modalInitialList.ConfirmGrade}
        hasInput={false}
        primaryButtonText="はい"
        secondaryButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          if (isAsyncProcess.current) return;
          isAsyncProcess.current = true;
          setReturnModalName(activeModal);
          choiceGradeProcess(choicedGrade!)
            .then(() => {
              isAsyncProcess.current = false;
              hideModal();
              setLoadingProcess(null);
            })
            .catch((error: unknown) => {
              isAsyncProcess.current = false;
              console.error('ConfirmGradeHalfModal：処理失敗', error);
              showModal(modalInitialList.ConnectionFailed);
            });
        }}
        onPressOutSecondaryButton={() => {
          hideModal();
          setLoadingProcess(loadingProcessState.askGrade);
        }}
      />
    );
  }, [
    choicedGrade,
    choiceGradeProcess,
    isAsyncProcess,
    activeModal,
    setLoadingProcess,
    hideModal,
    showModal,
  ]);

  const DownloadHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title={`${downloadTotalMegaByte}MBの更新データがあります`}
        hasInput={false}
        id={modalInitialList.RequestDownloadData}
        primaryButtonText="ダウンロード"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          hideModal();
          startDownloading().catch((error: unknown) => {
            console.error('DownloadHalfModal：処理失敗', error);
            showModal(modalInitialList.ConnectionFailed);
          });
          console.log('ダウンロード開始');
        }}
        onPressOutThirdlyButton={() => {
          setIsUserCanceled(true);

          showModal(modalInitialList.RequireInitialDownload);
        }}
      />
    );
  }, [
    downloadTotalMegaByte,
    startDownloading,
    setIsUserCanceled,
    hideModal,
    showModal,
  ]);

  const RequireInitialDownloadHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="このダウンロードは必須です"
        id={modalInitialList.RequireInitialDownload}
        hasInput={false}
        primaryButtonText="OK"
        onPressOutPrimaryButton={() => {
          setIsUserCanceled(false);
          showModal(modalInitialList.RequestDownloadData);
        }}
      />
    );
  }, [setIsUserCanceled, showModal]);

  const ConnectionFailedHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title="接続に失敗しました"
        text="電波状況の良い環境で再度お試しください"
        id={modalInitialList.ConnectionFailed}
        hasInput={false}
        primaryButtonText="OK"
        onPressOutPrimaryButton={() => {
          // setHasNetworkError(false);
          if (returnModalname) {
            showModal(returnModalname);
          } else {
            hideModal();
            setLoadingProcess(null);
          }
        }}
      />
    );
  }, [
    returnModalname,
    showModal,
    hideModal,
    setLoadingProcess,
    // setHasNetworkError,
  ]);

  const DownloadFailedHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="ダウンロードに失敗しました"
        text="電波状況などを確認のうえ、ダウンロードを再試行してください"
        id={modalInitialList.DownloadFailed}
        hasInput={false}
        primaryButtonText="再試行"
        onPressOutPrimaryButton={() => {
          hideModal();
          setIsDownloadFailed(false);
          startDownloading().catch((error: unknown) => {
            console.error('DownloadFailedHalfModal：処理失敗', error);
            showModal(modalInitialList.ConnectionFailed);
          });
        }}
      />
    );
  }, [hideModal, setIsDownloadFailed, startDownloading, showModal]);

  const TimeOutHalfModal = useMemo(() => {
    return (
      <BasicHalfModal
        title={`
応答がありませんでした。
通信状況が良好な場所で再試行して下さい`}
        id={modalInitialList.TimeOut}
        hasInput={false}
        primaryButtonText="再試行"
        thirdlyButtonText="キャンセル"
        onPressOutPrimaryButton={() => {
          setLoadingProcess(null);
          hideModal();
        }}
      />
    );
  }, [hideModal, setLoadingProcess]);
  const AuthenticateDeniedModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title="認証に失敗しました"
        id={modalInitialList.AuthenticationDenied}
        hasInput={false}
        primaryButtonText="再認証"
        thirdlyButtonText="ログアウト"
        onPressOutPrimaryButton={() => {
          hideModal();
          reAuthentication().catch((error: unknown) => {
            console.error('AuthenticateDeniedModal：処理失敗', error);
            showModal(modalInitialList.AuthenticationDenied);
          });
        }}
        onPressOutSecondaryButton={() => {
          hideModal();
          signOut().catch((error: unknown) => {
            console.error('AuthenticateDeniedModal：処理失敗', error);
          });
        }}
      >
        <AppText style={tw`text-sm text-primary`}>
          このアプリは、デモ専門学校所属のgoogleアカウントでの認証が必要です
          再度認証し直すか、ログアウトして別のアカウントでログインしてください。
        </AppText>
      </BasicHalfModal>
    );
  }, [hideModal, reAuthentication, signOut, showModal]);

  const signInDeniedModal = useMemo(() => {
    return (
      <BasicHalfModal
        isBackDropPressFreeze
        title="サインインに失敗しました"
        id={modalInitialList.SignInDenied}
        hasInput={false}
        primaryButtonText="OK"
        onPressOutPrimaryButton={() => {
          showModal(modalInitialList.AccountLinkage);
        }}
      >
        <AppText style={tw`text-sm text-primary`}>
          通信に失敗したか対象のgoogleアカウントにこのアプリを使用する権限がありません。
          再度ログインをやり直してください。
        </AppText>
      </BasicHalfModal>
    );
  }, [showModal]);
  const RecommendedVersionUpModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="アプリのバージョンアップがあります"
        id={modalInitialList.RecommendedVersionUp}
        text={`${Platform.OS === 'ios' ? 'TestFlight' : 'Apptester'}で最新バージョンをインストールすることができます`}
        hasInput={false}
        primaryButtonText="アップデート"
        secondaryButtonText="あとで"
        onPressOutPrimaryButton={() => {
          openAppStore();
        }}
        onPressOutSecondaryButton={() => {
          hideModal();
          setLoadingProcess(null);
          setCheckFlags((previous) => ({
            ...previous,
            isVersionChecked: true,
          }));
        }}
      />
    );
  }, [openAppStore, hideModal, setLoadingProcess, setCheckFlags]);
  const RequiredVersionUpModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="アプリの必須バージョンアップがあります"
        id={modalInitialList.RequieredVersionUp}
        text={`アプリをバージョンアップするまで利用できません
アプリを終了して${Platform.OS === 'ios' ? 'TestFlight' : 'Apptester'}で最新バージョンをインストールしてください`}
        hasInput={false}
      />
    );
  }, []);
  const displayInfoText = useMemo(() => {
    return (
      <View style={tw`items-center right-0 left-0 mx-auto`}>
        <AppText style={tw`text-white text-xl`}>
          {/* 必要データ情報をリクエストしています... */}
          {loadingProcess === loadingProcessState.checkAccountLinkage &&
            'ログイン処理中...'}
          {loadingProcess === loadingProcessState.googleSignIn &&
            'Googleアカウントの認証中...'}
          {loadingProcess === loadingProcessState.checkDownloadData &&
            'ダウンロードデータを確認しています...'}
          {loadingProcess === loadingProcessState.initializing &&
            'アプリ初期化中...'}
          {loadingProcess === loadingProcessState.checkVersion &&
            'バージョン確認中...'}
          {(loadingProcess === loadingProcessState.waitingForSetCustomClaims ||
            loadingProcess === loadingProcessState.waitingForSnapshot) &&
            'ユーザデータの確認中...'}
        </AppText>
      </View>
    );
  }, [loadingProcess]);

  // フォーカスが移ったらローディングフラグを立てる
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    console.info('LoadingView focus', summarizeConsoleValue(isFocused));
    if (!isFocused) return;
    setIsLoading(true);
    console.info('ローディングビューのフォーカスが移りました');
  }, [isFocused]);

  return (
    <LoadingBackground>
      {TermsOfUseHalfModal}
      {AccountLinkageHalfModal}
      {AuthenticateDeniedModal}
      {/* TentativeGoogleSignInHalfModal */}
      {signInDeniedModal}
      {ConfirmGradeHalfModal}
      {RecommendedVersionUpModal}
      {RequiredVersionUpModal}
      {DownloadHalfModal}
      {RequireInitialDownloadHalfModal}
      {ConnectionFailedHalfModal}
      {TimeOutHalfModal}
      {DownloadFailedHalfModal}
      {displayInfoText}
      {/* loadingProcess === loadingProcessState.checkAccountLinkage
					? checkAccountLinkageBar
				: null */}
      {loadingProcess === loadingProcessState.downLoadingData
        ? downloadingBar
        : null}
      {loadingProcess === loadingProcessState.askGrade ? AskGradeView : null}
      <View style={tw`flex flex-col absolute right-6 bottom-9`}>
        <AppText style={tw`text-red-500 text-sm`}>{errorMessage}</AppText>
        <AppText
          style={tw`text-white text-sm`}
        >{`ver ${currentAppVersion}`}</AppText>
      </View>
    </LoadingBackground>
  );
};

export default LoadingView;
