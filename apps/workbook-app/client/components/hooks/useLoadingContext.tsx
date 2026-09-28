import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {Platform} from 'react-native';
import {doc, getDoc, Timestamp} from '@react-native-firebase/firestore';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import type {SignInResponse} from '@react-native-google-signin/google-signin';
import type * as FirebaseAuthTypes from '@react-native-firebase/auth';
import {getJapanTime} from '../functionals/japanTime';
import {getDownloadTotalSize} from '../functionals/downloadSize';
import {CommonActions} from '@react-navigation/native';
import {
  type QuestionGradeType,
  gradeCommonStates,
} from '../../types/commonUnionType';
import {
  type AssetList,
  checkTargetsStorageList,
  getLocalTestData,
  getTestData,
} from '../functionals/realtimeDatabaseController';
import {type RootPagesProps, allScreenIdList} from '../../types/viewParameter';
import firestoreController from '../functionals/firestoreController';
import {AuthContext} from './useAuthContext';
import useUpdateEffect from './useUpdateEffect';
import {StorageContext} from './useAsyncStorageContext';
import {
  GlobalUserSettingContext,
  type GradeLastUpdate,
} from './useGlobalUserSettingContext';
import {ImageAssetContext} from './useImageAssetContext';
import {ModalManagerContext} from './useModalManagerContext';
import {GlobalSaveDataContext, type TestData} from './useGlobalSaveDataContext';
import {SnapshotManagerContext} from './useSnapshotManagerContext';

export type LoadingPageProps = RootPagesProps<'LoadingPage'>;

type DownloadInfo = {
  serverAssetList: AssetList;
  updateAssetList: AssetList;
  deleteAssetList: AssetList;
  updateSize: number;
  testSize: number;
  sumSize: number;
};
type CheckFlagsType = {
  isInitialized: boolean;
  isSignIn: boolean;
  isAuthenticated: boolean;
  hasCustomClaims: boolean;
  isVersionChecked: boolean;
  isAgreedTermsOfUse: boolean;
  isChoicedGrade: boolean;
  hasSnapshot: boolean;
  hasDownloadInfo: boolean;
  isDownloaded: boolean;
  hasLocalData: boolean;
};

type LoadingContextObject = {
  loadingProcess: LoadingProcessStateType;
  setLoadingProcess: React.Dispatch<
    React.SetStateAction<LoadingProcessStateType>
  >;
  setIsUserCanceled: React.Dispatch<React.SetStateAction<boolean>>;
  isUserCanceled: boolean;
  setGrade: (grade?: QuestionGradeType) => void;
  grade: QuestionGradeType | undefined;
  requiredDownloadData: DownloadStatesType[];
  choicedGrade: QuestionGradeType | null;
  setChoicedGrade: React.Dispatch<
    React.SetStateAction<QuestionGradeType | null>
  >;
  downloadInfo: DownloadInfo;
  agreeTermsOfUse: () => Promise<void>;
  disagreeTermsOfUse: () => void;
  requestGoogleSignIn: () => Promise<{
    userInfo: SignInResponse | null;
    credentials: FirebaseAuthTypes.UserCredential | null;
  }>;
  reAuthentication: () => Promise<void>;
  signOut: () => Promise<void>;
  choiceGradeProcess: (grade: QuestionGradeType) => Promise<void>;
  startDownloading: () => Promise<void>;
  cancelDownloading: () => void;
  downloadingProcess: () => Promise<void>;
  pageNavigation: LoadingPageProps['navigation'];
  openAppStore: () => void;
  setCheckFlags: React.Dispatch<React.SetStateAction<CheckFlagsType>>;
  currentAppVersion: string;
};

export const modalInitialList = {
  TermsOfUse: 'TermsOfUse',
  AccountLinkage: 'AccountLinkage',
  TentativeGoogleSignIn: 'TentativeGoogleSignIn',
  ConfirmGrade: 'ConfirmGrade',
  RequieredVersionUp: 'RequieredVersionUp',
  RecommendedVersionUp: 'RecommendedVersionUp',
  RequestDownloadData: 'RequestDownloadData',
  RequireInitialDownload: 'RequireInitialDownload',
  AuthenticationDenied: 'AuthenticationDenied',
  SignInDenied: 'SignInDenied',
  DownloadFailed: 'DownloadFailed',
  ConnectionFailed: 'ConnectionFailed',
  TimeOut: 'TimeOut',
};

export const LoadingContext = createContext<LoadingContextObject>(
  {} as LoadingContextObject,
);

type Props = {
  readonly children: ReactNode;
  readonly navigation: LoadingPageProps['navigation'];
};

export const loadingProcessState = {
  initializing: '初期化処理中',
  showTermsOfUse: '利用規約表示',
  checkVersion: 'アプリバージョンチェック中',
  askVersionUp: 'バージョンアップ確認',
  checkAccountLinkage: 'アカウント連携がされているか確認',
  askAccountLinkage: 'アカウント連携要求',
  openAppstore: 'アプリストアを開く',
  waitingForSetCustomClaims: 'カスタムクレームの設定待ち',
  waitingForSnapshot: 'スナップショットの設定待ち',
  askGrade: '級選択画面',
  confirmGrade: '選択した級の確認',
  googleSignIn: 'Googleアカウントサインイン',
  getGlobalSnapshot: 'サインインデータダウンロード中',
  checkDownloadData: 'ダウンロードデータ有無の確認',
  askDownloadData: 'データダウンロードの可否',
  downLoadingData: 'データダウンロード中',
  requireInitialDownload: '初回ダウンロード必須確認',
  moveToQuestionPage: '問題ページへ移動',
  AuthenticationDenied: '認証エラー',
  connectionFailed: '不明な接続エラー',
  timeOut: 'タイムアウト',
  getLocalData: 'ローカルデータ取得中',
  checkZipDownload: 'zipダウンロードの可否確認',
  forceCallMainProcess: '強制的にメインプロセスを呼び出す',
  null: null,
} as const;

