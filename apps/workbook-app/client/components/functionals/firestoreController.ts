import {summarizeConsoleValue} from './consoleLevels';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  getFirestore,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  initializeFirestore,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import _ from 'lodash';
import type {
  SettingCardData,
  TestPlayData,
} from '../hooks/useGlobalSaveDataContext';
import type {QuestionGradeType, GradeNumber} from '../../types/commonUnionType';
import app from './firebase';
import {now} from './timeManager';

// 1日の始まりは何時か
const _startHour = 3;
initializeFirestore(app, {
  persistence: true,
  ignoreUndefinedProperties: true,
})
  .then(() => {
    console.info('Firestore initialized');
  })
  .catch((error: unknown) => {
    console.error('Firestore initialize error', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });
const firestoreController = getFirestore();

type PlayRecord = {
  [key: string]: FirebaseFirestoreTypes.Timestamp | null;
  startAt: FirebaseFirestoreTypes.Timestamp;
  endAt: FirebaseFirestoreTypes.Timestamp | null;
};
export type PlayRecordMap = Record<string, PlayRecord>;

export type TestPlayDataLog = {
  [key: string]:
    | string
    | 'create'
    | 'update'
    | 'delete'
    | QuestionGradeType
    | 'exam'
    | 'practice'
    | number[]
    | boolean
    | FirebaseFirestoreTypes.Timestamp
    | number
    | SettingCardData
    | PlayRecordMap
    | undefined
    | null;
  uid: string;
  controll: 'create' | 'update' | 'delete';
  changeAt: FirebaseFirestoreTypes.Timestamp; // 更新日時
  grade: QuestionGradeType; // 級
  type: 'exam' | 'practice'; // テスト種別 'exam' | 'practice'
  // isCompleted?: boolean; // テストが完了したかどうか
  isQaa: boolean; // QAAモードかどうか
} & TestPlayData;

export type DailyLog = {
  [key: string]:
    | string[]
    | string
    | number[]
    | boolean
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.Timestamp[]
    | Array<FirebaseFirestoreTypes.Timestamp | null>
    | FirebaseFirestoreTypes.FieldValue
    | PlayRecordMap
    | null
    | undefined;
  uid: string;
  date: string; // 日付
  playRecord: PlayRecordMap; // プレイ記録
  durationTime: number[]; // 学習時間
  answerList: number[]; // 総回答数
  correctAnswerList: number[]; // 正解数
  lastUpdate:
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.FieldValue; // 最終更新日時
  answerIdList: string[]; // 回答IDリスト
  newWeaklyAnswerIdRegisted: string[]; // 新規登録された苦手問題のID
  newWeaklyAnswerIdUnRegisted: string[]; // 登録解除された苦手問題のID
  newCorrectlyAnswerIdRegisted: string[]; // 新規登録された正解問題のID
  applied: boolean; // ユーザーデータに適用済みかどうか
};
type CurrentTest = {
  id: string;
};
export type CurrentTests = {
  [key: string]: CurrentTest;
  _inter0: CurrentTest;
};

// TestPlayDataLog型のデータをTestPlayData型に変換する
export const convertTestPlayDataLogToTestPlayData = (
  log: TestPlayDataLog,
): TestPlayData => {
  return {
    ...log,
    // TestPlayDataLog型のプロパティをTestPlayData型のプロパティにマッピングします
    testId: log.testId,
    testDataNoList: log.testDataNoList,
    answerList: log.answerList ?? [],
    selectedAnswerList: log.selectedAnswerList ?? [],
    currentPlayNo: log.currentPlayNo ?? 0,
    isFinished: log.isFinished ?? false,
    correctAnswerCount: log.correctAnswerCount ?? 0,
    questionCount: log.questionCount,
    durationTime: log.durationTime ?? 0,
    durationTimePerAnswer: log.durationTimePerAnswer,
    limitTime: log.limitTime,
    startAt: log.startAt,
    endAt: log.endAt ?? null,
    settingCardData: log.settingCardData,
  };
};

// TimestampをyyyyMMddHHmmssSSS形式に変換する
export const formatTimestamp = (
  _timeStamp?: FirebaseFirestoreTypes.Timestamp,
  _fmt?: string,
) => {
  _fmt ??= 'YYYYMMDDhhmmssiii';
  _timeStamp ??= Timestamp.now();

  const _dt = _timeStamp.toDate();
  return [
    ['YYYY', _dt.getFullYear().toString()],
    ['MM', (_dt.getMonth() + 1).toString()],
    ['DD', _dt.getDate().toString()],
    ['hh', _dt.getHours().toString()],
    ['mm', _dt.getMinutes().toString()],
    ['ss', _dt.getSeconds().toString()],
    ['iii', _dt.getMilliseconds().toString()],
  ].reduce(
    (s, a) => s.replace(a[0], `${a[1]}`.padStart(a[0].length, '0')),
    _fmt,
  );
};

// 配列を比較する
const _arraysEqual = (x: number[], y: number[]): boolean => {
  return (
    JSON.stringify(x.sort((a, b) => a - b)) ===
    JSON.stringify(y.sort((a, b) => a - b))
  );
};

// 現在からX日前の日付を取得する
export const getPastTimestamp = (
  days: number,
): FirebaseFirestoreTypes.Timestamp => {
  const pastMills = now.toMillis() - 86_400_000 * days - 10_800_000; // 3時間分補正する
  const pastDate = new Date(pastMills);
  return Timestamp.fromDate(pastDate);
  /*
  return Timestamp.fromDate(
    new Date(now.toMillis() - 86_400_000 * days - 10_800_000), // 3時間分補正する
  );
  */
};

// テストIDを発行する
export const createTestId = (date: FirebaseFirestoreTypes.Timestamp) => {
  const uid = getAuth().currentUser?.uid;
  const testId = `${formatTimestamp(date)}_${uid}`;
  return testId;
};

// DailyLogIdを発行する
export const createDailyLogId = (
  startAt: FirebaseFirestoreTypes.Timestamp,
  uid: string,
  gradeNumber: GradeNumber,
) => {
  // Timestampを1日の始まりの時間分だけ戻す
  const modifiedStartAt = Timestamp.fromMillis(
    reviveTimestamp(startAt).toMillis() - _startHour * 60 * 60 * 1000,
  );
  const dailyLogId = `${formatTimestamp(
    modifiedStartAt,
    'YYYYMMDD',
  )}_${gradeNumber}_${uid}`;
  return dailyLogId;
};

/**
 * AsyncStorage から取得したオブジェクトを Firestore の Timestamp に復元する
 */
export const reviveTimestamp = (
  obj:
    | FirebaseFirestoreTypes.Timestamp
    | {seconds: number; nanoseconds: number},
): FirebaseFirestoreTypes.Timestamp => {
  // seconds と nanoseconds が存在していれば新たにインスタンス作成
  if (
    obj &&
    typeof obj.seconds === 'number' &&
    typeof obj.nanoseconds === 'number'
  ) {
    return new Timestamp(obj.seconds, obj.nanoseconds);
  }

  // オブジェクトが不正な場合はデフォルト値を返す（例: 1970/01/01）
  return Timestamp.fromMillis(0);
};

// DailyLogを取得する
export const getDailyLog = async (
  gradeNumber: GradeNumber,
  startAt: Timestamp,
  _initialData?: DailyLog,
) => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('uid is null!');
  const dailyLogId = createDailyLogId(startAt, uid, gradeNumber);
  const dailyLogRef = doc(
    firestoreController,
    'users',
    '_log',
    'changedDailyLog',
    dailyLogId,
  );
  const dailyLogDoc = await getDoc(dailyLogRef).catch((error: unknown) => {
    console.error('getDailyLog：処理失敗', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });

  if (dailyLogDoc.exists()) {
    return {
      status: 'success',
      dailyLog: dailyLogDoc.data() as DailyLog,
    };
  } else {
    return {
      status: 'error',
      errorMessage: 'dailyLog is not exists!',
    };
  }
};

// 対象のuid・gradeNumberのDailyLogを日付は問わず全て取得する
// デイリーログは/users/_log/changedDailyLogサブコレクションにyymmdd_gradeNumber_uidの形式のキー名のドキュメントとして保存されている
type DailyLogRecord = Record<string, DailyLog>;
export const getDailyLogRecord = async (
  uid: string,
  gradeNumber: GradeNumber,
): Promise<DailyLogRecord> => {
  const dailyLogRecord: DailyLogRecord = {};
  const pattern = new RegExp(`.*_${gradeNumber}_.*`);
  // 例: uidが取得済みのユーザーID
  const dailyLogRef = collection(
    firestoreController,
    'users',
    '_log',
    'changedDailyLog',
  );

  const q = query(dailyLogRef, where('uid', '==', uid));
  const snapshot = await getDocs(q);

  for (const doc of snapshot.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[]) {
    const dailyLog = doc.data() as DailyLog;

    const docId: string = doc.id;
    if (dailyLog.date && dailyLog.date.length === 8 && pattern.test(docId)) {
      dailyLogRecord[dailyLog.date] = dailyLog;
    }
  }

  return dailyLogRecord;
};

// DailyLogを作成する
export const createDailyLog = async (
  gradeNumber: GradeNumber,
  startAt: Timestamp,
  dailyLogData?: DailyLog,
) => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('uid is null!');
  const dailyLogId = createDailyLogId(startAt, uid, gradeNumber);
  const dailyLogRef = doc(
    firestoreController,
    'users',
    '_log',
    'changedDailyLog',
    dailyLogId,
  );
  const dailyLogDoc = await getDoc(dailyLogRef).catch((error: unknown) => {
    console.error('createDailyLog：処理失敗', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });

  if (dailyLogDoc.exists()) {
    return {
      status: 'error',
      dailyLogId,
      errorMessage: 'dailyLog is already exists!',
      dailyLogData: dailyLogDoc.data() as DailyLog,
    };
  }

  const initalDailyLogData: DailyLog = {
    uid,
    date: createDailyLogId(startAt, uid, gradeNumber).slice(0, 8),
    applied: false,
    playRecord: {},
    durationTime: [0],
    answerList: [],
    correctAnswerList: [],
    answerIdList: [],
    newWeaklyAnswerIdRegisted: [],
    newCorrectlyAnswerIdRegisted: [],
    newWeaklyAnswerIdUnRegisted: [],
    lastUpdate: serverTimestamp(),
  };
  const settingDailyLog: DailyLog = {...initalDailyLogData, ...dailyLogData};
  await setDoc(dailyLogRef, settingDailyLog).catch((error: unknown) => {
    console.error('createDailyLog：処理失敗', error);
    return {
      status: 'error',
      dailyLogId,
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
      dailyLogData,
    };
  });

  return {
    status: 'success',
    dailyLogId,
    errorMessage: '',
    dailyLogData: settingDailyLog,
  };
};

// DailyLogの中から、answerList・answerIdList・correctAnswerList・newCorrectlyAnswerIdRegisted・newWeaklyAnswerIdRegisted・newWeaklyAnswerIdUnRegistedの更新のみを行う
// それ以外のフィールドは更新しない
export const updateDailyLog = async (props: {
  gradeNumber: GradeNumber;
  _answerList: number[];
  _answerIdList: string[];
  _correctAnswerList: number[];
  _newWeaklyAnswerIdRegisted: string[];
  _newWeaklyAnswerIdUnRegisted: string[];
  _newCorrectlyAnswerIdRegisted: string[];
  weaklyAnswerIdList: string[];
  startAt: FirebaseFirestoreTypes.Timestamp;
  endAt?: FirebaseFirestoreTypes.Timestamp;
  syncContext?: {
    source: 'pending';
    dailyLogId: string;
    playRecord: PlayRecordMap;
    base:
      | {state: 'missing'}
      | {state: 'version'; lastUpdate: FirebaseFirestoreTypes.Timestamp}
      | {state: 'unknown'};
  };
}) => {
  const {
    gradeNumber,
    _answerList,
    _answerIdList,
    _correctAnswerList,
    _newCorrectlyAnswerIdRegisted,
    weaklyAnswerIdList,
    startAt,
    endAt,
    syncContext,
  } = props;
  let {_newWeaklyAnswerIdRegisted, _newWeaklyAnswerIdUnRegisted} = props;

  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('uid is null!');
  const dailyLogId = createDailyLogId(startAt, uid, gradeNumber);
  const dailyLogRef = doc(
    firestoreController,
    'users',
    '_log',
    'changedDailyLog',
    dailyLogId,
  );
  const dailyLogDoc = await (syncContext?.source === 'pending'
    ? getDocFromServer(dailyLogRef)
    : getDoc(dailyLogRef)
  ).catch((error: unknown) => {
    console.error('updateDailyLog：処理失敗', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });
  if (
    syncContext?.source === 'pending' &&
    syncContext.dailyLogId !== dailyLogId
  )
    throw new Error('保留デイリーログの対象文書が一致しません');

  if (
    syncContext?.source === 'pending' &&
    syncContext.base.state === 'missing' &&
    dailyLogDoc.exists()
  ) {
    return {status: 'discarded', dailyLogId} as const;
  }
  if (
    syncContext?.source === 'pending' &&
    syncContext.base.state === 'version'
  ) {
    if (!dailyLogDoc.exists())
      return {status: 'discarded', dailyLogId} as const;
    const remoteLastUpdate = dailyLogDoc.data()?.lastUpdate;
    if (
      !(remoteLastUpdate instanceof Timestamp) ||
      remoteLastUpdate.toMillis() > syncContext.base.lastUpdate.toMillis()
    ) {
      return {status: 'discarded', dailyLogId} as const;
    }
  }

  const dailyLogStartAt = reviveTimestamp(startAt);
  const dailyLogEndAt = endAt ?? serverTimestamp();
  const playRecord = {startAt: dailyLogStartAt, endAt: dailyLogEndAt};
  const normalizedPlayRecords: Record<
    string,
    {
      startAt: FirebaseFirestoreTypes.Timestamp;
      endAt:
        | FirebaseFirestoreTypes.Timestamp
        | FirebaseFirestoreTypes.FieldValue
        | null;
    }
  > = Object.fromEntries(
    Object.entries(syncContext?.playRecord ?? {}).map(([key, record]) => [
      key,
      {
        ...record,
        startAt: reviveTimestamp(record.startAt),
        endAt: record.endAt === null ? null : reviveTimestamp(record.endAt),
      },
    ]),
  );
  if (syncContext?.source !== 'pending') {
    normalizedPlayRecords[dailyLogStartAt.toMillis().toString()] = playRecord;
  }
  const playRecordUpdateFields = Object.fromEntries(
    Object.entries(normalizedPlayRecords).map(([key, record]) => [
      `playRecord.${key}`,
      record,
    ]),
  );
  const durationTimeValues =
    syncContext?.source === 'pending'
      ? Object.values(normalizedPlayRecords).flatMap((record) =>
          record.endAt instanceof Timestamp
            ? [record.endAt.toMillis() - record.startAt.toMillis()]
            : [],
        )
      : endAt && dailyLogEndAt instanceof Timestamp
        ? [dailyLogEndAt.toMillis() - dailyLogStartAt.toMillis()]
        : [];
  const dailyLogData = dailyLogDoc.data() as DailyLog | undefined;
  // 既に苦手リストに登録済みの場合にのみ登録解除する
  _newWeaklyAnswerIdUnRegisted = _newWeaklyAnswerIdUnRegisted.filter(
    (id) =>
      weaklyAnswerIdList.includes(id) ||
      dailyLogData?.newWeaklyAnswerIdRegisted.includes(id),
  );
  // _newWeaklyAnswerIdUnRegisted/Registed両方に同じ値がある場合、Registedの値を消す
  _newWeaklyAnswerIdRegisted = _newWeaklyAnswerIdRegisted.filter(
    (id) => !_newWeaklyAnswerIdUnRegisted.includes(id),
  );
  if (dailyLogData && dailyLogDoc.exists()) {
    // 既存のdailyLogのUnRegistedにある値がnewRegistedかweaklyAnswerIdListにある場合、UnRegistedからその値を削除する
    for (const id of _newWeaklyAnswerIdRegisted) {
      if (
        dailyLogData.newWeaklyAnswerIdUnRegisted.includes(id) ||
        weaklyAnswerIdList.includes(id)
      ) {
        dailyLogData.newWeaklyAnswerIdUnRegisted =
          dailyLogData.newWeaklyAnswerIdUnRegisted.filter(
            (unRegistedId) => unRegistedId !== id,
          );
      }
    }

    // 既存のdailyLogのRegistedにある値がnewUnRegistedにある場合、dailyLogのRegistedからその値を削除する
    for (const id of _newWeaklyAnswerIdUnRegisted) {
      if (dailyLogData.newWeaklyAnswerIdRegisted.includes(id)) {
        dailyLogData.newWeaklyAnswerIdRegisted =
          dailyLogData.newWeaklyAnswerIdRegisted.filter(
            (registedId) => registedId !== id,
          );
      }
    }

    // newRegistedにある値が既存のweaklyAnswerIdListにある場合はnewRegistedから削除する
    _newWeaklyAnswerIdRegisted = _newWeaklyAnswerIdRegisted.filter(
      (id) => !weaklyAnswerIdList.includes(id),
    );

    const newWeaklyAnswerIdRegisted = [
      ...new Set([
        ...dailyLogData.newWeaklyAnswerIdRegisted,
        ..._newWeaklyAnswerIdRegisted,
      ]),
    ];

    const newWeaklyAnswerIdUnRegisted = [
      ...new Set([
        ...dailyLogData.newWeaklyAnswerIdUnRegisted,
        ..._newWeaklyAnswerIdUnRegisted,
      ]),
    ];
    const newdailyLogData = {
      uid,
      answerList: arrayUnion(..._answerList),
      correctAnswerList: arrayUnion(..._correctAnswerList),
      answerIdList: arrayUnion(..._answerIdList),
      newWeaklyAnswerIdRegisted,
      newCorrectlyAnswerIdRegisted: arrayUnion(
        ..._newCorrectlyAnswerIdRegisted,
      ),
      newWeaklyAnswerIdUnRegisted,
      ...playRecordUpdateFields,
      lastUpdate: serverTimestamp(),
    };

    console.log(
      'update newdailyLogData',
      summarizeConsoleValue(newdailyLogData),
    );
    if (durationTimeValues.length > 0) {
      const durationTime = arrayUnion(...durationTimeValues);
      await updateDoc(dailyLogRef, {...newdailyLogData, durationTime}).catch(
        (error: unknown) => {
          console.error('updateDailyLog：処理失敗', error);
          throw new Error(
            error instanceof Error
              ? `dailylog update error=>${error.message}`
              : 'unknown error!',
          );
        },
      );
    } else {
      await updateDoc(dailyLogRef, newdailyLogData).catch((error: unknown) => {
        console.error('updateDailyLog：処理失敗', error);
        throw new Error(
          error instanceof Error
            ? `dailylog update error=>${error.message}`
            : 'unknown error!',
        );
      });
    }
  } else {
    // newWeaklyAnswerIdUnRegistedにidがある場合、newWeaklyAnswerIdRegistedから値を削除する(解除優先)
    const newWeaklyAnswerIdRegisted = [
      ...new Set(
        _newWeaklyAnswerIdRegisted.filter(
          (id) =>
            !_newWeaklyAnswerIdUnRegisted.includes(id) &&
            !weaklyAnswerIdList.includes(id),
        ),
      ),
    ];
    const newWeaklyAnswerIdUnRegisted = [
      ...new Set(_newWeaklyAnswerIdUnRegisted),
    ];
    const newdailyLogData = {
      uid,
      date: dailyLogId.slice(0, 8),
      applied: false,
      answerList: arrayUnion(..._answerList),
      correctAnswerList: arrayUnion(..._correctAnswerList),
      answerIdList: arrayUnion(..._answerIdList),
      newWeaklyAnswerIdRegisted,
      newCorrectlyAnswerIdRegisted: arrayUnion(
        ..._newCorrectlyAnswerIdRegisted,
      ),
      newWeaklyAnswerIdUnRegisted,
      playRecord: normalizedPlayRecords,
      lastUpdate: serverTimestamp(),
    };

    if (durationTimeValues.length > 0) {
      const durationTime = arrayUnion(...durationTimeValues);
      await setDoc(dailyLogRef, {...newdailyLogData, durationTime}).catch(
        (error: unknown) => {
          console.error('updateDailyLog：処理失敗', error);
          throw new Error(
            error instanceof Error ? error.message : 'unknown error!',
          );
        },
      );
    } else {
      await setDoc(dailyLogRef, newdailyLogData).catch((error: unknown) => {
        console.error('updateDailyLog：処理失敗', error);
        throw new Error(
          error instanceof Error ? error.message : 'unknown error!',
        );
      });
    }
  }

  return {
    status: 'success',
    dailyLogId,
  };
};

// テストデータを更新する
export const updateTestData = async (
  _testUpdateData: TestPlayDataLog,
  testId?: string,
) => {
  const testUpdateData = _.cloneDeep(_testUpdateData); // 値が参照渡しされるので、cloneDeepでコピーする
  console.log('テストデータ更新要求', testUpdateData.grade, testId);
  const date = Timestamp.now();
  let isTestCreateOperation = false;
  // TestIDは日時(yymm)+_+UIDで作成
  testId ??= createTestId(date);
  // テストデータが存在するか確認
  const testDataRef = doc(firestoreController, 'userTestDataStore', testId);
  const testDataDoc = await getDoc(testDataRef).catch((error: unknown) => {
    console.error('updateTestData：処理失敗', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });

  if (testDataDoc.exists()) {
    // 存在する場合、整合性を確認する
    // テスト開始時間・制限時間・問題数・問題IDが一致するか確認
    // 一致しない場合、別のテストデータが入っていると判断しエラーを返す
    const testData = testDataDoc.data() as TestPlayDataLog;

    try {
      if (!testData) throw new Error('[please retry] testData is null!');
      if (testData.isFinished) throw new Error('test is finished!');
      if (testData.grade !== testUpdateData.grade) {
        console.error(
          `grade is not match! ${testData.grade} /  ${testUpdateData.grade}`,
        );
        if (testUpdateData.grade === undefined) {
          testUpdateData.grade = testData.grade;
        } else {
          throw new Error(
            `[please retry] grade is not match! ${testData.grade} /  ${testUpdateData.grade}`,
          );
        }
      }

      if (testData.type !== testUpdateData.type) {
        console.error(
          `type is not match! ${testData.type} /  ${testUpdateData.type}`,
        );
        // testUpdateDataのtypeに合わせる
        testData.tyoe = testUpdateData.type;
        // throw new Error('[please retry] type is not match!');
      }

      if (testData.limitTime !== testUpdateData.limitTime)
        throw new Error('[please retry] limitTime is not match!');
      if (testData.questionCount !== testUpdateData.questionCount)
        throw new Error('[please retry] questionCount is not match!');
    } catch (error: unknown) {
      console.error('reading test data error', error);
      return {
        status: 'error',
        testId,
        errorMessage: error instanceof Error ? error.message : 'unknown error!',
      };
    }
  } else {
    isTestCreateOperation = true;
  }

  if (isTestCreateOperation) {
    // TestLogの作成
    await setDoc(testDataRef, {
      ...testUpdateData,
      testId,
      controll: 'create',
    }).catch((error: unknown) => {
      console.error('setting test data error', error);
      return {
        status: 'error',
        testId,
        errorMessage: error instanceof Error ? error.message : 'unknown error!',
      };
    });
  } else {
    await updateDoc(testDataRef, {
      ...testUpdateData,
      testId,
      controll: 'update',
    }).catch((error: unknown) => {
      console.error('updating test data error', error);
      return {
        status: 'error',
        testId,
        errorMessage: error instanceof Error ? error.message : 'unknown error!',
      };
    });
  }

  return {
    status: 'success',
    testId,
    isTestCreateOperation,
  };
};

// id名のテストデータを取得する
export const getTestData = async (testId: string) => {
  const testDataRef = doc(firestoreController, 'userTestDataStore', testId);
  const testDataDoc = await getDoc(testDataRef).catch((error: unknown) => {
    console.error('getTestData：処理失敗', error);
    throw new Error(error instanceof Error ? error.message : 'unknown error!');
  });

  if (testDataDoc.exists()) {
    return {
      status: 'success',
      testPlayDataLog: testDataDoc.data() as TestPlayDataLog,
    };
  } else {
    return {
      status: 'error',
      errorMessage: 'testData is not exists!',
    };
  }
};

// 新しいDailyLogと古いDailyLogを比較して差分となるDailyLogを返す
export const compareDailyLog = (
  newDailyLog: DailyLog,
  oldDailyLog: DailyLog,
): DailyLog | null => {
  // startAt・endAt・durationTime
  // durationTimeはstartAt・endAtの差からm秒単位で計算する
  const playRecord = Object.keys(newDailyLog.playRecord).reduce<PlayRecordMap>(
    (acc, key) => {
      if (
        oldDailyLog.playRecord[key] &&
        oldDailyLog.playRecord[key].endAt === newDailyLog.playRecord[key].endAt
      ) {
        return acc;
      }

      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      return {...acc, [key]: newDailyLog.playRecord[key]};
    },
    {},
  );
  const isDiff = Object.keys(playRecord).length > 0;
  if (!isDiff) return null;
  const durationTime = Object.keys(playRecord).map((key) => {
    const record = playRecord[key];
    if (record.endAt === null) return 0;
    const duration = record.endAt.toMillis() - record.startAt.toMillis();
    return Math.max(duration, 0);
  });

  const diffDailyLog = Object.keys(newDailyLog).reduce<DailyLog>(
    (acc, key) => {
      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      if (key === 'uid') return {...acc, uid: newDailyLog.uid};
      if (key === 'lastUpdate') return acc;
      if (key === 'date')
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          date: createDailyLogId(Timestamp.now(), newDailyLog.uid, 1).slice(
            0,
            8,
          ),
        };
      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      if (key === 'playRecord') return {...acc, playRecord};
      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      if (key === 'durationTime') return {...acc, durationTime};
      if (
        key === 'answerIdList' ||
        key === 'newWeaklyAnswerIdRegisted' ||
        key === 'newCorrectlyAnswerIdRegisted' ||
        key === 'newWeaklyAnswerIdUnRegisted'
      ) {
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [key]: newDailyLog[key].filter(
            (value, _index) => !oldDailyLog[key].includes(value),
          ),
        };
      }

      if (key === 'answerList' || key === 'correctAnswerList') {
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [key]: newDailyLog[key].filter(
            (value, index) => oldDailyLog[key][index] !== value,
          ),
        };
      }

      // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
      return {...acc, key: newDailyLog[key]};
    },
    {
      uid: newDailyLog.uid,
      date: newDailyLog.date,
      playRecord,
      applied: false,
      durationTime: [],
      answerList: [],
      correctAnswerList: [],
      answerIdList: [],
      newWeaklyAnswerIdRegisted: [],
      newCorrectlyAnswerIdRegisted: [],
      newWeaklyAnswerIdUnRegisted: [],
      lastUpdate: serverTimestamp(),
    },
  );

  return diffDailyLog;
};

