import {getFunctions} from '@react-native-firebase/functions';
import {getApp} from '@react-native-firebase/app';
import {getAnalytics} from '@react-native-firebase/analytics';
import {getCrashlytics} from '@react-native-firebase/crashlytics';
import {connectFirebaseEmulators} from './connectEmulators';

const app = getApp();
export const functions = getFunctions(app, 'asia-northeast1');
export const analytics = getAnalytics(app);
export const crashlytics = getCrashlytics();

// APP_ENV=local のときだけ Emulator に接続する(各 controller の利用前に一度だけ実行)。
connectFirebaseEmulators();

export default app;
