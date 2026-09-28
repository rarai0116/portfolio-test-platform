import 'expo-dev-client';
import React, {useMemo, useEffect, useState} from 'react';
import {Text, StatusBar, View} from 'react-native';
import Constants from 'expo-constants';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {recordError} from '@react-native-firebase/crashlytics';
import LoadingPage from './components/pages/loadingPage';
import MainPage from './components/pages/mainPage';
import {StorageContextProvider} from './components/hooks/useAsyncStorageContext';
import {GlobalUserSettingContextProvider} from './components/hooks/useGlobalUserSettingContext';
import {ImageAssetContextProvider} from './components/hooks/useImageAssetContext';
import {AuthContextProvider} from './components/hooks/useAuthContext';
import type {RootPagesList} from './types/viewParameter';
import GlobalSaveDataContextProvider from './components/hooks/useGlobalSaveDataContext';
import InitialSettingDataContextProvider from './components/hooks/useInitialSettingDataContext';
import Maintenance from './components/pages/maintenancePage';
import SnapshotManagerProvider from './components/hooks/useSnapshotManagerContext';
import {crashlytics} from './components/functionals/firebase';
//  if (Platform.OS !== 'web') SplashScreen.preventAutoHideAsync();
const Stack = createNativeStackNavigator<RootPagesList>();
console.info('アプリ実行環境', Constants.expoConfig?.extra?.APP_ENV);
SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.error('App：処理失敗', error);
});

ErrorUtils.setGlobalHandler((error: Error, _isFatal) => {
  recordError(crashlytics, error);
});
type ErrorBoundaryProps = {
  readonly children?: React.ReactNode;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  {hasError: boolean}
> {
  static defaultProps = {
    children: null,
  };

  static getDerivedStateFromError(_error: Error) {
    // エラー発生時にstateを更新
    return {hasError: true};
  }

  state = {hasError: false};

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    recordError(crashlytics, error);
  }

  render() {
    if (this.state.hasError) {
      // フォールバックUI
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <StatusBar barStyle="dark-content" />
          <View>
            <Text>エラーが発生しました。再起動してください。</Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
const RootPages = (props: {readonly onReady: () => void}) => {
  const AppEnv = useMemo(
    () => (Constants.expoConfig?.extra?.APP_ENV ?? 'development') as string,
    [],
  );
  const _options: NativeStackNavigationOptions = useMemo(
    () => ({
      headerShown: false,
      freezeOnBlur: true,
      detatchPreviousScreen: true,
    }),
    [],
  );

  const customTheme = useMemo(() => {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: 'transparent',
      },
    };
  }, []);

  return (
    <NavigationContainer theme={customTheme} onReady={props.onReady}>
      <Stack.Navigator
        initialRouteName={AppEnv === 'test' ? 'MainPage' : 'LoadingPage'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen
          name="LoadingPage"
          component={LoadingPage}
          getId={({params}) => params.userId}
        />
        <Stack.Screen
          name="MainPage"
          component={MainPage}
          getId={({params}) => params.userId}
        />
        <Stack.Screen
          name="Maintenance"
          component={Maintenance}
          getId={({params}) => params.userId}
        />
        {/* <Stack.Screen
					name="TestPage"
					component={__TestPage}
					options={options}
				/> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  const [isResetApp, setIsResetApp] = useState<boolean>(false);
  // ロード終了後にスプラッシュスクリーンを非表示にする

  useEffect(() => {
    console.log('アプリリセット状態変更', isResetApp);
    if (isResetApp) setIsResetApp(false);
  }, [isResetApp]);
  const _TestErrorComponent = () => {
    throw new Error('ErrorBoundaryテスト用エラー');
  };

  return (
    <ErrorBoundary>
      {/* <TestErrorComponent /> */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <StorageContextProvider>
            <AuthContextProvider
              isResetApp={isResetApp}
              setIsResetApp={setIsResetApp}
            >
              {!isResetApp && (
                <GlobalUserSettingContextProvider>
                  <GlobalSaveDataContextProvider>
                    <SnapshotManagerProvider>
                      <InitialSettingDataContextProvider>
                        <ImageAssetContextProvider>
                          <RootPages
                            onReady={() => {
                              SplashScreen.hide();
                            }}
                          />
                        </ImageAssetContextProvider>
                      </InitialSettingDataContextProvider>
                    </SnapshotManagerProvider>
                  </GlobalSaveDataContextProvider>
                </GlobalUserSettingContextProvider>
              )}
            </AuthContextProvider>
          </StorageContextProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