// サブコレクションusers/{uid}/shared/currentTests/を取得
export const getCurrentTests = async (): Promise<{
  status: 'success' | 'error';
  currentTests: CurrentTests | undefined;
  errorMessage: string | undefined;
}> => {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('uid is null!');

    const currentTestsRef = doc(
      firestoreController,
      'users',
      uid,
      'shared',
      'currentTests',
    );
    const currentTestsDoc = await getDoc(currentTestsRef).catch(
      (error: unknown) => {
        console.error('getCurrentTests：処理失敗', error);
        throw new Error(
          error instanceof Error ? error.message : 'unknown error!',
        );
      },
    );

    if (currentTestsDoc.exists()) {
      return {
        status: 'success',
        currentTests: currentTestsDoc.data() as CurrentTests,
        errorMessage: undefined,
      };
    } else {
      // 存在しない場合は新規作成する
      await setDoc(currentTestsRef, {
        _inter0: {id: ''},
      }).catch((error: unknown) => {
        console.error('setting currentTests error', error);
        throw new Error(
          error instanceof Error ? error.message : 'unknown error!',
        );
      });
      const currentTestsDoc2 = await getDoc(currentTestsRef).catch(
        (error: unknown) => {
          console.error('getCurrentTests：処理失敗', error);
          throw new Error(
            error instanceof Error ? error.message : 'unknown error!',
          );
        },
      );

      return {
        status: 'success',
        currentTests: currentTestsDoc2.data() as CurrentTests,
        errorMessage: undefined,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
      currentTests: undefined,
    };
  }
};

