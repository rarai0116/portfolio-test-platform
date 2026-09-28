import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {
  createContext,
  useState,
  useMemo,
  useContext,
  useCallback,
  type ReactNode,
} from 'react';
import Storage from 'react-native-storage';
import AsyncStorage from 'expo-sqlite/kv-store';
import PromisePool from '@supercharge/promise-pool/dist';
import * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {Timestamp} from '@react-native-firebase/firestore';
import type {AssetList, Asset} from '../functionals/realtimeDatabaseController';
import {
  createDailyLogId,
  type DailyLog,
} from '../functionals/firestoreController';
import {
  createPendingStorageId,
  pendingDailyLogDataKey,
  pendingDailyLogDataV2Key,
  revivePendingDailyLog,
  type PendingDailyLog,
} from '../functionals/pendingDailyLog';
import type {
  SettingCardDataMap,
  SettingCardData,
  TestPlayData,
} from './useGlobalSaveDataContext';
import useUpdateEffect from './useUpdateEffect';

export type StorageContextObject = {
  readData: (key: string) => Promise<StorageData>;
  storeData: (key: string, value: any) => Promise<unknown>;
  getBoolData: (key: string) => Promise<boolean | null>;
  getNumberData: (key: string) => Promise<number | null>;
  getStringData: (key: string) => Promise<string | null>;
  getStringArrayData: (key: string) => Promise<string[] | null>;
  getStringDataId: (key: string, id: string) => Promise<string | null>;
  getNumberArrayData: (key: string) => Promise<number[] | null>;
  getAssetData: (id: string) => Promise<Asset | null>;
  getAssetLisInStorage: () => Promise<AssetList | null>;
  getSettingCardDataMap: (key: string) => Promise<SettingCardDataMap | null>;
  getSettingCardData: (key: string) => Promise<SettingCardData | null>;
  getTestPlayData: (key: string) => Promise<TestPlayData | null>;
  getDailyLogData: (key: string) => Promise<DailyLog | null>;
  setBoolData: (key: string, value: boolean) => Promise<unknown>;
  setStringData: (key: string, value: string) => Promise<unknown>;
  setStringDataId: (key: string, id: string, value: string) => Promise<string>;
  setNumberData: (key: string, value: number) => Promise<unknown>;
  setStringArrayData: (key: string, value: string[]) => Promise<unknown>;
  setNumberArrayData: (key: string, value: number[]) => Promise<unknown>;
  setAssetData: (id: string, value: Asset) => Promise<unknown>;
  setAssetLisInStorage: (values: AssetList) => Promise<string>;
  setTestPlayData: (key: string, value: TestPlayData | null) => Promise<string>;
  setSettingCardData: (key: string, value: SettingCardData) => Promise<string>;
  setSettingCardDataMap: (
    key: string,
    value: SettingCardDataMap,
  ) => Promise<string>;
  allDeleteData: () => Promise<unknown>;
  getTimeStampData: (
    key: string,
  ) => Promise<FirebaseFirestoreTypes.Timestamp | null>;
  setTimeStampData: (
    key: string,
    value: FirebaseFirestoreTypes.Timestamp,
  ) => Promise<string>;
  setDailyLogData: (key: string, value: DailyLog) => Promise<string>;
  deleteData: (key: string) => Promise<'success' | 'error'>;
  savePendingDailyLog: (value: PendingDailyLog) => Promise<void>;
  loadPendingDailyLog: (id: string) => Promise<PendingDailyLog | null>;
  listPendingDailyLogs: (uid: string) => Promise<PendingDailyLog[]>;
  deletePendingDailyLog: (id: string) => Promise<void>;
  loadLegacyPendingDailyLog: () => Promise<DailyLog | null>;
  deleteLegacyPendingDailyLog: () => Promise<void>;
};

type Props = {
  readonly children: ReactNode;
};
export const StorageContext = createContext<StorageContextObject>(
  {} as StorageContextObject,
);

export type StorageData =
  | object
  | string
  | number
  | string[]
  | number[]
  | boolean
  | null;

type SaveData = {
  key: string;
  id?: string;
  data: StorageData;
};

export {pendingDailyLogDataKey, pendingDailyLogDataV2Key};

