// hooks/useSettingCardCache/types.ts
export type SettingCardCacheData = {
  id: string;
  categoryString: string;
  otherSettingString: string;
  taskDate?: string;
  deadlineDate?: string;
  titleColor: string;
  borderColor: string;
  lastUpdated: number; // タイムスタンプ
  dataHash: string; // データの整合性チェック用
};

export type CacheKey = {
  id: string;
  prefix: 'setting_card_cache';
};
