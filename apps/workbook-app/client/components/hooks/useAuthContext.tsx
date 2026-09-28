import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {createContext, useState, useMemo, useCallback, useEffect} from 'react';
import type * as FirebaseAuthTypes from '@react-native-firebase/auth';
import {
  signInWithCredential,
  signInWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut,
  getIdTokenResult,
  GoogleAuthProvider,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  type SignInResponse,
  type SignInSilentlyResponse,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import type * as FirebaseFunctionsTypes from '@react-native-firebase/functions';
import {httpsCallable} from '@react-native-firebase/functions';
import {logEvent} from '@react-native-firebase/analytics';
import app, {functions, analytics} from '../functionals/firebase';
import {resolveMockAccount} from '../functionals/mockAccounts';

type AuthContextObject = {
  isAuthenticated: boolean;
  loginUser: FirebaseAuthTypes.User | null;
  loginError: 'success' | 'signinError' | 'firebaseAuthError' | 'none';
  claims: FirebaseAuthTypes.IdTokenResult['claims'] | null;
  googleSignIn: () => Promise<
    | {
        userInfo: SignInResponse;
        credentials: FirebaseAuthTypes.UserCredential | null;
      }
    | {
        userInfo: null;
        credentials: null;
      }
  >;
  silentlySignIn: () => Promise<
    | {
        userInfo: SignInSilentlyResponse;
        credentials: FirebaseAuthTypes.UserCredential | null;
      }
    | {
        userInfo: null;
        credentials: null;
      }
  >;
  googleLogout: () => Promise<void>;
  // APP_ENV=local 専用。模擬アカウントで Auth Emulator にログインする。
  mockSignIn: () => Promise<FirebaseAuthTypes.UserCredential | null>;
  setInitialCustomClaims: (
    grade: string,
  ) => Promise<FirebaseFunctionsTypes.HttpsCallableResult>;
  updateCustomClaims: (
    grade: string,
  ) => Promise<FirebaseFunctionsTypes.HttpsCallableResult>;
  googleAuth: (
    userInfo?: SignInResponse | null,
  ) => Promise<FirebaseAuthTypes.UserCredential | null>;
  asyncCustomClaims: () => Promise<void>;
  isResetApp: boolean;
  setIsResetApp: React.Dispatch<React.SetStateAction<boolean>>;
  // hasNetworkError: boolean;
  // setHasNetworkError: React.Dispatch<React.SetStateAction<boolean>>;
};

type Properties = {
  readonly children: React.ReactNode;
  readonly isResetApp: boolean;
  readonly setIsResetApp: React.Dispatch<React.SetStateAction<boolean>>;
};
// WebBrowser.maybeCompleteAuthSession();
// console.log(Constants.expoConfig?.extra?.WEB_CLIENT_ID);

export const AuthContext = createContext<AuthContextObject>(
  {} as AuthContextObject,
);
const auth = getAuth(app);
export const AuthContextProvider = (properties: Properties) => {
  const [loginError, setLoginError] = useState<
    'success' | 'signinError' | 'firebaseAuthError' | 'none'
  >('none');
  const [loginUser, setLoginUser] = useState<FirebaseAuthTypes.User | null>(
    null,
  );
  const [claims, setClaims] = useState<
    FirebaseAuthTypes.IdTokenResult['claims'] | null
  >(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isResetApp, setIsResetApp] = [
    properties.isResetApp,
    properties.setIsResetApp,
  ];
  //  const [hasNetworkError, setHasNetworkError] = useState<boolean>(false);

  const onAuthStateChangedCallback = useCallback(
    async (user: FirebaseAuthTypes.User | null) => {
      //      console.log('onAuthStateChanged', user);
      if (user) {
        // トークンの強制リフレッシュに失敗した場合(無効な refresh token 等)は
        // ログアウト扱いにする。Emulator 接続時に旧 project の永続セッションが
        // 残っていると INVALID_REFRESH_TOKEN になるため、ここで握りつぶす。
        let result: FirebaseAuthTypes.IdTokenResult;
        try {
          result = await getIdTokenResult(user, true);
        } catch (error: unknown) {
          console.error('getIdTokenResult failed, sign out', error);
          await signOut(auth).catch(() => undefined);
          setClaims(null);
          setLoginUser(null);
          setIsAuthenticated(false);
          return;
        }

        // await setStringDataId('userdata', 'uid', user.uid);

        logEvent(analytics, 'login', {
          method: 'google',
        }).catch((error: unknown) => {
          console.error('logEvent Error', error);
        });
        setClaims(result.claims);
        setLoginUser(user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    },
    [],
  );

  useEffect(() => {
    const hostedDomain = Constants.expoConfig?.extra?.GOOGLE_HOSTED_DOMAIN;
    GoogleSignin.configure({
      webClientId: Constants.expoConfig?.extra?.WEB_CLIENT_ID as string,
      ...(typeof hostedDomain === 'string' && hostedDomain.length > 0
        ? {hostedDomain}
        : {}),
      forceCodeForRefreshToken: true,
      offlineAccess: true,
      // iosClientId: Constants.expoConfig?.extra?.IOS_CLIENT_ID as string,
    });
    const subscriber = onAuthStateChanged(auth, onAuthStateChangedCallback);
    return subscriber; // unsubscribe on unmount
  }, [onAuthStateChangedCallback]);

  const onGoogleLogin = useCallback(async () => {
    try {
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

      return await GoogleSignin.signIn().catch((error: unknown) => {
        console.error('google signin error');
        console.error('onGoogleLogin：処理失敗', error);
        throw new Error('user signin action is failed');
      });
    } catch (error: unknown) {
      console.error('google signin error', error);
      setLoginError('signinError');
      throw new Error('Google Signin Error');
    }
  }, []);

  const googleAuth = useCallback(
    async (userInfo?: SignInResponse | null) => {
      //      if (userInfo) userInfo = await GoogleSignin.getCurrentUser();
      userInfo ??= await onGoogleLogin().catch((error: unknown) => {
        console.error('google signin error', error);
        return null;
      });

      if (!userInfo) return null;
      if (!userInfo.data) return null;
      if (!userInfo.data.idToken) return null;
      const {idToken} = userInfo.data;

      console.log('Googleサインイン成功');

      const googleCredential = GoogleAuthProvider.credential(idToken);
      // Sign-in the user with the credential
      try {
        const result = await signInWithCredential(auth, googleCredential);
        console.log('認証成功');
        return result;
      } catch (error: unknown) {
        console.error('credential error', error);
        // setHasNetworkError(true);
        setLoginError('firebaseAuthError');
        return null;
      }
    },
    [onGoogleLogin],
  );

  const googleSignIn = useCallback(async () => {
    const userInfo = await onGoogleLogin().catch((error: unknown) => {
      console.error('google signin error', error);
      setLoginError('signinError');
      return null;
    });

    if (userInfo) {
      const credentials = await googleAuth(userInfo);
      return {userInfo, credentials};
    }

    return {userInfo, credentials: null};
  }, [onGoogleLogin, googleAuth]);

  const silentlySignIn = useCallback(async () => {
    try {
      if (GoogleSignin.hasPreviousSignIn() && loginUser === null) {
        const userInfo = await GoogleSignin.signInSilently();

        if (userInfo !== undefined && userInfo.type === 'success') {
          const credentials = await googleAuth(userInfo as SignInResponse);

          return {userInfo, credentials};
        }
      }

      return {userInfo: null, credentials: null};
    } catch (error: unknown) {
      console.error('サイレントログイン失敗', error);
      setLoginError('signinError');
    }

    return {userInfo: null, credentials: null};
  }, [googleAuth, loginUser]);

  const googleLogout = useCallback(async () => {
    try {
      console.log('ログアウト');
      // local では Google セッションが無いため GoogleSignin.signOut はスキップする。
      if (Constants.expoConfig?.extra?.APP_ENV !== 'local') {
        await GoogleSignin.signOut();
      }

      await signOut(auth);
    } catch (error: unknown) {
      console.error('ログアウト失敗', error);
    }
  }, []);

  const mockSignIn = useCallback(async () => {
    const appEnv = Constants.expoConfig?.extra?.APP_ENV as string | undefined;
    if (appEnv !== 'local') {
      throw new Error('mockSignIn は APP_ENV=local でのみ利用できます');
    }

    const account = resolveMockAccount(
      Constants.expoConfig?.extra?.MOCK_ACCOUNT as string | undefined,
    );

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        account.email,
        account.password,
      );
      console.log('模擬アカウントでログインしました');
      return result;
    } catch (error: unknown) {
      console.error('模擬ログイン失敗', error);
      setLoginError('firebaseAuthError');
      return null;
    }
  }, []);

  const setInitialCustomClaims = useCallback(
    async (grade: string) => {
      try {
        // メールアドレスの先頭にt-がつく場合はteacherロールを付与
        const role = loginUser?.email?.startsWith('t-') ? 'teacher' : 'student';
        const {currentUser} = getAuth(app);
        if (!currentUser) {
          throw new Error('ログインユーザーが存在しません');
        }

        const _idToken = await getIdTokenResult(currentUser, true); // getAuth(app).currentUser?.getIdTokenResult(true);
        void [getAuth(app).currentUser];
        const result = await httpsCallable(
          functions,
          'initilizeCustomClaims',
        )({
          grade,
          role,
        });
        logEvent(analytics, 'sign_up', {
          method: 'google',
        }).catch((error: unknown) => {
          console.error('logEvent Error', error);
        });
        const refreshedToken = await getIdTokenResult(currentUser, true);
        setClaims(refreshedToken.claims);

        return result;
      } catch (error: unknown) {
        console.error('setInitialCustomClaims failed', error);
        throw error;
      }
    },

    [loginUser],
  );
  const asyncCustomClaims = useCallback(async () => {
    if (loginUser) {
      const result = await getIdTokenResult(loginUser, true);
      setClaims(result.claims);
    } else {
      throw new Error('ログインしていません');
    }
  }, [loginUser]);
  const updateCustomClaims = useCallback(
    async (grade: string) => {
      try {
        if (loginUser) {
          const result = await httpsCallable(
            functions,
            'updateCustomClaims',
          )({
            claims: {
              grade,
            },
          }).catch((error: unknown) => {
            console.error('updateCustomClaims：処理失敗', error);
            throw new Error('updateCustomClaims Error');
          });
          console.log(
            'updateCustomClaims Result',
            summarizeConsoleValue(result),
          );
          await asyncCustomClaims().catch((error: unknown) => {
            console.error('updateCustomClaims：処理失敗', error);
            throw new Error('カスタムクレームの同期に失敗しました');
          });
          return result;
        } else {
          throw new Error('ログインしていません');
        }
      } catch (error: unknown) {
        console.error('updateCustomClaims：処理失敗', error);
        throw new Error('カスタムクレームの更新に失敗しました');
      }
    },
    [loginUser, asyncCustomClaims],
  );
  const value = useMemo(() => {
    return {
      isAuthenticated,
      loginUser,
      loginError,
      claims,
      googleSignIn,
      googleLogout,
      mockSignIn,
      silentlySignIn,
      setInitialCustomClaims,
      updateCustomClaims,
      googleAuth,
      asyncCustomClaims,
      isResetApp,
      setIsResetApp,
      // hasNetworkError,
      // setHasNetworkError,
    };
  }, [
    isAuthenticated,
    loginUser,
    loginError,
    claims,
    googleSignIn,
    googleLogout,
    mockSignIn,
    silentlySignIn,
    setInitialCustomClaims,
    updateCustomClaims,
    googleAuth,
    asyncCustomClaims,
    isResetApp,
    setIsResetApp,
    // hasNetworkError,
    // setHasNetworkError,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {properties.children}
    </AuthContext.Provider>
  );
};
