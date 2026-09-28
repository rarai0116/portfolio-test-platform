// hooks/useBackgroundPreloader.tsx
import {useCallback, useRef, useEffect} from 'react';
import {AppState} from 'react-native'; // InteractionManager を削除

type PreloadTask = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  execute: () => Promise<void>;
};

class BackgroundPreloader {
  private readonly taskQueue: PreloadTask[] = [];
  private isProcessing = false;
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;
  private processingIdleId: number | null = null; // 追加: idleのキャンセル用

  addTask(task: PreloadTask) {
    const insertIndex = this.taskQueue.findIndex(
      (existingTask) =>
        this.getPriorityValue(existingTask.priority) <
        this.getPriorityValue(task.priority),
    );

    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.scheduleProcessing();
  }

  handleAppStateChange(nextAppState: string) {
    if (nextAppState === 'active' && this.taskQueue.length > 0) {
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    // 既存のスケジュールをクリア（重複実行を防止）
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
    if (
      this.processingIdleId != null &&
      typeof cancelIdleCallback === 'function'
    ) {
      cancelIdleCallback(this.processingIdleId);
      this.processingIdleId = null;
    }

    if (typeof requestIdleCallback === 'function') {
      this.processingIdleId = requestIdleCallback(
        () => {
          this.processingIdleId = null;
          this.processQueue();
        },
        {timeout: 10_000},
      );
    } else {
      this.processingTimeout = setTimeout(() => {
        this.processingTimeout = null;
        this.processQueue();
      }, 100);
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.info('🔄 バックグラウンドプリロード開始');

    try {
      while (this.taskQueue.length > 0) {
        if (AppState.currentState !== 'active') {
          console.info('⏸️ アプリ非アクティブのためプリロード一時停止');
          break;
        }

        const task = this.taskQueue.shift();
        if (!task) break;

        try {
          await task.execute();
        } catch (error) {
          console.error(`❌ ${task.id} プリロードエラー:`, error);
        }

        await new Promise<void>((resolve) => {
          if (typeof requestIdleCallback === 'undefined') {
            // React NativeやrequestIdleCallbackが未対応の環境での代替手段
            setTimeout(resolve, 50);
          } else {
            requestIdleCallback(
              (deadline: IdleDeadline) => {
                // アイドル時間が残っているかチェック（オプション）
                if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
                  resolve();
                } else {
                  // 時間が足りない場合は短い遅延で再試行
                  setTimeout(resolve, 10);
                }
              },
              {timeout: 1000},
            );
          }
        });
      }
    } finally {
      this.isProcessing = false;
      console.info('🏁 バックグラウンドプリロード終了');

      if (this.taskQueue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': {
        return 3;
      }

      case 'medium': {
        return 2;
      }

      case 'low': {
        return 1;
      }
    }
  }
}

// Hookとして使用
export const useBackgroundPreloader = () => {
  const preloaderRef = useRef<BackgroundPreloader | null>(null);

  preloaderRef.current ??= new BackgroundPreloader();

  const addPreloadTask = useCallback((task: PreloadTask) => {
    preloaderRef.current?.addTask(task);
  }, []);

  useEffect(() => {
    const preloader = preloaderRef.current;
    if (!preloader) return;

    const handleAppStateChange = (nextAppState: string) => {
      preloader.handleAppStateChange(nextAppState);
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription?.remove();
    };
  }, []);

  return {addPreloadTask};
};