// テストデータを削除する
export const deleteTestData = async (testId: string) => {
  const testDataRef = doc(firestoreController, 'userTestDataStore', testId);
  await deleteDoc(testDataRef).catch((error: unknown) => {
    console.error('deleting test data error', error);
    return {
      status: 'error',
      testId,
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
    };
  });
  return {
    status: 'success',
    testId,
  };
};

// users/{uid}/shared/currentTests/に特定IDの要素を追加する
export const updateCurrentTests = async (id: string) => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('uid is null!');
  const currentTestsRef = doc(
    firestoreController,
    'users',
    uid,
    'shared',
    'currentTests',
  );
  await updateDoc(currentTestsRef, {
    _inter0: {id},
  }).catch((error: unknown) => {
    console.error('updating currentTests error', error);
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
    };
  });
  return {
    status: 'success',
  };
};

// users/{uid}/shared/currentTests/の特定IDの要素を削除する
export const deleteCurrentTests = async (_id: string) => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('uid is null!');
  const currentTestsRef = doc(
    firestoreController,
    'users',
    uid,
    'shared',
    'currentTests',
  );
  await updateDoc(currentTestsRef, {
    _inter0: deleteField(),
  }).catch((error: unknown) => {
    console.error('deleting currentTests error', error);
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
    };
  });
  return {
    status: 'success',
  };
};

