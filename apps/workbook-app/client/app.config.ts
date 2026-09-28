import type {ConfigContext} from 'expo/config';
import withPodfileUpdate from './app.plugin.js';
import type {ApiInfo} from './types/commonUnionType.js';

// Import SecondGradeData from './web/html/lib/secondGrade-export.json';

// バージョン情報 EAS BUILD時に変更する
const MajorVersion = '1.8.0';
// Androidバージョン情報
const versionCode = 22;
// バージョン情報 EAS UPDATE時に変更する(1〜)
const patchVersion = '1';
// Ios ビルドNumber
const buildNumber = '2';

const isEasBuild = process.env.EAS_BUILD === 'true';
const isCredentialFreeCi = process.env.CI === 'true' && !isEasBuild;

const requiredForEasBuild = (name: string, value: string | undefined) => {
  if (isEasBuild && !value) {
    throw new Error(
      `EAS Build に必要な環境変数 ${name} が設定されていません。`,
    );
  }
  return value;
};

const initializeApiInfo: (appEnv: string) => ApiInfo = (appEnv) => {
  const environmentValue =
    appEnv === 'production'
      ? process.env.WEB_CLIENT_ID
      : process.env.DEV_WEB_CLIENT_ID;
  if (isCredentialFreeCi) {
    return {WEB_CLIENT_ID: environmentValue ?? ''};
  }

  if (isEasBuild) {
    return {
      WEB_CLIENT_ID:
        requiredForEasBuild(
          appEnv === 'production' ? 'WEB_CLIENT_ID' : 'DEV_WEB_CLIENT_ID',
          environmentValue,
        ) ?? '',
    };
  }

  if (!environmentValue) {
    let apiInfo: ApiInfo | undefined;
    try {
      apiInfo = require('./sensitive/apiInfo.js') as ApiInfo;
      return apiInfo;
    } catch {
      apiInfo = undefined;
    }
  }

  return {
    /*
    API_KEY: process.env.API_KEY ?? '',
    AUTH_DOMAIN: process.env.AUTH_DOMAIN ?? '',
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    PROJECT_ID: process.env.PROJECT_ID ?? '',
    STORAGE_BUCKET: process.env.STORAGE_BUCKET ?? '',
    MESSAGING_SENDER_ID: process.env.MESSAGING_SENDER_ID ?? '',
    APP_ID: process.env.APP_ID ?? '',
    MEASUREMENT_ID: process.env.MESUREMENT_ID ?? '',
    IOS_CLIENT_ID: process.env.IOS_CLIENT_ID ?? '',
    ANDROID_CLIENT_ID: process.env.ANDROID_CLIENT_ID ?? '',
    REDIRECT_URI: process.env.REDIRECT_URI ?? '',
    */
    WEB_CLIENT_ID: environmentValue ?? '',
  };
};

