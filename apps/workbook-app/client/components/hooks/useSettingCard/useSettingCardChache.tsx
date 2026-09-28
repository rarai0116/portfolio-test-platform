// hooks/useSettingCardCache/useSettingCardCache.tsx
import {useCallback, useEffect} from 'react';
import type {SettingCardData} from '../useGlobalSaveDataContext';
import SettingCardCacheManager from './functionals/settingCardManager';
import type {SettingCardCacheData} from './types';

export const useSettingCardCache = () => {
  const cacheManager = SettingCardCacheManager.getInstance();

  const writeStringCache = useCallback(
    async (
      id: string,
      stringData: {
        categoryString: string;
        otherSettingString: string;
        taskDate?: string;
        deadlineDate?: string;
        titleColor: string;
        borderColor: string;
      },
      sourceCardData: SettingCardData,
    ): Promise<void> => {
      try {
        await cacheManager.writeCache(id, stringData, sourceCardData);
      } catch (error) {
        console.error('Failed to write string cache:', error);
      }
    },
    [cacheManager],
  );

  const readStringCache = useCallback(
    async (
      id: string,
      sourceCardData?: SettingCardData,
    ): Promise<SettingCardCacheData | null> => {
      try {
        return await cacheManager.readCache(id, sourceCardData);
      } catch (error) {
        console.error('Failed to read string cache:', error);
        return null;
      }
    },
    [cacheManager],
  );

  const invalidateStringCache = useCallback(
    async (id: string): Promise<void> => {
      try {
        await cacheManager.invalidateCache(id);
      } catch (error) {
        console.error('Failed to invalidate string cache:', error);
      }
    },
    [cacheManager],
  );

  const clearExpiredCache = useCallback(async (): Promise<void> => {
    try {
      await cacheManager.clearExpiredCache();
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }, [cacheManager]);

  // アプリ起動時に古いキャッシュをクリア
  useEffect(() => {
    clearExpiredCache().catch((error: unknown) => {
      console.error('Error clearing expired cache on startup:', error);
    });
  }, [clearExpiredCache]);

  return {
    writeStringCache,
    readStringCache,
    invalidateStringCache,
    clearExpiredCache,
  };
};