/** updateTaskData
 * users/{uid}/tasks/{taskId}のSettingCardData型ドキュメントを更新する
 * taskIdのドキュメントが存在しない場合は新規作成する
 * @param {string} taskId
 * @param {SettingCardData} taskData
 * @returns {Promise<{status: 'success' | 'error'; taskId: string; errorMessage: string | undefined;}>}
 **/
export const updateTaskData = async (
  taskId: string,
  taskData: SettingCardData,
): Promise<{
  status: 'success' | 'error';
  taskId: string;
  errorMessage: string | undefined;
}> => {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('uid is null!');
    const taskRef = doc(firestoreController, 'users', uid, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef).catch((error: unknown) => {
      console.error('updateTaskData：処理失敗', error);
      throw new Error(
        error instanceof Error ? error.message : 'unknown error!',
      );
    });

    if (taskDoc.exists()) {
      await updateDoc(taskRef, taskData).catch((error: unknown) => {
        console.error('updating task data error', error);
        throw new Error(
          error instanceof Error ? error.message : 'unknown error!',
        );
      });
    } else {
      await setDoc(taskRef, taskData).catch((error: unknown) => {
        console.error('setting task data error', error);
        throw new Error(
          error instanceof Error ? error.message : 'unknown error!',
        );
      });
    }

    return {
      status: 'success',
      taskId,
      errorMessage: undefined,
    };
  } catch (error) {
    return {
      status: 'error',
      taskId,
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
    };
  }
};

/**
 * deleteTaskData
 * users/{uid}/tasks/{taskId}のSettingCardData型ドキュメントを削除する
 * @param {string} taskId
 * @returns {Promise<{status: 'success' | 'error'; taskId: string; errorMessage: string | undefined;}>}
 * */
export const deleteTaskData = async (
  taskId: string,
): Promise<{
  status: 'success' | 'error';
  taskId: string;
  errorMessage: string | undefined;
}> => {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('uid is null!');
    const taskRef = doc(firestoreController, 'users', uid, 'tasks', taskId);
    await deleteDoc(taskRef).catch((error: unknown) => {
      console.error('deleting task data error', error);
      throw new Error(
        error instanceof Error ? error.message : 'unknown error!',
      );
    });

    return {
      status: 'success',
      taskId,
      errorMessage: undefined,
    };
  } catch (error) {
    return {
      status: 'error',
      taskId,
      errorMessage: error instanceof Error ? error.message : 'unknown error!',
    };
  }
};

export default firestoreController;