export default ({config}: ConfigContext) => {
  const APP_ENV = process.env.APP_ENV ?? 'development';
  if (!['development', 'local', 'staging', 'production'].includes(APP_ENV)) {
    throw new Error(`未対応の APP_ENV: ${APP_ENV}`);
  }
  const apiInfo = initializeApiInfo(APP_ENV);
  const SecondGradeData = [{}];
  const currentVersion = `${MajorVersion}.${patchVersion}`;
  //  Console.log(APP_ENV, process.env.GOOGLE_SERVICES_INFO);

  const {
    icon,
    iosGoogleServicesFile,
    androidGoogleServicesFile,
    bundleIdentifier,
    name,
  } = (() => {
    if (APP_ENV === 'production') {
      return {
        icon: './assets/icon.png',
        iosGoogleServicesFile:
          requiredForEasBuild(
            'GOOGLE_SERVICES_INFO',
            process.env.GOOGLE_SERVICES_INFO,
          ) ?? './sensitive/production/GoogleService-Info.plist',
        androidGoogleServicesFile:
          requiredForEasBuild(
            'GOOGLE_SERVICES_JSON',
            process.env.GOOGLE_SERVICES_JSON,
          ) ?? './sensitive/production/google-services.json',
        bundleIdentifier: 'com.demoApp.demoworkbook',
        name: 'デモ校問題集',
      };
    }

    // Staging
    if (APP_ENV === 'staging') {
      return {
        icon: './assets/icon_staging.png',
        iosGoogleServicesFile:
          requiredForEasBuild(
            'DEV_GOOGLE_SERVICES_INFO',
            process.env.DEV_GOOGLE_SERVICES_INFO,
          ) ?? './sensitive/development/GoogleService-Info.plist',
        androidGoogleServicesFile:
          requiredForEasBuild(
            'DEV_GOOGLE_SERVICES_JSON',
            process.env.DEV_GOOGLE_SERVICES_JSON,
          ) ?? './sensitive/development/google-services.json',
        bundleIdentifier: 'dev.demoApp.demoworkbook',
        name: 'デモ校問題集staging',
      };
    }

    // Other(development / local)
    // local は dev の google-services をそのまま流用し、接続先だけ実行時に
    // Emulator へ向け替える(connectEmulators.ts)。
    return {
      icon: './assets/icon.png',
      iosGoogleServicesFile:
        requiredForEasBuild(
          'DEV_GOOGLE_SERVICES_INFO',
          process.env.DEV_GOOGLE_SERVICES_INFO,
        ) ?? './sensitive/development/GoogleService-Info.plist',
      androidGoogleServicesFile:
        requiredForEasBuild(
          'DEV_GOOGLE_SERVICES_JSON',
          process.env.DEV_GOOGLE_SERVICES_JSON,
        ) ?? './sensitive/development/google-services.json',
      bundleIdentifier: 'dev.demoApp.demoworkbook',
      name: 'デモ校問題集dev',
    };
  })();
  return {
    ...config,
    name,
    icon,
    version: MajorVersion,
    ios: {
      ...config.ios,
      bundleIdentifier,
      buildNumber,
      ...(isCredentialFreeCi
        ? {}
        : {googleServicesFile: iosGoogleServicesFile}),
    },
    android: {
      ...config.android,
      versionCode,
      ...(isCredentialFreeCi
        ? {}
        : {googleServicesFile: androidGoogleServicesFile}),
      package: bundleIdentifier,
      adaptiveIcon: {
        foregroundImage: icon,
        backgroundColor: '#FFFFFF',
      },
    },
    extra: {
      APP_ENV,
      GOOGLE_HOSTED_DOMAIN: requiredForEasBuild(
        'GOOGLE_HOSTED_DOMAIN',
        process.env.GOOGLE_HOSTED_DOMAIN,
      ),
      // local のときだけ Firebase Emulator に接続する。dev/staging/prod は従来通り。
      USE_FIREBASE_EMULATOR: APP_ENV === 'local',
      FIREBASE_EMULATOR_HOST:
        process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? '10.0.2.2',
      // local の模擬アカウント指定(student|teacher|admin)。
      MOCK_ACCOUNT: process.env.EXPO_PUBLIC_MOCK_ACCOUNT ?? 'student',
      IS_CONSOLE_LOG: process.env.IS_CONS === 'false',
      SECOND_GRADE_DATA: SecondGradeData ?? {},
      CURRENT_VERSION: currentVersion,
      ...apiInfo,
      eas: {
        projectId: '00000000-0000-4000-8000-000000000000',
      },
    },
    plugins: [
      '@react-native-google-signin/google-signin',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/crashlytics',
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '16.4',
            useFrameworks: 'static',
            forceStaticLinking: [
              'RNFBApp',
              'RNFBAnalytics',
              'RNFBAuth',
              'RNFBCrashlytics',
              'RNFBStorage',
            ],
          },
        },
      ],
      [withPodfileUpdate, 'podfileUpdater'],
      'expo-asset',
      'expo-font',
      'expo-status-bar',
      'expo-sqlite',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          image: './assets/splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
        },
      ],
      [
        'react-native-edge-to-edge',
        {
          android: {
            parentTheme: 'Default',
            enforceNavigationBarContrast: false,
          },
        },
      ],
    ],
    runtimeVersion: MajorVersion,
    /*
    Cli: {
      appVersionSource: 'native', // 追加
    },
    */
  };
};