export const StorageContextProvider = (props: Props) => {
  const [keyList, setKeyList] = useState<string[]>([]);
  const AssetTypeRequiredKeys = useMemo(() => {
    return [
      'name',
      'status',
      'size',
      'path',
      'contentType',
      'folder',
      'grade',
      'bucket',
      'generation',
      'updatedAt',
    ];
  }, []);
  const SettingCardTypeRequiredKeys = useMemo(() => {
    return ['id', 'grade', 'settingState', 'questionMode'];
  }, []);
  const TestPlayTypeRequiredKeys = useMemo(() => {
    return [
      'testDataNoList',
      'answerList',
      'selectedAnswerList',
      'currentPlayNo',
      'isFinished',
      'correctAnswerCount',
      'questionCount',
      'durationTime',
      'startAt',
      'endAt',
      'settingCardData',
    ];
  }, []);
  const DailyLogRequiredKeys = useMemo(
    () => [
      'answerList',
      'correctAnswerList',
      'answerIdList',
      'newWeaklyAnswerIdRegisted',
      'newWeaklyAnswerIdUnRegisted',
      'newCorrectlyAnswerIdRegisted',
    ],
    [],
  );

  const storage = useMemo(
    () =>
      new Storage({
        size: 10000, // キーの最大数
        storageBackend: AsyncStorage,
        defaultExpires: null,
        enableCache: true,
      }),
    [],
  );

  // 引数に渡されたデータがstring型で、それがDate型の形式を取っていた場合にtrueを返す
  const isDate = useCallback((string_: unknown) => {
    if (typeof string_ === 'string') {
      const date = new Date(string_);
      if (date.toString() !== 'Invalid Date') {
        return true;
      }
    }

    return false;
  }, []);

  const escapeUnderScore = useCallback((string_: string) => {
    return string_.replaceAll('_', '$[underscore]');
  }, []);

  const unEscapeUnderScore = useCallback((string_: string) => {
    return string_.replaceAll('$[underscore]', '_');
  }, []);

  const storeData = useCallback(
    async (key: string, data: StorageData) => {
      key = escapeUnderScore(key);
      try {
        await storage.save({key, data});
        if (key !== 'keyList') {
          setKeyList((previous) => {
            return [...previous, key].filter((value, index, self) => {
              return self.indexOf(value) === index;
            });
          });
        }

        return 'success' as string;
      } catch {
        return 'error' as string;
      }
    },
    [storage, escapeUnderScore],
  );

  const storeDataId = useCallback(
    async (key: string, id: string, data: StorageData) => {
      try {
        key = escapeUnderScore(key);
        id = escapeUnderScore(id);
        await storage.save({key, id, data});
        return 'success' as string;
      } catch {
        return 'error' as string;
      }
    },
    [storage, escapeUnderScore],
  );

  const readData: (key: string) => Promise<SaveData> = useCallback(
    async (key: string) => {
      key = escapeUnderScore(key);
      const data: SaveData = await storage.load({key});

      return {data, key: unEscapeUnderScore(key)};
    },
    [storage, escapeUnderScore, unEscapeUnderScore],
  );

  const readDataId: (key: string, id: string) => Promise<SaveData> =
    useCallback(
      async (key: string, id: string) => {
        key = escapeUnderScore(key);
        id = escapeUnderScore(id);
        const data: SaveData = await storage.load({key, id});
        return {
          data,
          key: unEscapeUnderScore(key),
          id: unEscapeUnderScore(id),
        };
      },
      [storage, escapeUnderScore, unEscapeUnderScore],
    );

  const getBoolData: (key: string) => Promise<boolean | null> = useCallback(
    async (key: string) => {
      return new Promise((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const {data} = save;
            if (typeof data === 'boolean') {
              resolve(data);
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getBoolData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readData],
  );

  const getNumberData: (key: string) => Promise<number | null> = useCallback(
    async (key: string) => {
      return new Promise((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const {data} = save;
            if (typeof data === 'number') {
              resolve(data);
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getNumberData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readData],
  );

  const getStringData: (key: string) => Promise<string | null> = useCallback(
    async (key: string) => {
      return new Promise((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const {data} = save;
            if (typeof data === 'string') {
              resolve(data);
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getStringData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readData],
  );

  const getStringDataId: (key: string, id: string) => Promise<string | null> =
    useCallback(
      async (key: string, id: string) => {
        return new Promise((resolve, _reject) => {
          readDataId(key, id)
            .then((save) => {
              const {data} = save;
              if (typeof data === 'string') {
                resolve(data);
              }

              resolve(null);
            })
            .catch((error: unknown) => {
              console.error('getStringDataId：処理失敗', error);
              resolve(null);
            });
        });
      },
      [readDataId],
    );

  const getStringArrayData: (key: string) => Promise<string[] | null> =
    useCallback(
      async (key: string) => {
        return new Promise((resolve, _reject) => {
          readData(key)
            .then((save) => {
              const {data} = save;
              if (
                Array.isArray(data) &&
                data.every((item) => typeof item === 'string')
              ) {
                return data;
              }

              return null;
            })
            .catch((error: unknown) => {
              console.error('getStringArrayData：処理失敗', error);
              resolve(null);
            });
        });
      },
      [readData],
    );

  const getNumberArrayData: (key: string) => Promise<number[] | null> =
    useCallback(
      async (key: string) => {
        return new Promise((resolve, _reject) => {
          readData(key)
            .then((save) => {
              const {data} = save;
              if (
                Array.isArray(data) &&
                data.every((item) => typeof item === 'number')
              ) {
                resolve(data as number[]);
              }

              resolve(null);
            })
            .catch((error: unknown) => {
              console.error('getNumberArrayData：処理失敗', error);
              resolve(null);
            });
        });
      },
      [readData],
    );

  const getAssetData: (key: string) => Promise<Asset | null> = useCallback(
    async (id: string) => {
      return new Promise((resolve, _reject) => {
        readDataId('assets/', id)
          .then((save) => {
            const {data} = save;
            if (data && typeof data === 'object') {
              const object = data as Record<string, any>;
              if (
                AssetTypeRequiredKeys.every((key) => {
                  return object[key] !== undefined;
                })
              ) {
                resolve(data as Asset);
              }
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getAssetData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readDataId, AssetTypeRequiredKeys],
  );

  const getAssetLisInStorage: () => Promise<AssetList | null> =
    useCallback(async () => {
      return new Promise((resolve, _reject) => {
        readData('assets/')
          .then((save) => {
            const {data} = save;
            if (data && typeof data === 'object') {
              const object = data as Record<string, any>;
              for (const [_key, value] of Object.entries(object)) {
                if (
                  value.status !== 'deleted' &&
                  !AssetTypeRequiredKeys.every((key2) => {
                    return value[key2] !== undefined;
                  })
                )
                  throw new Error('AssetListの整合性エラー');
              }
            }

            resolve(data as AssetList);
          })
          .catch((error: unknown) => {
            console.error('getAssetLisInStorage：処理失敗', error);
            resolve(null);
          });
      });
    }, [AssetTypeRequiredKeys, readData]);

  const getTimeStampData: (
    key: string,
  ) => Promise<FirebaseFirestoreTypes.Timestamp | null> = useCallback(
    async (key: string) => {
      return new Promise((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const data = save.data as FirebaseFirestoreTypes.Timestamp;
            if (data.nanoseconds !== undefined && data.seconds !== undefined) {
              resolve(data);
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getTimeStampData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readData],
  );

  const getSettingCardData: (key: string) => Promise<SettingCardData | null> =
    useCallback(
      async (key: string) => {
        let data: SettingCardData | null = null;
        return new Promise((resolve, _reject) => {
          readData(key)
            .then((save) => {
              data = save.data as SettingCardData;
              if (data && typeof data === 'object') {
                // deadlineDateをTimestamp型に変換
                if (data.taskSetting?.deadlineDate) {
                  const newValue = data.taskSetting
                    ? {
                        ...data,
                        taskSetting: {
                          ...data.taskSetting,
                          deadlineDate: new Timestamp(
                            data.taskSetting.deadlineDate.seconds,
                            data.taskSetting.deadlineDate.nanoseconds,
                          ),
                        },
                      }
                    : data;
                  // deadlineDateがTimestamp型がチェック
                  if (newValue.taskSetting?.deadlineDate instanceof Timestamp)
                    throw new Error(
                      'newValue.taskSetting?.deadlineDate is not Timestamp',
                    );

                  const object = newValue as Record<string, any>;
                  if (
                    SettingCardTypeRequiredKeys.every((key2) => {
                      return object[key2] !== undefined;
                    })
                  ) {
                    resolve(newValue);
                  }
                }
                // taskDateがTimestamp型に変換
                else if (data.taskSetting?.taskDate) {
                  const newTaskDate = data.taskSetting.taskDate.map((v) => {
                    return {
                      startAt: new Timestamp(
                        v.startAt.seconds,
                        v.startAt.nanoseconds,
                      ),
                      endAt: new Timestamp(
                        v.startAt.seconds,
                        v.startAt.nanoseconds,
                      ),
                    };
                  });
                  // newTaskDateがTimestamp型かどうかを確認
                  const isValidTimestampArray = newTaskDate.every(
                    (v) =>
                      v.startAt instanceof Timestamp &&
                      v.endAt instanceof Timestamp,
                  );
                  if (!isValidTimestampArray)
                    throw new TypeError(
                      'newTaskDate.taskSetting?.taskDate is not Timestamp',
                    );

                  const newValue: SettingCardData = data.taskSetting
                    ? {
                        ...data,
                        taskSetting: {
                          ...data.taskSetting,
                          taskDate: newTaskDate,
                        },
                      }
                    : data;
                  const object = newValue as Record<string, any>;
                  if (
                    SettingCardTypeRequiredKeys.every((key2) => {
                      return object[key2] !== undefined;
                    })
                  ) {
                    resolve(newValue);
                  }
                } else {
                  const value = data.taskSetting
                    ? {
                        ...data,
                        taskSetting: {
                          ...data.taskSetting,
                          deadlineDate: undefined,
                          taskDate: undefined,
                        },
                      }
                    : data;
                  const object = value as Record<string, any>;
                  if (
                    SettingCardTypeRequiredKeys.every((key2) => {
                      return object[key2] !== undefined;
                    })
                  ) {
                    resolve(value);
                  }
                }
              }

              resolve(null);
            })
            .catch((error: unknown) => {
              console.error('getSettingCardDataError', error);

              resolve(null);
            });
        });
      },
      [readData, SettingCardTypeRequiredKeys],
    );

  const getSettingCardDataMap: (
    key: string,
  ) => Promise<SettingCardDataMap | null> = useCallback(
    async (key: string) => {
      return new Promise((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const data = save.data as SettingCardDataMap;
            if (data && typeof data === 'object') {
              const newValue = Object.entries(data).reduce<SettingCardDataMap>(
                (acc, [key, value]) => {
                  // deadlineDateをTimestamp型に変換
                  if (value.taskSetting?.deadlineDate) {
                    const newEntry = value.taskSetting
                      ? {
                          ...value,
                          taskSetting: {
                            ...value.taskSetting,
                            deadlineDate: new Timestamp(
                              value.taskSetting.deadlineDate.seconds,
                              value.taskSetting.deadlineDate.nanoseconds,
                            ),
                          },
                        }
                      : value;
                    // deadlineDateがTimestamp型かチェック
                    if (
                      !(
                        newEntry.taskSetting?.deadlineDate instanceof
                        FirebaseFirestoreTypes.Timestamp
                      )
                    )
                      throw new Error(
                        'newEntry.taskSetting?.deadlineDate is not Timestamp',
                      );
                    acc[key] = newEntry;
                  }
                  // taskDateをTimestamp型に変換
                  else if (value.taskSetting?.taskDate) {
                    const newTaskDate = value.taskSetting.taskDate.map((v) => {
                      return {
                        startAt: new Timestamp(
                          v.startAt.seconds,
                          v.startAt.nanoseconds,
                        ),
                        endAt: new Timestamp(
                          v.startAt.seconds,
                          v.startAt.nanoseconds,
                        ),
                      };
                    });
                    // taskDateがTimestamp型かチェック
                    const isValidTimestampArray = newTaskDate.every(
                      (v) =>
                        v.startAt instanceof Timestamp &&
                        v.endAt instanceof Timestamp,
                    );
                    if (!isValidTimestampArray)
                      throw new TypeError(
                        'newTaskDate.taskSetting?.taskDate is not Timestamp',
                      );

                    const newEntry = value.taskSetting
                      ? {
                          ...value,
                          taskSetting: {
                            ...value.taskSetting,
                            taskDate: newTaskDate,
                          },
                        }
                      : value;
                    acc[key] = newEntry;
                  } else {
                    const newEntry = value.taskSetting
                      ? {
                          ...value,
                          taskSetting: {
                            ...value.taskSetting,
                            deadlineDate: undefined,
                            taskDate: undefined,
                          },
                        }
                      : value;
                    acc[key] = newEntry;
                  }

                  return acc;
                },
                {},
              );
              const object = newValue as Record<string, any>;
              for (const [_key2, value] of Object.entries(object)) {
                if (
                  SettingCardTypeRequiredKeys.every((key3) => {
                    return value[key3] !== undefined;
                  })
                ) {
                  resolve(newValue);
                }
              }
            }

            resolve(null);
          })
          .catch((_error: unknown) => {
            resolve(null);
          });
      });
    },
    [readData, SettingCardTypeRequiredKeys],
  );

  const getTestPlayData: (key: string) => Promise<TestPlayData | null> =
    useCallback(
      async (key: string) => {
        return new Promise((resolve, _reject) => {
          readData(key)
            .then((save) => {
              const {data} = save;
              // answerlingTestのデータがnullの場合は通す
              if (data === null && key.includes('/answerlingTest')) {
                resolve(null);
              }

              if (data && typeof data === 'object') {
                const object = data as Record<string, any>;
                if (
                  TestPlayTypeRequiredKeys.every((key2) => {
                    if (object[key2] !== undefined) {
                      // Date型の場合はTimestamp型に変換
                      if (isDate(object[key2])) {
                        object[key2] = Timestamp.fromDate(
                          new Date(object[key2] as string),
                        );
                      }

                      if (key2 === 'settingCardData') {
                        const settingCardData = object[key2] as SettingCardData;
                        if (
                          SettingCardTypeRequiredKeys.every((key3) => {
                            // Date型の場合はTimestamp型に変換
                            if (isDate(settingCardData[key3])) {
                              settingCardData[key3] = Timestamp.fromDate(
                                new Date(settingCardData[key3] as string),
                              );
                            }

                            return settingCardData[key3] !== undefined;
                          })
                        ) {
                          return true;
                        }

                        return false;
                      }

                      return true;
                    }

                    return false;
                  })
                ) {
                  // durationTimePerAnswerがない場合は追加
                  if (object.durationTimePerAnswer === undefined) {
                    const testPlayData = object as TestPlayData;
                    // selectedAnswerListの数だけdurationTimePerAnswer配列を-1で埋める
                    const durationTimePerAnswer: number[] = Array.from(
                      {
                        length: testPlayData.selectedAnswerList.length,
                      },
                      () => -1,
                    );
                    testPlayData.durationTimePerAnswer = durationTimePerAnswer;
                  }

                  resolve(data as TestPlayData);
                }
              }

              resolve(null);
            })
            .catch((error: unknown) => {
              console.error('getTestPlayDataError', error);
              resolve(null);
            });
        });
      },
      [readData, isDate, TestPlayTypeRequiredKeys, SettingCardTypeRequiredKeys],
    );
  const getDailyLogData = useCallback(
    async (key: string) => {
      return new Promise<DailyLog | null>((resolve, _reject) => {
        readData(key)
          .then((save) => {
            const {data} = save;
            if (data && typeof data === 'object') {
              const object = data as Record<string, any>;
              if (
                DailyLogRequiredKeys.every((key2) => {
                  return object[key2] !== undefined;
                })
              ) {
                resolve(data as DailyLog);
              }
            }

            resolve(null);
          })
          .catch((error: unknown) => {
            console.error('getDailyLogData：処理失敗', error);
            resolve(null);
          });
      });
    },
    [readData, DailyLogRequiredKeys],
  );

  const setBoolData = useCallback(
    async (key: string, value: boolean) => {
      if (typeof value === 'boolean') {
        return storeData(key, value);
      }

      throw new Error('value is not boolean');
    },
    [storeData],
  );

  const setNumberData = useCallback(
    async (key: string, value: number) => {
      if (typeof value === 'number') {
        return storeData(key, value);
      }

      throw new Error('value is not number');
    },
    [storeData],
  );

  const setStringData = useCallback(
    async (key: string, value: string) => {
      if (typeof value === 'string') {
        return storeData(key, value);
      }

      throw new Error('value is not string');
    },
    [storeData],
  );

  const setStringDataId = useCallback(
    async (key: string, id: string, value: string) => {
      if (typeof value === 'string') {
        return storeDataId(key, id, value);
      }

      throw new Error('value is not string');
    },
    [storeDataId],
  );

  const setStringArrayData = useCallback(
    async (key: string, value: string[]) => {
      if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
      ) {
        return storeData(key, value);
      }

      throw new Error('value is not string array');
    },
    [storeData],
  );

  const setNumberArrayData = useCallback(
    async (key: string, value: number[]) => {
      if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'number')
      ) {
        return storeData(key, value);
      }

      throw new Error('value is not number array');
    },
    [storeData],
  );

  const setAssetData = useCallback(
    async (id: string, value: Asset) => {
      if (typeof value === 'object' && value !== null) {
        const validationCheck = AssetTypeRequiredKeys.every((id2) => {
          return Object.keys(value).includes(id2);
        });
        if (validationCheck) {
          return storeDataId('assets/', id, value);
        }
      }
    },
    [storeDataId, AssetTypeRequiredKeys],
  );
  const setAssetLisInStorage = useCallback(
    async (values: AssetList) => {
      // データがAssetList型かどうかチェック
      if (values && typeof values === 'object') {
        const nothingKeys: string[] = [];
        const check = Object.entries(values).every(([key, value]) => {
          // もしvalue.statusがdeletedだった場合はそのまま通す
          if (value.status === 'deleted') return true;
          // バリデーションチェック
          const validationCheck = AssetTypeRequiredKeys.every((id2) => {
            const valid = Object.keys(value).includes(id2);
            if (valid) return true;
            nothingKeys.push(`${key}-${id2}`);
            return false;
          });
          if (validationCheck) {
            return true;
          }

          return false;
        });
        if (check) {
          return storeData('assets/', values);
        }

        throw new Error(
          `value has not requiered Key for AssetList => [${nothingKeys.join(', ')}]`,
        );
      }

      throw new Error('value is not AssetList Object');
    },
    [storeData, AssetTypeRequiredKeys],
  );

  const setSettingCardData = useCallback(
    async (key: string, value: SettingCardData) => {
      if (value && typeof value === 'object') {
        // deadlineDateをTimestamp型に変換
        if (value.taskSetting?.deadlineDate) {
          const newValue: SettingCardData = value.taskSetting
            ? {
                ...value,
                taskSetting: {
                  ...value.taskSetting,
                  deadlineDate: new Timestamp(
                    value.taskSetting.deadlineDate.seconds,
                    value.taskSetting.deadlineDate.nanoseconds,
                  ),
                },
              }
            : value;
          // deadlineDateがTimestamp型かチェック
          if (!(newValue.taskSetting?.deadlineDate instanceof Timestamp))
            throw new Error(
              'newValue.taskSetting?.deadlineDate is not Timestamp',
            );
          const check = SettingCardTypeRequiredKeys.every((id2) => {
            return Object.keys(newValue).includes(id2);
          });
          if (check) {
            return storeData(key, newValue);
          }
        }

        // taskDateをTimestamp型に変換
        else if (value.taskSetting?.taskDate) {
          const newTaskDate = value.taskSetting.taskDate.map((v) => {
            if (
              !(v.startAt instanceof Timestamp) ||
              !(v.endAt instanceof Timestamp)
            ) {
              throw new TypeError(
                'value.taskSetting?.taskDate is not Timestamp',
              );
            }

            return {
              startAt: new Timestamp(v.startAt.seconds, v.startAt.nanoseconds),
              endAt: new Timestamp(v.startAt.seconds, v.startAt.nanoseconds),
            };
          });
          // taskDateがTimestamp型かチェック
          const isValidTimestampArray = newTaskDate.every((v) => {
            return (
              v.startAt instanceof Timestamp && v.endAt instanceof Timestamp
            );
          });
          if (!isValidTimestampArray)
            throw new TypeError(
              'newTaskDate.taskSetting?.taskDate is not Timestamp',
            );
          const newValue: SettingCardData = value.taskSetting
            ? {
                ...value,
                taskSetting: {
                  ...value.taskSetting,
                  taskDate: newTaskDate as Array<{
                    startAt: FirebaseFirestoreTypes.Timestamp;
                    endAt: FirebaseFirestoreTypes.Timestamp;
                  }>,
                },
              }
            : value;
          const check = SettingCardTypeRequiredKeys.every((id2) => {
            return Object.keys(newValue).includes(id2);
          });
          if (check) {
            return storeData(key, newValue);
          }
        } else {
          const newValue: SettingCardData = value.taskSetting
            ? {
                ...value,
                deadlineDate: undefined,
                taskSetting: undefined,
              }
            : value;
          const check = SettingCardTypeRequiredKeys.every((id2) => {
            return Object.keys(newValue).includes(id2);
          });
          if (check) {
            return storeData(key, newValue);
          }
        }
      }

      throw new Error('value is not SettingCardData');
    },
    [storeData, SettingCardTypeRequiredKeys],
  );

  const setSettingCardDataMap = useCallback(
    async (key: string, value: SettingCardDataMap) => {
      if (value && typeof value === 'object') {
        const newValue: SettingCardDataMap = Object.entries(
          value,
        ).reduce<SettingCardDataMap>((acc, [key, value]) => {
          // deadlineDateをTimestamp型に変換
          if (value.taskSetting?.deadlineDate) {
            const newEntry = value.taskSetting
              ? {
                  ...value,
                  taskSetting: {
                    ...value.taskSetting,
                    deadlineDate: new Timestamp(
                      value.taskSetting.deadlineDate.seconds,
                      value.taskSetting.deadlineDate.nanoseconds,
                    ),
                  },
                }
              : value;
            // deadlineDateがTimestamp型かチェック
            if (!(newEntry.taskSetting?.deadlineDate instanceof Timestamp))
              throw new Error(
                'newEntry.taskSetting?.deadlineDate is not Timestamp',
              );
            acc[key] = newEntry;
          }
          // taskDateをTimestamp型に変換
          else if (value.taskSetting?.taskDate) {
            const newTaskDate = value.taskSetting.taskDate.map((v) => {
              return {
                startAt: new Timestamp(
                  v.startAt.seconds,
                  v.startAt.nanoseconds,
                ),
                endAt: new Timestamp(v.startAt.seconds, v.startAt.nanoseconds),
              };
            });
            // taskDateがTimestamp型かチェック
            const isValidTimestampArray = newTaskDate.every(
              (v) =>
                v.startAt instanceof Timestamp && v.endAt instanceof Timestamp,
            );
            // taskDateがTimestamp型かチェック
            if (!isValidTimestampArray)
              throw new TypeError(
                'newTaskDate.taskSetting?.taskDate is not Timestamp',
              );
            const newEntry = value.taskSetting
              ? {
                  ...value,
                  taskSetting: {
                    ...value.taskSetting,
                    taskDate: newTaskDate,
                  },
                }
              : value;
            acc[key] = newEntry;
          } else {
            const newEntry = value.taskSetting
              ? {
                  ...value,
                  taskSetting: {
                    ...value.taskSetting,
                    deadlineDate: undefined,
                    taskDate: undefined,
                  },
                }
              : value;
            acc[key] = newEntry;
          }

          return acc;
        }, {});

        const check = Object.entries(newValue).every(([_key, value]) => {
          const validationCheck = SettingCardTypeRequiredKeys.every((id2) => {
            return Object.keys(value).includes(id2);
          });
          if (validationCheck) {
            return true;
          }

          return false;
        });
        if (check) {
          return storeData(key, newValue);
        }
      }

      throw new Error('value is not SettingCardDataMap');
    },
    [storeData, SettingCardTypeRequiredKeys],
  );

  const setTestPlayData = useCallback(
    async (key: string, value: TestPlayData | null) => {
      if (value === null) {
        if (key.includes('/answerlingTest')) {
          return storeData(key, value);
        }

        throw new Error('value is null and key is not answerlingTest');
      }

      if (value && typeof value === 'object') {
        const check = Object.entries(value).every(([key2, value2]) => {
          if (key2 === 'settingCardData') {
            const validationCheck = SettingCardTypeRequiredKeys.every((id2) => {
              const settingCardData = value2 as SettingCardData;
              return Object.keys(settingCardData).includes(id2);
            });
            if (validationCheck) {
              return true;
            }

            return false;
          }

          return true;
        });
        if (check) {
          return storeData(key, value);
        }
      }

      throw new Error('value is not TestPlayData');
    },
    [storeData, SettingCardTypeRequiredKeys],
  );

  const setTimeStampData = useCallback(
    async (key: string, value: FirebaseFirestoreTypes.Timestamp) => {
      if (value.nanoseconds !== undefined && value.seconds !== undefined) {
        return storeData(key, value);
      }

      throw new Error('value is not Timestamp');
    },
    [storeData],
  );

  const setDailyLogData = useCallback(
    async (key: string, value: DailyLog) => {
      if (value) {
        const keys = Object.keys(value);
        const check = DailyLogRequiredKeys.every((key2) => {
          return keys.includes(key2);
        });
        if (check) {
          return storeData(key, value);
        }
      }

      throw new Error('value is not DailyLog');
    },
    [storeData, DailyLogRequiredKeys],
  );
  const deleteData = useCallback(
    async (key: string) => {
      try {
        key = escapeUnderScore(key);
        await storage.remove({key});
        setKeyList((previous) => {
          return previous.filter((value) => {
            return value !== key;
          });
        });
        return 'success';
      } catch (error) {
        console.error('deleteData：処理失敗', error);
        return 'error';
      }
    },
    [storage, escapeUnderScore],
  );

  const isNotFoundError = useCallback((error: unknown) => {
    return error instanceof Error && error.name === 'NotFoundError';
  }, []);

  const savePendingDailyLog = useCallback(
    async (value: PendingDailyLog) => {
      const id = createPendingStorageId(value);
      await storage.save({
        key: escapeUnderScore(pendingDailyLogDataV2Key),
        id: escapeUnderScore(id),
        data: value,
      });
    },
    [escapeUnderScore, storage],
  );

  const loadPendingDailyLog = useCallback(
    async (id: string) => {
      try {
        const data: unknown = await storage.load({
          key: escapeUnderScore(pendingDailyLogDataV2Key),
          id: escapeUnderScore(id),
        });
        const pending = revivePendingDailyLog(data);
        if (!pending) throw new Error('保留デイリーログの形式が不正です');
        const records = Object.values(pending.delta.playRecord);
        if (
          id !== createPendingStorageId(pending) ||
          pending.delta.uid !== pending.target.uid ||
          pending.delta.date !== pending.target.dailyLogId.slice(0, 8) ||
          records.length === 0 ||
          records.some(
            (record) =>
              createDailyLogId(
                record.startAt,
                pending.target.uid,
                pending.target.gradeNumber,
              ) !== pending.target.dailyLogId,
          )
        )
          throw new Error('保留デイリーログの対象文書が不正です');
        return pending;
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
    },
    [escapeUnderScore, isNotFoundError, storage],
  );

  const listPendingDailyLogs = useCallback(
    async (uid: string) => {
      const ids = await storage.getIdsForKey(
        escapeUnderScore(pendingDailyLogDataV2Key),
      );
      const prefix = `${uid}:`;
      const pendingLogs: PendingDailyLog[] = [];
      for (const escapedId of ids) {
        const id = unEscapeUnderScore(escapedId);
        if (!id.startsWith(prefix)) continue;
        const pending = await loadPendingDailyLog(id);
        if (pending?.target.uid === uid) pendingLogs.push(pending);
      }
      return pendingLogs.sort((left, right) =>
        left.target.dailyLogId.localeCompare(right.target.dailyLogId),
      );
    },
    [escapeUnderScore, loadPendingDailyLog, storage, unEscapeUnderScore],
  );

  const deletePendingDailyLog = useCallback(
    async (id: string) => {
      await storage.remove({
        key: escapeUnderScore(pendingDailyLogDataV2Key),
        id: escapeUnderScore(id),
      });
    },
    [escapeUnderScore, storage],
  );

  const loadLegacyPendingDailyLog = useCallback(async () => {
    try {
      const data: unknown = await storage.load({
        key: escapeUnderScore(pendingDailyLogDataKey),
      });
      if (!data || typeof data !== 'object')
        throw new Error('旧保留デイリーログの形式が不正です');
      const object = data as Record<string, unknown>;
      if (!DailyLogRequiredKeys.every((key) => object[key] !== undefined))
        throw new Error('旧保留デイリーログの形式が不正です');
      return data as DailyLog;
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }, [DailyLogRequiredKeys, escapeUnderScore, isNotFoundError, storage]);

  const deleteLegacyPendingDailyLog = useCallback(async () => {
    await storage.remove({key: escapeUnderScore(pendingDailyLogDataKey)});
  }, [escapeUnderScore, storage]);
  const allDeleteData = useCallback(async () => {
    const _errors: Error[] = [];
    const {results} = await PromisePool.for(keyList)
      .withConcurrency(10)
      .handleError((error) => {
        console.error('handleError：処理失敗', error);
        _errors.push(error);
      })
      .process(async (key) => {
        return storage.remove({key});
      });
    console.error(
      'allDeleteData：処理失敗',
      summarizeConsoleValue(results),
      _errors,
    );
    await storage.clearMap();

    console.log('キャッシュ削除完了');
  }, [storage, keyList]);

  const updateKeyList = useCallback(async () => {
    await setStringArrayData('keyList', keyList);
  }, [keyList, setStringArrayData]);

  useUpdateEffect(() => {
    updateKeyList()
      .then(() => {
        console.log('updateKeyList', summarizeConsoleValue(keyList));
      })
      .catch((error: unknown) => {
        console.error('StorageContextProvider：処理失敗', error);
      });
  }, [keyList]);

  const value = useMemo(() => {
    return {
      readData,
      storeData,
      getBoolData,
      getNumberData,
      getStringData,
      getStringArrayData,
      getStringDataId,
      getNumberArrayData,
      getAssetData,
      getAssetLisInStorage,
      getTimeStampData,
      getSettingCardData,
      getSettingCardDataMap,
      getTestPlayData,
      getDailyLogData,
      setBoolData,
      setStringData,
      setStringDataId,
      setNumberData,
      setStringArrayData,
      setNumberArrayData,
      setAssetData,
      setAssetLisInStorage,
      setTimeStampData,
      setSettingCardData,
      setSettingCardDataMap,
      setTestPlayData,
      setDailyLogData,
      deleteData,
      savePendingDailyLog,
      loadPendingDailyLog,
      listPendingDailyLogs,
      deletePendingDailyLog,
      loadLegacyPendingDailyLog,
      deleteLegacyPendingDailyLog,
      allDeleteData,
    };
  }, [
    readData,
    storeData,
    getBoolData,
    getNumberData,
    getStringData,
    getStringDataId,
    getStringArrayData,
    getNumberArrayData,
    getAssetData,
    getAssetLisInStorage,
    getTimeStampData,
    getSettingCardData,
    getSettingCardDataMap,
    getTestPlayData,
    getDailyLogData,
    setBoolData,
    setStringData,
    setStringDataId,
    setNumberData,
    setStringArrayData,
    setNumberArrayData,
    setAssetData,
    setAssetLisInStorage,
    setSettingCardData,
    setSettingCardDataMap,
    setTimeStampData,
    setTestPlayData,
    setDailyLogData,
    deleteData,
    savePendingDailyLog,
    loadPendingDailyLog,
    listPendingDailyLogs,
    deletePendingDailyLog,
    loadLegacyPendingDailyLog,
    deleteLegacyPendingDailyLog,
    allDeleteData,
  ]);
  return (
    <StorageContext.Provider value={value}>
      {props.children}
    </StorageContext.Provider>
  );
};

export const useAsyncStorage = () => useContext(StorageContext);