export type LoadingProcessStateType =
  (typeof loadingProcessState)[keyof typeof loadingProcessState];

const downloadStates = {
  html: 'html',
  assets: 'assets',
  test: 'test',
} as const;
type DownloadStatesType = (typeof downloadStates)[keyof typeof downloadStates];

/**
 * @module useLoadingContext
 * @desc ローディング画面の状態管理
 * @param props
 * @returns
 */
const LoadingContextProvider = (props: Props) => {
  const {getBoolData, getTimeStampData, setTimeStampData, setBoolData} =
    useContext(StorageContext);
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo>({
    serverAssetList: {},
    updateAssetList: {},
    deleteAssetList: {},
    updateSize: 0,
    testSize: 0,
    sumSize: 0,
  });
  const {
    loginUser,
    claims,
    isAuthenticated,
    googleSignIn,
    mockSignIn,
    silentlySignIn,
    setInitialCustomClaims,
    updateCustomClaims,
    loginError,
    googleAuth,
    googleLogout,
    asyncCustomClaims,
    // hasNetworkError,
  } = useContext(AuthContext);
  const {
    firstGradeLastUpdate,
    secondGradeLastUpdate,
    grade,
    setGrade,
    setIsZipDownloadRequired,
    setIsLoading,
    isOffline,
    applyPendingDailyLog,
  } = useContext(GlobalUserSettingContext);
  const {hasSnapshot, userSnapshotListenSetUp} = useContext(
    SnapshotManagerContext,
  );
  const {
    setDownloadImageCaches,
    assetDownloadedSize,
    setDownloadList,
    localAssetList,
    setLocalAssetList,
    downloadZip,
    setLoadingBarPercent,
    isDownloadFailed,
    deletePngFiles,
  } = useContext(ImageAssetContext);
  const {setTestDataList} = useContext(GlobalSaveDataContext);

  const [checkFlags, setCheckFlags] = useState<CheckFlagsType>({
    isInitialized: false,
    isSignIn: false,
    isAuthenticated: false,
    hasCustomClaims: false,
    isVersionChecked: false,
    isAgreedTermsOfUse: false,
    isChoicedGrade: false,
    hasSnapshot: false,
    hasDownloadInfo: false,
    isDownloaded: false,
    hasLocalData: false,
  });
  // ナビゲーション
  const pageNavigation = useMemo(() => props.navigation, [props.navigation]);
  // ローディングプロセスの管理
  const [loadingProcess, setLoadingProcess] =
    useState<LoadingProcessStateType>(null);
  const [requiredDownloadData, _setRequiredDownloadData] = useState<
    DownloadStatesType[]
  >([]); // アプリ内キャッシュデータの有無
  const [isUserCanceled, setIsUserCanceled] = useState<boolean>(false);
  // const [grade, setGrade] = useState<QuestionGradeType | undefined>(undefined);
  /*	const [loadingBarPercent, setLoadingBarPercent] =
		useState<number | null>(null);
*/
  const [choicedGrade, setChoicedGrade] = useState<QuestionGradeType | null>(
    null,
  );
  const [serverUpdateTimeStamp, setServerUpdateTimeStamp] =
    useState<GradeLastUpdate | null>(null);
  // HalfModalの管理
  const {showModal, hideModal, activeModal} = useContext(ModalManagerContext);

  // ダウンロード状態
  const [downLoadByte, setDownLoadByte] = useState<number>(0);

  // 起動時処理
  const initializeProcess = useCallback(async () => {
    if (checkFlags.isInitialized) {
      setLoadingProcess(null);
      return;
    }

    console.info('firstProcess');
    // 利用規約の同意を確認
    // 現在利用規約ができていないのでできるまでスキップ
    const agreedTermsOfUse = true; // (await getBoolData('agreedTermsOfUse')) ?? false;
    // ログインの有無を確認
    const {userInfo: _userInfo, credentials: _credentials} =
      await silentlySignIn().catch(
        (error: unknown): {userInfo: null; credentials: null} => {
          if (typeof error === 'string') {
            console.error('サイレントログインエラー', error);
          } else if (error instanceof Error) {
            console.error(
              'サイレントログインエラー',
              summarizeConsoleValue(error.message),
            );
          } else {
            console.error('サイレントログインエラー');
          }

          return {userInfo: null, credentials: null};
        },
      );
    /*
    if (userInfo && !credentials){
      // ネットワークエラーのため再度ログインを試みる
      console.log('ネットワークエラーのため再度ログインを試みる', userInfo, credentials);
      showModal(modalInitialList.ConnectionFailed);
      return;
    }
    */
    setCheckFlags((previous) => ({
      ...previous,
      isInitialized: true,
      isAgreedTermsOfUse: agreedTermsOfUse,
    }));
    setLoadingProcess(null);
  }, [checkFlags, silentlySignIn]);

  type AppVersion = {
    recommended: string | undefined;
    required: string | undefined;
  };

  const currentAppVersion = useMemo(
    () =>
      (Constants.expoConfig?.extra?.CURRENT_VERSION ??
        'バージョン取得エラー') as string,
    [],
  );

  // バージョンチェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const versionCheckProcess = useCallback(async () => {
    console.info(
      'versionCheckProcess',
      summarizeConsoleValue(currentAppVersion),
    );
    // アプリバージョンの取得
    // バージョンチェック
    const appVersionData = await getDoc(
      doc(firestoreController, 'metadata', 'appVersion'),
    );
    if (!appVersionData.exists) return;
    const appVersion = appVersionData.data() as AppVersion | undefined;
    if (!appVersion) return;
    const recommendedVersion = appVersion.recommended ?? '0';
    const requiredVersion = appVersion.required ?? '0';

    if (requiredVersion > currentAppVersion) {
      showModal(modalInitialList.RequieredVersionUp);
    } else if (recommendedVersion > currentAppVersion) {
      showModal(modalInitialList.RecommendedVersionUp);
    } else {
      if (loadingProcess === null) {
        setLoadingProcess(loadingProcessState.forceCallMainProcess);
      } else {
        setLoadingProcess(null);
      }

      setCheckFlags((previous) => ({
        ...previous,
        isVersionChecked: true,
      }));
    }
  }, [setCheckFlags, loadingProcess, showModal, currentAppVersion]);

  // アプリストアを開く
  const openAppStore = useCallback(async () => {
    const hostUrl =
      'https://appdistribution.firebase.google.com/testerapps/1:000000000000:android:0000000000000000000000';
    const supportedHostpage = await Linking.canOpenURL(hostUrl);
    if (Platform.OS === 'ios') {
      const url = 'itms-beta://beta.itunes.apple.com/v1/app/DEMO000000';
      const supportedTestFlight = await Linking.canOpenURL(url);
      if (supportedTestFlight) {
        Linking.openURL(url).catch((error: unknown) => {
          console.error('openAppStore：処理失敗', error);
        });
      } else if (supportedHostpage) {
        Linking.openURL(hostUrl).catch((error: unknown) => {
          console.error('openAppStore：処理失敗', error);
        });
      }
    }

    if (Platform.OS === 'android') {
      const url = 'market://details?id=com.ryugakuapp';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        Linking.openURL(url).catch((error: unknown) => {
          console.error('openAppStore：処理失敗', error);
        });
      } else if (supportedHostpage) {
        Linking.openURL(hostUrl).catch((error: unknown) => {
          console.error('openAppStore：処理失敗', error);
        });
      }
    }
  }, []);

  // 級をcommonStyleに変換
  const commonGrade = useMemo(() => {
    return grade === '1級'
      ? gradeCommonStates.firstGrade
      : gradeCommonStates.secondGrade;
  }, [grade]);
  // 利用規約表示
  const _termsOfUseProcess = useCallback(() => {
    console.info('termsOfUseProcess');
    if (activeModal !== modalInitialList.TermsOfUse)
      showModal(modalInitialList.TermsOfUse);
  }, [showModal, activeModal]);

  // 利用規約受諾
  const agreeTermsOfUse = useCallback(async () => {
    try {
      await setBoolData('agreedTermsOfUse', true);
      console.info(
        'agreedTermsOfUse',
        summarizeConsoleValue(await getBoolData('agreedTermsOfUse')),
      );
      setCheckFlags((previous) => ({
        ...previous,
        isAgreedTermsOfUse: true,
      }));
      setLoadingProcess(null);
    } catch {
      throw new Error('ストレージへの保存に失敗しました');
    }
  }, [setBoolData, getBoolData]);

  // 利用規約拒否
  const disagreeTermsOfUse = useCallback(() => {
    hideModal();
    setLoadingProcess(null);
    setCheckFlags((previous) => ({
      ...previous,
      isAgreedTermsOfUse: false,
    }));
  }, [hideModal]);

  // サインイン処理
  const signInProcess = useCallback(async () => {
    if (loginUser && isAuthenticated) {
      setCheckFlags((previous) => ({
        ...previous,
        isSignIn: true,
        isAuthenticated: true,
        isInitialized: true,
      }));
      setLoadingProcess(loadingProcessState.forceCallMainProcess);
    } else {
      showModal(modalInitialList.AccountLinkage);
    }
  }, [showModal, isAuthenticated, loginUser]);
  // 認証失敗
  const authenticationFailedProcess = useCallback(() => {
    console.error('authenticationFailedProcess');
    showModal(modalInitialList.AuthenticationDenied);
  }, [showModal]);
  // googleサインイン
  const requestGoogleSignIn = useCallback(async () => {
    try {
      // APP_ENV=local では Google Sign-In の代わりに模擬アカウントで
      // Auth Emulator にログインする(UI は同じ Google ボタンを流用)。
      if (Constants.expoConfig?.extra?.APP_ENV === 'local') {
        const credentials = await mockSignIn();

        if (credentials === null) {
          throw new Error('認証に失敗しました');
        }

        return {userInfo: null, credentials};
      }

      const {userInfo, credentials} = await googleSignIn().catch(
        (error: unknown) => {
          console.error('requestGoogleSignIn：処理失敗', error);
          throw new Error('サインインに失敗しました');
        },
      );

      if (credentials === null) {
        throw new Error('認証に失敗しました');
      }

      return {userInfo, credentials};
      /*
      setCheckFlags((previous) => ({
        ...previous,
        isSignIn: userInfo !== null,
        //        isAuthenticated: credentials !== null,
      }));
      */
      // setLoadingProcess(null);
    } catch (error: unknown) {
      console.error('requestGoogleSignIn：処理失敗', error);
      throw new Error('サインインに失敗しました');
    }
  }, [googleSignIn, mockSignIn]);

  // 再認証
  const reAuthentication = useCallback(async () => {
    console.info('reAuthenticationProcess');
    try {
      const credentials = await googleAuth();
      if (credentials === null) authenticationFailedProcess();
      setCheckFlags((previous) => ({
        ...previous,
        isAuthenticated: credentials !== null,
      }));
      setLoadingProcess(null);
    } catch (error: unknown) {
      console.error('reAuthentication：処理失敗', error);
      setLoadingProcess(null);
    }
  }, [googleAuth, authenticationFailedProcess]);
  // サインアウト
  const signOut = useCallback(async () => {
    try {
      await googleLogout();
      setCheckFlags((previous) => ({
        ...previous,
        isSignIn: false,
        isAuthenticated: false,
      }));
      setLoadingProcess(null);
    } catch (error: unknown) {
      console.error('signOut：処理失敗', error);
      setLoadingProcess(null);
    }
  }, [googleLogout]);

  // 級選択
  const choiceGradeProcess = useCallback(
    async (grade: QuestionGradeType) => {
      console.info('selectGradeProcess');
      try {
        await updateCustomClaims(grade);
        await asyncCustomClaims().catch((error: unknown) => {
          console.error('choiceGradeProcess：処理失敗', error);
          throw new Error('カスタムクレームの更新に失敗しました');
        });
        setGrade(grade);
        setCheckFlags((previous) => ({
          ...previous,
          isChoicedGrade: true,
        }));
      } catch (error: unknown) {
        console.error('choiceGradeProcess：処理失敗', error);
        throw new Error('カスタムクレームの設定に失敗しました');
      }
    },
    [updateCustomClaims, asyncCustomClaims, setGrade],
  );

  // 登録完了前に別の進行通知が来ても、購読を重複させない。
  const snapshotSetupInProgressRef = useRef(false);

  // スナップショットの取得
  const getGlobalSnapshot = useCallback(async () => {
    if (snapshotSetupInProgressRef.current) return;
    try {
      if (hasSnapshot) {
        //        setLoadingProcess(null);
      } else {
        snapshotSetupInProgressRef.current = true;
        let processFlag = false;
        userSnapshotListenSetUp()
          .then((result) => {
            processFlag = true;
            if (result === 'failed') {
              // 認証エラー。認証フェイズに差し戻す
              console.error('認証エラー');
              setCheckFlags((previous) => ({
                ...previous,
                isSignIn: false,
              }));
              setLoadingProcess(null);
            }

            if (result === 'error') {
              throw new Error(
                'スナップショットの取得時に不明なエラーが発生しました',
              );
            }
          })
          .catch((error: unknown) => {
            console.error('getGlobalSnapshot Error', error);
            throw new Error(
              'スナップショットの取得時に不明なエラーが発生しました',
            );
          })
          .finally(() => {
            snapshotSetupInProgressRef.current = false;
          });
        // 5000msでタイムアウト
        setTimeout(() => {
          if (
            loadingProcess === loadingProcessState.getGlobalSnapshot &&
            !processFlag
          ) {
            processFlag = true;
            throw new Error('Session Time Out');
          }
        }, 5000);
      }
    } catch (error: unknown) {
      console.error('スナップショットの取得に失敗しました', error);
      // オフラインの場合
      if (isOffline) showModal(modalInitialList.ConnectionFailed);
      // タイムアウトの場合
      if (error instanceof Error && error.message === 'Session Time Out') {
        showModal(modalInitialList.TimeOut);
      }
    }
  }, [
    hasSnapshot,
    userSnapshotListenSetUp,
    isOffline,
    showModal,
    loadingProcess,
  ]);

  // ダウンロードする必要のあるデータの有無をチェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: ログ削除前の依存関係を維持し、処理の再実行条件を変更しない。
  const checkRequireDownloadData = useCallback(async () => {
    // pngファイルが存在する場合は削除
    await deletePngFiles().catch((error: unknown) => {
      console.error('checkRequireDownloadData：処理失敗', error);
      console.error('pngファイルの削除に失敗しました');
    });
    // AsyncStorageの選択級のhtml/asset/testを取得
    const zeroTimeStamp = Timestamp.fromMillis(0);
    const assetsUpdate =
      (await getTimeStampData(`${commonGrade}/assets`)) ?? zeroTimeStamp;
    const testUpdate =
      (await getTimeStampData(`${commonGrade}/test`)) ?? zeroTimeStamp;
    // console.log('htmlUpdate', htmlUpdate);

    // データが更新されているかチェック
    const requiredDownloadData: DownloadStatesType[] = [];
    const selectedLastupdate =
      grade === '1級' ? firstGradeLastUpdate! : secondGradeLastUpdate!;
    setServerUpdateTimeStamp(selectedLastupdate);

    if (selectedLastupdate !== null && typeof selectedLastupdate === 'object') {
      for (const [key, value] of Object.entries(selectedLastupdate)) {
        switch (key) {
          /*
				case 'html':
					console.log(htmlUpdate);
					if (htmlUpdate.seconds < value.seconds)
						requiredDownloadData.push('html');
					break;
				*/
          case 'assets': {
            if (assetsUpdate.seconds < value.seconds)
              requiredDownloadData.push('assets');
            break;
          }

          case 'test': {
            if (testUpdate.seconds < value.seconds)
              requiredDownloadData.push('test');
            break;
          }

          default: {
            break;
          }
        }
      }
    } else {
      console.error('データがnullまたはオブジェクトではありません');
    }

    return requiredDownloadData;
  }, [
    grade,
    hasSnapshot,
    commonGrade,
    firstGradeLastUpdate,
    getTimeStampData,
    secondGradeLastUpdate,
    deletePngFiles,
  ]);

  // ダウンロード対象のリストアップと計算
  const downloadDataListUp = useCallback(
    async (requiredDownloadData: DownloadStatesType[]) => {
      const thisYear = getJapanTime().year();
      // test
      // テストデータは年数×70kbとして計算(1級の場合はさらに1.3倍)
      // 今年をNumberで取得
      // const testSize = (thisYear - 2010) * 70_000 * 1.3 * 2;
      const testSize = requiredDownloadData.includes('test')
        ? grade === '1級'
          ? (thisYear - 2010) * 70_000 * 1.3 * 2
          : (thisYear - 2009) * 70_000 * 2
        : 0;
      // html・assets
      // ローカルのアセットリストを取得

      const {serverAssetList, updateAssetList, deleteAssetList, updateSize} =
        await checkTargetsStorageList(commonGrade, localAssetList!);

      console.info(
        'ダウンロード対象アセット抽出（件数）',
        Object.keys(updateAssetList).length,
      );

      console.info('ダウンロード対象アセット容量（bytes）', updateSize);
      setDownloadList(updateAssetList);
      return {
        serverAssetList,
        updateAssetList,
        deleteAssetList,
        updateSize,
        testSize,
        sumSize: getDownloadTotalSize(updateSize, testSize),
      };
    },
    [grade, localAssetList, commonGrade, setDownloadList],
  );

  // ダウンロードチェック処理
  const downloadCheckProcess = useCallback(async () => {
    console.info('downloadCheckProcess');
    try {
      const requiredDownloadData = await checkRequireDownloadData();

      // ダウンロードする必要のあるデータがあればダウンロード
      const info = await downloadDataListUp(requiredDownloadData);
      console.info('ダウンロード内容', summarizeConsoleValue(info));
      setDownloadInfo(info);
      if (info.sumSize > 0) {
        setCheckFlags((previous) => ({
          ...previous,
          hasDownloadInfo: true,
          isDownloaded: false,
        }));
      } else {
        setCheckFlags((previous) => ({
          ...previous,
          hasDownloadInfo: true,
          isDownloaded: true,
        }));
      }

      setLoadingProcess(null);
    } catch (error: unknown) {
      console.error('downloadCheckProcess：処理失敗', error);
      setLoadingProcess(null);
      showModal(modalInitialList.ConnectionFailed);
    }
  }, [checkRequireDownloadData, downloadDataListUp, showModal]);

  // ダウンロード処理キャンセル
  const cancelDownloading = useCallback(() => {
    setLoadingProcess(null);
  }, []);

  // ローディングバーのパーセントを更新
  useUpdateEffect(() => {
    // console.log('★ +', downLoadByte);
    setLoadingBarPercent(
      (_previous) => (downLoadByte / downloadInfo.sumSize) * 100,
    );
  }, [downLoadByte]);

  // アセットのダウンロードサイズが更新された際の処理
  useUpdateEffect(() => {
    // console.log('+', assetDownloadedSize);
    setDownLoadByte((_previous) => assetDownloadedSize);
  }, [assetDownloadedSize]);
  // テストデータのダウンロード処理
  const testDataDownload = useCallback(
    async (isUpdate: boolean) => {
      try {
        const testData = isUpdate
          ? await getTestData(commonGrade)
          : await getLocalTestData(commonGrade);
        console.info(
          'ダウンロードしたtestData',
          summarizeConsoleValue(testData),
        );
        const newTestDataList = testData.val() as TestData[];
        await setTestDataList(newTestDataList);

        if (isUpdate)
          await setTimeStampData(
            `${commonGrade}/test`,
            serverUpdateTimeStamp!.test,
          );
        setDownLoadByte(100);
      } catch (error: unknown) {
        console.error('testDataDownload：処理失敗', error);
        throw new Error('テストデータのダウンロードに失敗しました');
      }
    },
    [commonGrade, setTestDataList, serverUpdateTimeStamp, setTimeStampData],
  );

  // Zipダウンロード
  const zipDownloadProcess = useCallback(async () => {
    console.info(
      'zipDownloadProcess',
      summarizeConsoleValue(downloadInfo.updateSize > 100 * 1024 * 1024),
    );
    if (downloadInfo.updateSize > 100 * 1024 * 1024) {
      // 100MB以上の場合はzipダウンロードを促す
      setIsZipDownloadRequired(true);
      // ダウンロードバーを表示
      setLoadingProcess(loadingProcessState.downLoadingData);
      console.log('★★★Zipダウンロード開始★★★');
      setLoadingBarPercent(0);
      // ダウンロードURIを取得
      const downloadist = await downloadZip(commonGrade).catch(
        (error: unknown) => {
          console.error('zipDownloadProcess：処理失敗', error);
          throw new Error('zipダウンロードに失敗しました');
        },
      );
      return downloadist;
    }
  }, [
    downloadInfo,
    commonGrade,
    downloadZip,
    setIsZipDownloadRequired,
    setLoadingBarPercent,
  ]);

  const assetDataDownload = useCallback(async () => {
    const zipAssetList = await zipDownloadProcess().catch((error: unknown) => {
      console.error('assetDataDownload：処理失敗', error);
      throw new Error('zipダウンロードに失敗しました');
    });

    // assets
    setLoadingBarPercent(0);
    if (zipAssetList) setDownloadList(zipAssetList);
    const {successes, errors} = await setDownloadImageCaches(
      zipAssetList,
    ).catch((error: unknown) => {
      console.error('assetDataDownload：処理失敗', error);
      throw new Error('アセットのダウンロードに失敗しました');
    });

    console.error('errors', errors);
    const downloadedAssets = zipAssetList
      ? [...Object.values(zipAssetList), ...successes]
      : successes;
    const newAssetList = downloadedAssets.reduce<AssetList>((acc, asset) => {
      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      return {...acc, [asset.name]: asset};
    }, localAssetList!);
    setLocalAssetList((previous) => {
      return {...previous, ...newAssetList};
    });
    /*
		await setAssetLisInStorage(newAssetList).catch((error: unknown) => {
			console.log(error);
			throw new Error('アセットリストの更新に失敗しました');
		});
		*/

    await setTimeStampData(
      `${commonGrade}/assets`,
      serverUpdateTimeStamp!.assets,
    ).catch((error: unknown) => {
      console.error('assetDataDownload：処理失敗', error);
      throw new Error('アセット時刻の更新に失敗しました');
    });

    return true;
  }, [
    commonGrade,
    localAssetList,
    serverUpdateTimeStamp,
    setDownloadImageCaches,
    setDownloadList,
    setLoadingBarPercent,
    setLocalAssetList,
    setTimeStampData,
    zipDownloadProcess,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const downloadingProcess = useCallback(async () => {
    try {
      const {testSize, updateSize} = downloadInfo;

      if (updateSize > 0) {
        const asset = await assetDataDownload().catch((error: unknown) => {
          console.error('downloadingProcess：処理失敗', error);
          throw new Error('アセットのダウンロードに失敗しました');
        });
        if (!asset)
          throw new Error('アセットのダウンロードに何らかの原因で失敗しました');
      }

      await testDataDownload(testSize > 0).catch((error: unknown) => {
        console.error('downloadingProcess：処理失敗', error);
        throw new Error('テストデータのダウンロードに失敗しました');
      });

      // すべて成功した場合は、次の処理へ
      console.info('ダウンロード完了');
      setCheckFlags((previous) => ({
        ...previous,
        isDownloaded: true,
        testDownloaded: true,
      }));
      setLoadingProcess(null);
    } catch (error: unknown) {
      console.error('downloadingProcess：処理失敗', error);
      // エラーが出た場合、ユーザーに通知して再ダウンロードを促す
      showModal(modalInitialList.DownloadFailed);
    }
  }, [
    downloadInfo,
    assetDataDownload,
    testDataDownload,
    setCheckFlags,
    showModal,
  ]);

  // ダウンロード開始
  const startDownloading = useCallback(async () => {
    try {
      const {updateAssetList} = downloadInfo;
      //			console.log(updateAssetList);
      // ダウンロードバーを表示
      setLoadingProcess(loadingProcessState.downLoadingData);
      console.log('アセットダウンロード開始');
      setDownLoadByte(0);
      setDownloadList(updateAssetList);
      // ダウンロード開始(順次ダウンロード)
      await downloadingProcess();
    } catch (error: unknown) {
      console.error('startDownloading：処理失敗', error);
      setLoadingProcess(null);
      throw new Error('ダウンロードに失敗しました');
    }
    // ダウンロード完了後、ダウンロードバーを非表示
  }, [downloadInfo, downloadingProcess, setDownloadList]);

  const loadLocalDataProcess = useCallback(async () => {
    const testData = await getLocalTestData(commonGrade).catch(
      (error: unknown) => {
        console.error('loadLocalDataProcess：処理失敗', error);
        throw new Error('テストデータの取得に失敗しました');
      },
    );
    console.info('loadLocalDataProcess', summarizeConsoleValue(testData));
    await setTestDataList(testData.val() as TestData[]);
    setCheckFlags((previous) => ({
      ...previous,
      hasLocalData: true,
    }));
    setLoadingProcess(null);
  }, [commonGrade, setTestDataList]);

  const checkCustomClaims = useCallback(async () => {
    if (claims && !checkFlags.hasCustomClaims) {
      const hasGrade = claims.grade !== undefined && claims.grade !== '';
      const hasRole = claims.role !== undefined && claims.role !== '';
      if (hasGrade) {
        setGrade(claims.grade as QuestionGradeType);
      }

      if (!hasRole) {
        // gradeとroleが設定されていない場合、CustomClaimsを初期化
        await setInitialCustomClaims('').catch((error: unknown) => {
          console.error('カスタムクレームの初期設定に失敗しました', error);
          throw error;
        });
      }

      // スナップショットの確認
      setCheckFlags((previous) => ({
        ...previous,
        isChoicedGrade: hasGrade,
        hasCustomClaims: true,
      }));

      if (loadingProcess !== loadingProcessState.askGrade) {
        if (loadingProcess === null) {
          setLoadingProcess(loadingProcessState.forceCallMainProcess);
        } else {
          setLoadingProcess(null);
        }
      }
    }
  }, [claims, checkFlags, setInitialCustomClaims, loadingProcess, setGrade]);

  const _preloadViews = useCallback(() => {
    console.info('preloadViews');
    // 画面遷移のプリロード
    pageNavigation.preload('MainPage', {
      userId: allScreenIdList.MainPage,
      screen: 'Tab',
      params: {
        userId: allScreenIdList.Tab,
        screen: 'QuestionTab',
        params: {
          userId: allScreenIdList.QuestionTab,
          screen: 'Home',
          params: {
            userId: allScreenIdList.Home,
          },
        },
      },
    });
  }, [pageNavigation]);

  // メイン処理
  // チェックリスト方式で処理を進める
  // すべての処理が終了した場合のみメインページへ遷移
  const mainProcessManager = useCallback(async () => {
    // 初期化
    if (!checkFlags.isInitialized) {
      await initializeProcess();
      return;
    }

    // バージョンチェック
    if (!checkFlags.isVersionChecked) {
      await versionCheckProcess();
      return;
    }

    // 利用規約表示
    /*
    if (!checkFlags.isAgreedTermsOfUse) {
      termsOfUseProcess();
      return;
    }
    */

    // サインイン
    if (!checkFlags.isSignIn) {
      await signInProcess();
      return;
    }

    // 認証
    /*
    if (!checkFlags.isAuthenticated) {
      authenticationProcess();
      return;
    }
      */

    // カスタムクレーム
    if (!checkFlags.hasCustomClaims) {
      await checkCustomClaims();
      return;
    }

    // 級選択
    if (!checkFlags.isChoicedGrade) {
      setLoadingProcess(loadingProcessState.askGrade);
      return;
    }

    // スナップショット
    if (!checkFlags.hasSnapshot) {
      await getGlobalSnapshot();
      return;
    }

    // ダウンロードチェック
    if (!checkFlags.hasDownloadInfo) {
      await downloadCheckProcess();
      return;
    }

    // ダウンロード確認
    if (!checkFlags.isDownloaded) {
      showModal(modalInitialList.RequestDownloadData);
      return;
    }

    // ローカルデータの取得

    if (!checkFlags.hasLocalData) {
      await loadLocalDataProcess();
      return;
    }

    // すべての処理が終了した場合、メインページへ遷移
    setLoadingProcess(loadingProcessState.moveToQuestionPage);
    setIsLoading(false);
    pageNavigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainPage',
            params: {
              userId: allScreenIdList.MainPage,
              screen: 'Tab',
              params: {
                userId: allScreenIdList.Tab,
                screen: 'QuestionTab',
                params: {
                  userId: allScreenIdList.QuestionTab,
                  screen: 'Home',
                  params: {
                    userId: allScreenIdList.Home,
                  },
                },
              },
            },
          },
        ],
      }),
    );
  }, [
    pageNavigation,
    checkFlags,
    // authenticationProcess,
    checkCustomClaims,
    downloadCheckProcess,
    initializeProcess,
    loadLocalDataProcess,
    showModal,
    signInProcess,
    //    termsOfUseProcess,
    versionCheckProcess,
    getGlobalSnapshot,
    setIsLoading,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    console.log('ローディングフェーズ変更', loadingProcess);
    if (
      loadingProcess === null ||
      loadingProcess === loadingProcessState.forceCallMainProcess
    ) {
      // 初期化
      if (!checkFlags.isInitialized) {
        setLoadingProcess(loadingProcessState.initializing);
        return;
      }

      // バージョンチェック
      if (!checkFlags.isVersionChecked) {
        //        setLoadingProcess(loadingProcessState.checkVersion);
        mainProcessManager().catch((error: unknown) => {
          console.error('LoadingContextProvider：処理失敗', error);
        });
        return;
      }

      // 利用規約表示
      /*
      if (!checkFlags.isAgreedTermsOfUse) {
        setLoadingProcess(loadingProcessState.showTermsOfUse);
        return;
      }
      */

      // サインイン
      if (!checkFlags.isSignIn) {
        setLoadingProcess(loadingProcessState.googleSignIn);
        return;
      }

      // 認証
      /*
    if (!checkFlags.isAuthenticated) {
      setLoadingProcess(loadingProcessState.AuthenticationDenied);
      return;
    }
      */

      // カスタムクレーム

      if (!checkFlags.hasCustomClaims) {
        mainProcessManager().catch((error: unknown) => {
          console.error('LoadingContextProvider：処理失敗', error);
        });

        setLoadingProcess(loadingProcessState.waitingForSetCustomClaims);
        return;
      }

      // 級選択
      if (!checkFlags.isChoicedGrade) {
        setLoadingProcess(loadingProcessState.askGrade); // 級選択viewを表示
        return;
      }

      // スナップショット
      if (!checkFlags.hasSnapshot) {
        setLoadingProcess(loadingProcessState.waitingForSnapshot);
        return;
      }

      // ダウンロードチェック
      if (!checkFlags.hasDownloadInfo) {
        setLoadingProcess(loadingProcessState.checkDownloadData);
        return;
      }

      // ダウンロード確認
      if (!checkFlags.isDownloaded) {
        setLoadingProcess(loadingProcessState.askDownloadData);
        return;
      }

      // ローカルデータの取得

      if (!checkFlags.hasLocalData) {
        setLoadingProcess(loadingProcessState.getLocalData);
        return;
      }
    }

    // ダウンロード中
    if (loadingProcess === loadingProcessState.downLoadingData) return;

    mainProcessManager().catch((error: unknown) => {
      console.error('LoadingContextProvider：処理失敗', error);
    });
  }, [loadingProcess]);

  // ローディングプロセスごとの処理
  /*
  useEffect(() => {
    // メインページへ遷移
    if (loadingProcess === loadingProcessState.moveToQuestionPage) {
      setIsLoading(false);
      pageNavigation.navigate('MainPage', {
        userId: allScreenIdList.MainPage,
        screen: 'Tab',
        params: {
          userId: allScreenIdList.Tab,
          screen: 'QuestionTab',
          params: {
            userId: allScreenIdList.QuestionTab,
            screen: 'Home',
            params: {
              userId: allScreenIdList.Home,
            },
          },
        },
      });
    }
  }, [loadingProcess]);
  */

  // ネットワークエラーが発生した場合
  /*
  useUpdateEffect(() => {
    if (hasNetworkError) {
      console.log('ネットワークエラー検出');
      showModal(modalInitialList.ConnectionFailed);
    }
  }, [hasNetworkError]);
  */

  // googleログインがキャンセルされた場合の処理¥
  useUpdateEffect(() => {
    if (
      loadingProcess === loadingProcessState.googleSignIn &&
      loginError === 'signinError'
    ) {
      setLoadingProcess(loadingProcessState.askAccountLinkage);
    }
  }, [loginError]);

  // 認証状態が未認証になった場合、checkFlagsを初期化する
  useUpdateEffect(() => {
    console.log('認証状態変更', isAuthenticated);

    if (!loginUser && !isAuthenticated) {
      console.log('ログアウト');
      setCheckFlags({
        isInitialized: false,
        isSignIn: false,
        isAuthenticated: false,
        hasCustomClaims: false,
        isVersionChecked: false,
        isAgreedTermsOfUse: false,
        isChoicedGrade: false,
        hasSnapshot: false,
        hasDownloadInfo: false,
        isDownloaded: false,
        hasLocalData: false,
      });
      setLoadingProcess(null);
      return;
    }

    if (isAuthenticated && loginUser && !checkFlags.isSignIn)
      setLoadingProcess(null);
    if (isAuthenticated && loginUser && !checkFlags.isAuthenticated)
      setLoadingProcess(null);

    setCheckFlags((previous) => ({
      ...previous,
      isInitialized: true,
      isSignIn: loginUser !== null,
      isAuthenticated,
    }));
  }, [isAuthenticated, loginUser]);

  // CustomClaimsの設定待ち
  /*
  useUpdateEffect(() => {
    if (loadingProcess === loadingProcessState.waitingForSetCustomClaims) {
      checkCustomClaims().catch((error: unknown) => {
        console.log('カスタムクレーム設定エラー', claims, error);
      });
    }
  }, [claims, loadingProcess]);
  */
  // snapshotの設定待機
  useUpdateEffect(() => {
    console.info(
      'スナップショット待機',
      summarizeConsoleValue(loadingProcess),
      summarizeConsoleValue(hasSnapshot),
      summarizeConsoleValue(checkFlags),
    );
    if (hasSnapshot && !checkFlags.hasSnapshot) {
      applyPendingDailyLog().catch((error: unknown) => {
        console.error('applyPendingDailyLog Error', error);
      });
      setCheckFlags((previous) => ({
        ...previous,
        hasSnapshot: true,
      }));
      if (
        loadingProcess === loadingProcessState.waitingForSnapshot ||
        loadingProcess === loadingProcessState.waitingForSetCustomClaims
      )
        setLoadingProcess(null);
    }
  }, [hasSnapshot]);
  // ダウンロード失敗時
  useUpdateEffect(() => {
    // console.log('ダウンロード失敗判定', loadingProcess, isDownloadFailed);
    if (
      loadingProcess === loadingProcessState.downLoadingData &&
      isDownloadFailed
    ) {
      console.error('ダウンロード失敗');
      showModal(modalInitialList.DownloadFailed);
    }
  }, [isDownloadFailed, loadingProcess]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      loadingProcess,
      setLoadingProcess,
      setIsUserCanceled,
      isUserCanceled,
      setGrade,
      grade,
      requiredDownloadData,
      choicedGrade,
      setChoicedGrade,
      downloadInfo,
      agreeTermsOfUse,
      disagreeTermsOfUse,
      requestGoogleSignIn,
      reAuthentication,
      signOut,
      choiceGradeProcess,
      startDownloading,
      cancelDownloading,
      downloadingProcess,
      pageNavigation,
      openAppStore,
      setCheckFlags,
      currentAppVersion,
    };
  }, [
    loadingProcess,
    setLoadingProcess,
    setIsUserCanceled,
    isUserCanceled,
    setGrade,
    grade,
    requiredDownloadData,
    choicedGrade,
    setChoicedGrade,
    downloadInfo,
    agreeTermsOfUse,
    disagreeTermsOfUse,
    requestGoogleSignIn,
    reAuthentication,
    signOut,
    choiceGradeProcess,
    startDownloading,
    cancelDownloading,
    downloadingProcess,
    pageNavigation,
    openAppStore,
    setCheckFlags,
    currentAppVersion,
  ]);

  return (
    <LoadingContext.Provider value={value}>
      {props.children}
    </LoadingContext.Provider>
  );
};

export default LoadingContextProvider;
