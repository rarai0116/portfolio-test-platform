// hooks/useSettingCardCache/SettingCardCacheManager.ts
import {openDatabaseSync, type SQLiteDatabase} from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type {SettingCardCacheData} from '../types';

type NormalizedValue =
  | string
  | number
  | boolean
  | null
  | NormalizedObject
  | NormalizedValue[];
interface NormalizedObject {
  [key: string]: NormalizedValue;
}

class SettingCardCacheManager {
  public static getInstance(): SettingCardCacheManager {
    SettingCardCacheManager.instance ??= new SettingCardCacheManager();

    return SettingCardCacheManager.instance;
  }

  private static instance: SettingCardCacheManager;
  private readonly db: SQLiteDatabase;
  private readonly memoryCache = new Map<string, SettingCardCacheData>();
  private readonly TABLE_NAME = 'setting_card_cache';
  private readonly CACHE_PREFIX = 'scc_'; // setting_card_cache_

  private constructor() {
    this.db = openDatabaseSync('settingCardCache.db');
    this.initializeDatabase();
  }

  public async writeCache(
    id: string,
    cacheData: Omit<SettingCardCacheData, 'id' | 'lastUpdated' | 'dataHash'>,
    sourceData: any,
  ): Promise<void> {
    const cacheKey = this.getCacheKey(id);
    const now = Date.now();
    const dataHash = await this.generateDataHash(sourceData);

    const fullCacheData: SettingCardCacheData = {
      ...cacheData,
      id,
      lastUpdated: now,
      dataHash,
    };

    try {
      // メモリキャッシュを先に更新（高速アクセス用）
      this.memoryCache.set(cacheKey, fullCacheData);

      // データベースに非同期で書き込み
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${this.TABLE_NAME}
         (cache_key, category_string, other_setting_string, task_date, deadline_date, title_color, border_color, last_updated, data_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cacheKey,
          cacheData.categoryString,
          cacheData.otherSettingString,
          cacheData.taskDate ?? null,
          cacheData.deadlineDate ?? null,
          cacheData.titleColor,
          cacheData.borderColor,
          now,
          dataHash,
        ],
      );
    } catch (error) {
      console.error('Cache write failed:', error);
      // メモリキャッシュからも削除
      this.memoryCache.delete(cacheKey);
    }
  }

  public async readCache(
    id: string,
    sourceData?: any,
  ): Promise<SettingCardCacheData | null> {
    const cacheKey = this.getCacheKey(id);

    try {
      // 1. メモリキャッシュから高速読み込み
      const memoryResult = this.memoryCache.get(cacheKey);
      const dataHash = await this.generateDataHash(sourceData);
      if (memoryResult) {
        // データ整合性チェック
        if (sourceData && dataHash === memoryResult.dataHash) {
          return memoryResult;
        } else if (!sourceData) {
          return memoryResult;
        }
      }

      // 2. データベースから読み込み
      const result = await this.db.getFirstAsync<{
        cache_key: string;
        category_string: string;
        other_setting_string: string;
        task_date: string | null;
        deadline_date: string | null;
        title_color: string;
        border_color: string;
        last_updated: number;
        data_hash: string;
      }>(`SELECT * FROM ${this.TABLE_NAME} WHERE cache_key = ?`, [cacheKey]);

      if (!result) return null;

      const cacheData: SettingCardCacheData = {
        id,
        categoryString: result.category_string,
        otherSettingString: result.other_setting_string,
        taskDate: result.task_date ?? undefined,
        deadlineDate: result.deadline_date ?? undefined,
        titleColor: result.title_color,
        borderColor: result.border_color,
        lastUpdated: result.last_updated,
        dataHash: result.data_hash,
      };

      // データ整合性チェック
      if (sourceData && dataHash !== cacheData.dataHash) {
        // キャッシュが古い場合は削除
        await this.invalidateCache(id);
        return null;
      }

      // メモリキャッシュに保存
      this.memoryCache.set(cacheKey, cacheData);
      return cacheData;
    } catch (error) {
      console.error('Cache read failed:', error);
      return null;
    }
  }

  public async invalidateCache(id: string): Promise<void> {
    const cacheKey = this.getCacheKey(id);

    try {
      // メモリキャッシュから削除
      this.memoryCache.delete(cacheKey);

      // データベースから削除
      await this.db.runAsync(
        `DELETE FROM ${this.TABLE_NAME} WHERE cache_key = ?`,
        [cacheKey],
      );
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  public async clearExpiredCache(
    maxAge: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const cutoffTime = Date.now() - maxAge;

    try {
      await this.db.runAsync(
        `DELETE FROM ${this.TABLE_NAME} WHERE last_updated < ?`,
        [cutoffTime],
      );

      // メモリキャッシュからも削除
      for (const [key, data] of this.memoryCache.entries()) {
        if (data.lastUpdated < cutoffTime) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Clear expired cache failed:', error);
    }
  }

  private initializeDatabase(): void {
    try {
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
          cache_key TEXT PRIMARY KEY,
          category_string TEXT NOT NULL,
          other_setting_string TEXT NOT NULL,
          task_date TEXT,
          deadline_date TEXT,
          title_color TEXT NOT NULL,
          border_color TEXT NOT NULL,
          last_updated INTEGER NOT NULL,
          data_hash TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_last_updated ON ${this.TABLE_NAME}(last_updated);
      `);
    } catch (error) {
      console.error('Database initialization failed:', error);
    }
  }

  private getCacheKey(id: string): string {
    return `${this.CACHE_PREFIX}${id}`;
  }

  private normalizeObject(obj: unknown): NormalizedValue {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeObject(item));
    }

    // より具体的な型ガード
    if (this.isRecord(obj)) {
      const normalized: NormalizedObject = {};
      const sortedKeys = Object.keys(obj).sort();

      for (const key of sortedKeys) {
        normalized[key] = this.normalizeObject(obj[key]);
      }

      return normalized;
    }

    // プリミティブ値の場合
    if (
      typeof obj === 'string' ||
      typeof obj === 'number' ||
      typeof obj === 'boolean'
    ) {
      return obj;
    }

    // その他の型は文字列化
    return String(obj);
  }

  // 型ガード関数を追加
  private isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === '[object Object]'
    );
  }

  private async generateDataHash(data: any): Promise<string> {
    try {
      // オブジェクトのキーを安定的にソートしてからJSON化
      const normalizedData = this.normalizeObject(data);
      const jsonString = JSON.stringify(normalizedData);

      // Expo Cryptoを使用してSHA-256ハッシュを生成
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        jsonString,
        {encoding: Crypto.CryptoEncoding.HEX},
      );

      // 最初の16文字を返す（キャッシュキーとして使用）
      return digest.slice(0, 16);
    } catch (error) {
      console.error('Hash generation failed:', error);
      // フォールバック: タイムスタンプベースのハッシュ
      return Date.now().toString(16).padStart(16, '0');
    }
  }
}

export default SettingCardCacheManager;
