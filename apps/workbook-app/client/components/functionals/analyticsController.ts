import {now} from '@functionals/timeManager';
import {logEvent} from '@react-native-firebase/analytics';
import {analytics} from './firebase';
/**
 * エラーをGoogle Analyticsに送信する関数
 * @param errorName エラーの種類・名前
 * @param errorMessage エラーの詳細メッセージ
 * @param additionalData 追加のパラメータ（オプション）
 */
export const logErrorToAnalytics = (
  errorName: string,
  errorMessage: string,
  screenName?: string,
  additionalData?: Record<string, string | number | boolean>,
) => {
  try {
    // カスタムイベントとしてエラーを記録
    logEvent(analytics, 'app_error', {
      error_name: errorName,
      error_message: errorMessage,
      screen: screenName ?? 'unknown',
      user_action: additionalData?.action ?? 'unknown',
      timestamp: now.toDate().toISOString(),
      ...additionalData,
    }).catch((error: unknown) => {
      console.error('Analytics へのエラー送信に失敗:', error);
    });

    // 例外としても記録
    logEvent(analytics, 'exception', {
      description: `${errorName}: ${errorMessage}`,
      fatal: additionalData?.fatal === 'true',
    }).catch((error: unknown) => {
      console.error('Analytics への例外送信に失敗:', error);
    });

    console.error('エラーを Analytics に送信しました');
  } catch (analyticsError) {
    console.error('Analytics へのエラー送信に失敗:', analyticsError);
  }
};
