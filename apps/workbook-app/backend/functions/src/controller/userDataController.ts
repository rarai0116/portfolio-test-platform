import {summarizeConsoleValue} from '../utils/consoleSummary';
import type admin from 'firebase-admin';
import {FieldPath, Timestamp, type Transaction} from 'firebase-admin/firestore';
import {https} from 'firebase-functions/v1';
import {getApp, getDb} from '../admin';
import type {GradeNumber} from '../types/grade';
import type {SettingCardData} from '../types/settingCard';
export type UserData = {
  createdAt?: Timestamp;
  name?: string;

  personalAnalysis?: {
    firstGrade?: {
      answered?: number[];
      weaklyAnswered?: string[];
      correctlyAnswered?: string[];
      totalPlayTime?: number;
    };
    secondGrade?: {
      answered?: string[];
      weaklyAnswered?: string[];
      correctlyAnswered?: string[];
      totalPlayTime?: number;
    };
    playTime?: {
      _total?: number;
    };
    testData?: {
      execute?: Record<string, unknown>;
      completed?: Record<string, unknown>;
      changelog?: Record<string, unknown>;
    };
  };
};
type PersonalAnalysis = NonNullable<UserData['personalAnalysis']>;
type GradePersonalAnalysis = NonNullable<
  PersonalAnalysis['firstGrade' | 'secondGrade']
>;
type PlayTimeSummary = NonNullable<PersonalAnalysis['playTime']>;

type PlayRecord = {
  [key: string]: Timestamp | null;
  startAt: Timestamp;
  endAt: Timestamp | null;
};
type PlayRecordMap = Record<string, PlayRecord>;
export type DailyLog = {
  uid: string;
  date: string; // 日付yyyymmdd
  playRecord: PlayRecordMap;
  durationTime: number[]; // 学習時間
  answerList: number[]; // 総回答数
  answerIdList: string[]; // 回答IDリスト
  correctAnswerList: number[]; // 正解数
  lastUpdate?: Timestamp; // 最終更新日時
  newWeaklyAnswerIdRegisted: string[]; // 新規登録された苦手問題のID
  newWeaklyAnswerIdUnRegisted: string[]; // 登録解除された苦手問題のID
  newCorrectlyAnswerIdRegisted: string[]; // 新規登録された正解問題のID
  applied: boolean; // 適用済みかどうか
};
// 1日の始まりは何時か
export const _START_HOUR = 3;

// TimestampをYYYYMMDDHHmmssSSS形式に変換する
export const formatTimestamp = (
  _timeStamp?: admin.firestore.Timestamp,
  _fmt?: string,
) => {
  try {
    if (!_fmt) _fmt = 'YYYYMMDDhhmmssiii';
    if (!_timeStamp) _timeStamp = Timestamp.now();

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
  } catch (_e) {
    throw new Error('formatTimestamp error');
  }
};
// DailyLogIdを発行する
/*
const createDailyLogId = (
  startAt: Timestamp,
  uid: string,
  gradeNumber: GradeNumber,
) => {
 // Timestampを1日の始まりの時間分だけ戻す
  const modifiedStartAt = Timestamp.fromMillis(
    startAt.toMillis() - _START_HOUR * 60 * 60 * 1000,
  );


  const dailyLogId = `${formatTimestamp(
    modifiedStartAt,
    'YYYYMMDD',
  )}_${gradeNumber}_${uid}`;
  return dailyLogId;
};
*/

/**
 * ユーザーデータを作成
 * @returns UserData
 */
export const initialUserData: UserData = {
  createdAt: Timestamp.now(),
  name: '',
  personalAnalysis: {
    firstGrade: {
      answered: [],
      weaklyAnswered: [],
      correctlyAnswered: [],
      totalPlayTime: 0,
    },
    secondGrade: {
      answered: [],
      weaklyAnswered: [],
      correctlyAnswered: [],
      totalPlayTime: 0,
    },
    playTime: {
      _total: 0,
    },
    testData: {
      execute: {},
      completed: {},
      changelog: {},
    },
  },
};

const transactionUpdateUserData = async (
  transaction: FirebaseFirestore.Transaction,
  uid: string,
  data: UserData,
  db: admin.firestore.Firestore,
) => {
  try {
    const ref = db.collection('users').doc(uid);
    const snapshot = await transaction.get(ref);
    const newData: UserData = {
      ...initialUserData,
      ...snapshot.data(),
      ...data,
    };
    if (data === newData) return;
    if (snapshot.exists) {
      transaction.update(ref, newData);
    } else {
      const currentTestsRef = ref.collection('shared').doc('currentTests');
      const taskTestsRef = ref.collection('shared').doc('taskTests');
      const currentTestsSnapshot = await transaction.get(currentTestsRef);
      const taskTestsSnapshot = await transaction.get(taskTestsRef);

      if (data.createdAt || data.name || data.personalAnalysis) {
        // データが不足している場合は現在あるデータをマージして登録
        transaction.set(ref, newData);
      } else {
        // 全てのデータがない場合は初期データを登録
        transaction.set(ref, newData);
      }
      try {
        // サブコレクションが存在しない場合は作成
        if (!currentTestsSnapshot.exists) {
          transaction.set(currentTestsRef, {_inter0: {id: ''}});
        }
        if (!taskTestsSnapshot.exists) {
          transaction.set(taskTestsRef, {__dummy: {id: ''}});
        }
      } catch (e) {
        if (e instanceof Error)
          throw new Error(`create subcollection error ${e.message}`);
        throw new Error('create subcollection error');
      }
    }
  } catch (e) {
    if (e instanceof Error)
      throw new Error(`update userdata error ${e.message}`);
    throw new Error('update userdata error');
  }
};

/**
 * ユーザーデータをアップデート
 * @param uid
 * @param data
 * @returns
 */
export const updateUserData = async (
  uid: string,
  data: UserData,
  db: admin.firestore.Firestore,
) => {
  try {
    const result = await db
      .runTransaction(async (transaction: Transaction) => {
        await transactionUpdateUserData(transaction, uid, data, db);
        return 'success';
      })
      .catch((e) => {
        if (e instanceof Error) {
          console.error("updateUserData：処理失敗", e);
          throw new Error(`transaction error${e.message}`);
        }
        throw new Error('unknown transaction error');
      });
    if (result === 'success')
      return {status: 'success', message: 'update user data success'};
    return {status: 'error', message: result};
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message);
    throw new https.HttpsError('unknown', 'transaction error', e);
  }
};

/** ApplyChangedUserDailyLog
 * @description ユーザーデータの1日の変更をトランザクションで適用する
 * @description 最大コスト6(読み込み2,書き込み0〜3)
 * @param uid
 * @param data
 * @returns {Promise<{status: 'success' | 'error', message: string}>}
 */
type ApplyChangedUserDailyLogResult = {
  status: 'success' | 'error';
  message: string;
  uid: string;
};
const outputAppliedUserDataByGrade = (
  grade: GradeNumber,
  userData: UserData,
  dailyLog: DailyLog,
): UserData => {
  try {
    // 適用済みの場合は何もしないで終了
    if (dailyLog.applied) return userData;
    const gradeStr = grade === 1 ? 'firstGrade' : 'secondGrade';
    const personalAnalysisMap = userData.personalAnalysis as PersonalAnalysis;
    const personalAnalysis = personalAnalysisMap[
      gradeStr
    ] as GradePersonalAnalysis;
    const gradeNumber = gradeStr === 'firstGrade' ? '0' : '1';
    const idListFilteredBygrade = (idList: string[]) =>
      idList.filter((id) => id.split('_')[1] === gradeNumber);
    // 重複を削除して登録
    const answered = [
      ...new Set([
        ...(personalAnalysis.answered as string[]),
        ...idListFilteredBygrade(dailyLog.answerIdList),
      ]),
    ];
    const correctlyAnswered = [
      ...new Set([
        ...idListFilteredBygrade(
          personalAnalysis.correctlyAnswered as string[],
        ),
        ...idListFilteredBygrade(dailyLog.newCorrectlyAnswerIdRegisted),
      ]),
    ];
    // 新規登録された苦手問題IDを追加した後に登録解除された苦手問題を削除
    const weaklyAnswered = [
      ...new Set([
        ...idListFilteredBygrade(personalAnalysis.weaklyAnswered as string[]),
        ...idListFilteredBygrade(dailyLog.newWeaklyAnswerIdRegisted),
      ]),
    ].filter(
      (id) =>
        !idListFilteredBygrade(dailyLog.newWeaklyAnswerIdUnRegisted).includes(
          id,
        ),
    );
    const dailyPlayTime = dailyLog.durationTime.reduce((a, b) => a + b, 0);
    const totalPlayTime =
      (personalAnalysis.totalPlayTime as number) + dailyPlayTime;
    const playTimeSummary = personalAnalysisMap.playTime as PlayTimeSummary;
    const playTime = {
      _total: (playTimeSummary._total as number) + dailyPlayTime,
    };
    const updateUserData: UserData = {
      ...userData,
      personalAnalysis: {
        ...userData.personalAnalysis,
        [gradeStr]: {
          answered,
          correctlyAnswered,
          weaklyAnswered,
          totalPlayTime,
        },
        playTime,
      },
    };
    // DailyLogの適用フラグを立てる
    return updateUserData;
  } catch (e) {
    if (e instanceof Error)
      throw new Error(`outputAppliedUserDataByGrade error${e.message}`);
    throw new Error('outputAppliedUserDataByGrade error');
  }
};
export const applyChangedUserDailyLog = async (
  dailyLogDoc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>,
  userDoc: admin.firestore.DocumentSnapshot<admin.firestore.DocumentData>,
  _timestamp: admin.firestore.Timestamp,
  db: admin.firestore.Firestore,
): Promise<ApplyChangedUserDailyLogResult> => {
  //    try{
  // ユーザーデータを取得
  const dailyLogName = dailyLogDoc.id;
  const dailyLog = dailyLogDoc.data() as DailyLog;
  const uid = dailyLog.uid;
  if (!uid || uid === '')
    return Promise.reject({
      status: 'error' as 'error',
      message: 'uid is not found',
    });
  const result = await db
    .runTransaction(async (transaction: Transaction) => {
      try {
        const userData = userDoc.exists
          ? {...initialUserData, ...userDoc.data()}
          : initialUserData;
        // gradeはdailyLogから取得

        const grade = dailyLogName.split('_')[1] === '1' ? 1 : 2;
        const updateUserData = outputAppliedUserDataByGrade(
          grade,
          userData,
          dailyLog,
        );
        //            const updateUserData = outputAppliedUserDataByGrade(1, userData, dailyLog);
        //            const updateUserData2 = outputAppliedUserDataByGrade(2, updateUserData, dailyLog);

        // write
        if (updateUserData === userData) {
          try {
            transaction.update(dailyLogDoc.ref, {applied: true});
          } catch (e) {
            if (e instanceof Error)
              throw new Error(
                `update dailyLog error(user data is unchanged) ${e.message}`,
              );
            throw new Error('update dailyLog error(user data is unchanged)');
          }
          return {
            status: 'success' as 'success',
            message: 'apply changed user daily log success',
            uid: uid,
            dailyLog,
          };
        }
        if (userDoc.exists) {
          try {
            transaction.update(userDoc.ref, updateUserData);
          } catch (e) {
            if (e instanceof Error)
              throw new Error(`update userData error ${e.message}`);
            throw new Error('update userData error');
          }
        } else {
          try {
            const ref = db.collection('users').doc(uid);
            transaction.set(ref, updateUserData);
          } catch (e) {
            if (e instanceof Error)
              throw new Error(`set userData error ${e.message}`);
            throw new Error('set userData error');
          }
        }
        try {
          transaction.update(dailyLogDoc.ref, {applied: true});
        } catch (e) {
          if (e instanceof Error)
            throw new Error(`update dailyLog error ${e.message}`);
          throw new Error('update dailyLog error');
        }
        return {
          status: 'success' as 'success',
          message: 'apply changed user daily log success',
          uid: uid,
          dailyLog,
        };
      } catch (e) {
        console.error("runTransaction：処理失敗", e);
        if (e instanceof Error) {
          throw new Error(`transaction error ${e.message}`);
        }
        throw new Error(`transaction error`);
      }
    })
    .catch((e) => {
      if (e instanceof Error) {
        console.error("applyChangedUserDailyLog：処理失敗", e);
        return Promise.reject({
          status: 'error' as 'error',
          message: e.message,
          uid,
          dailyLog,
        });
      }
      return Promise.reject({
        status: 'error' as 'error',
        message: 'unknown transaction error',
        uid,
        dailyLog,
      });
    });
  return result;
  /*    }catch(e){
            if(e instanceof Error)return Promise.reject({status:'error',message:`userDataController error ${e.message}`,uid:dailyLog.uid,dailyLog});
            return Promise.reject({status:'error',message:`userDataController error`,uid:dailyLog.uid,dailyLog});
        }
    */
};

export const _updateDailyLog = async (
  rollback: number,
  isAllTarget?: boolean,
) => {
  try {
    const admin = getApp();
    if (!admin) throw new Error('admin is not found');
    if (!isAllTarget) isAllTarget = false;
    rollback = 0; // rollbackは無効化
    const now = Timestamp.now();
    const nowDate = now.toDate();
    const skipUserId: string[] = [];
    if (rollback < 0) rollback = 0;
    if (rollback > 24) rollback = rollback % 24;
    let hours =
      _START_HOUR - rollback < 0
        ? 24 + (_START_HOUR - rollback)
        : _START_HOUR - rollback;
    if (hours < 0) hours = 0;
    if (hours > 23) hours = hours % 24;
    // _START_HOUR時のTimestampを作成
    const xHoursAgo = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      hours,
      0,
      0,
    );

    // _START_HOUR時のTimestampの作成
    const timestamp = Timestamp.fromDate(xHoursAgo);

    // appliedフィールドが付与されていない、またはfalseのドキュメント群を取得 ＊暫定措置
    const dailyUsers = await admin
      .firestore()
      .collection('users')
      .doc('_log')
      .collection('changedDailyLog')
      .get()
      .then((snapshot) => {
        const filterdSnapshot = snapshot.docs.filter((doc) => {
          if (!doc.exists) return false;
          const data = doc.data() as DailyLog;
          if (isAllTarget) return true;
          if (!data.applied) return true;
          return false;
        });
        return filterdSnapshot;
      })
      .catch((e) => {
        console.error("_updateDailyLog：処理失敗", e);
        throw new Error('i can not get daily log data');
      });

    /*
        const dailyUsers = await admin.firestore().collection('users').doc('_log').collection('changedDailyLog').where('applied', '!=', true).get()
        .catch((e) => {
            console.log(e);
            throw new Error('i can not get daily log data');
        });
        */

    const results: {status: string; message: string; uid: string}[] = [];
    const targetDailyLogs = dailyUsers.filter((doc) => {
      if (!doc.exists) return false;
      if (isAllTarget) return true;
      const data = doc.data() as DailyLog;
      if (!data.date) {
        return false;
      }
      if (data.date.length !== 8) return false;
      const year = Number(data.date.substring(0, 4));
      const month = Number(data.date.substring(4, 6));
      const day = Number(data.date.substring(6, 8));
      if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day))
        return false;
      if (year < 1970 || year > new Date().getFullYear()) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      const docDate = new Date(year, month - 1, day, 0, 0, 0);
      if (Number.isNaN(docDate.getTime())) return false;
      return docDate.getTime() <= xHoursAgo.getTime();
    });
    // targetDailyLogsのデータをdateの昇順でソート
    targetDailyLogs.sort((a, b) => {
      if (a.data().date === undefined || b.data().date === undefined) return 0;
      return a.data().date.localeCompare(b.data().date);
    });
    // isAllTargetがtrueの場合は全てのユーザーのユーザーデータのtotalPlayTimeを0にリセットする
    if (isAllTarget) {
      const allUsers = await admin
        .firestore()
        .collection('users')
        .get()
        .catch((e) => {
          console.error("_updateDailyLog：処理失敗", e);
          throw new Error('i can not get all user data');
        });
      for (const user of allUsers.docs) {
        const uid = user.id;
        const userData = {...initialUserData, ...user.data()};
        const personalAnalysis = userData.personalAnalysis as PersonalAnalysis;
        const playTime = personalAnalysis.playTime as PlayTimeSummary;
        const firstGrade = personalAnalysis.firstGrade as GradePersonalAnalysis;
        const secondGrade =
          personalAnalysis.secondGrade as GradePersonalAnalysis;
        playTime._total = 0;
        firstGrade.totalPlayTime = 0;
        secondGrade.totalPlayTime = 0;
        await updateUserData(uid, userData, admin.firestore()).catch((e) => {
          console.error("_updateDailyLog：処理失敗", e);
          results.push({
            status: 'error',
            message: `update user data error ${e.message}`,
            uid,
          });
        });
      }
    }
    for (const dailyLog of targetDailyLogs) {
      if (skipUserId.includes(dailyLog.data().uid)) {
        results.push({
          status: 'error',
          message: 'skip user',
          uid: dailyLog.data().uid,
        });
      } else {
        const uid = dailyLog.data().uid;
        const userDoc = await admin
          .firestore()
          .collection('users')
          .doc(dailyLog.data().uid)
          .get()
          .catch((e) => {
            console.error("_updateDailyLog：処理失敗", e);
            results.push({
              status: 'error',
              message: '[skip user]i can not get user data',
              uid,
            });
            skipUserId.push(uid);
            return undefined;
          });
        if (!userDoc) {
          skipUserId.push(dailyLog.data().uid);
          results.push({
            status: 'error',
            message: '[skip user]i can not get user data',
            uid,
          });
          return;
        }
        const db = getDb();
        const result = await applyChangedUserDailyLog(
          dailyLog,
          userDoc,
          timestamp,
          db,
        ).catch((e) => {
          console.error("_updateDailyLog：処理失敗", e);
          const uid = e.uid as string;
          if (e.message.includes('[skip user]')) skipUserId.push(uid);
          return {status: 'error', message: e.message, uid};
        });

        results.push(result);
      }
    }

    // 正常にトランザクション処理を行えなかったユーザーIDリストを繋げる
    const errorUsers = results
      .filter((result) => result.status === 'error')
      .reduce((acc, cur) => `${acc}${cur.message},`, '');
    // 正常にトランザクション処理を行えたユーザー数をカウント
    const successUsersCount = results.filter(
      (result) => result.status === 'success',
    ).length;
    // 正常にトランザクション処理を行えなかったユーザー数をカウント
    const errorUsersCount = results.filter(
      (result) => result.status === 'error',
    ).length;
    const skipUserIds = skipUserId.join(',');
    // 処理結果をスプレッドシートに書き込む
    const formatTime = formatTimestamp(timestamp, 'YYYY/MM/DD hh:mm:ss');

    //res.send({ status: 'success', message: 'update daily log success', results: results });
    return {
      results,
      rollback,
      isAllTarget,
      skipUserId,
      dailyUsersCount: dailyUsers.length,
      targetDailyLogCount: targetDailyLogs.length,
      dailyUsers: dailyUsers.reduce((acc, cur) => `${acc}${cur.id},`, ''),
      writeData: [
        [
          formatTime,
          successUsersCount,
          errorUsersCount,
          errorUsers,
          skipUserIds,
        ],
      ],
    };
  } catch (e) {
    if (e instanceof Error) throw new https.HttpsError('unknown', e.message, e);
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

// users内の全ユーザーデータからタスクIDを全て取得してidを書き換える
export const _updateAllUserData = async () => {
  try {
    const admin = getApp();
    if (!admin) throw new Error('admin is not found');
    const db = getDb();
    const users = await db
      .collection('users')
      .get()
      .catch((e) => {
        console.error("_updateAllUserData：処理失敗", e);
        throw new Error('i can not get user data');
      });
    const results: {
      status: string;
      message: string;
      uid: string;
      users?: number;
      other?: string;
    }[] = [
      {
        status: 'success',
        message: 'start update all user data',
        uid: '_',
        users: users.size,
      },
    ];
    for (const user of users.docs) {
      const uid = user.id;
      const tasksPath = `users/${uid}/tasks`;
      const tasks = await db
        .collection(tasksPath)
        .get()
        .catch((e) => {
          console.error("_updateAllUserData：処理失敗", e);
          throw new Error('i can not get task data');
        });
      const taskIds = tasks.docs.map((doc) => doc.id);
      const targetsIds = taskIds.filter((id) =>
        id.match(/^task[-][0-9]+[-]d$/),
      );
      for (const targetId of targetsIds) {
        const ref = db.collection(tasksPath).doc(targetId);
        const target = tasks.docs.find((doc) => doc.id === targetId);
        if (!target) {
          results.push({
            status: 'error',
            message: 'target is not found',
            uid,
            other: targetId,
          });
          continue;
        }
        const data = target.data() as SettingCardData;
        if (!data.taskSetting) {
          results.push({
            status: 'error',
            message: 'taskSetting is not found',
            uid,
            other: targetId,
          });
          continue;
        }
        const testId = data.taskSetting?.testId;
        // if (!testId) { results.push({ status: 'error', message: 'testId is not found', uid, other: targetId }); continue };
        const prefix2 =
          data.practiceQuestionSetting.numberOfQuestions.length > 0
            ? 'practice'
            : data.examQuestionSetting.numberOfQuestions.length > 0
              ? 'exam'
              : 'empty';
        const idNum = targetId.match(/^task[-]([0-9]+)[-]d$/);
        if (!idNum || idNum?.length === 0) {
          results.push({
            status: 'error',
            message: 'idNum is not found',
            uid,
            other: targetId,
          });
          continue;
        }
        const prefix3 = idNum[1];
        const replacedId = `task-${prefix2}-${prefix3}`;
        const result = await db
          .runTransaction(async (transaction: Transaction) => {
            try {
              // userTestDataStoreのデータを書き換える
              if (testId) {
                const testDataStoreDoc = db
                  .collection('userTestDataStore')
                  .doc(testId);
                const testDataStore = await testDataStoreDoc
                  .get()
                  .catch((e) => {
                    console.error("runTransaction：処理失敗", e);
                    throw new Error('i can not get test data');
                  });
                if (!testDataStore.exists)
                  throw new Error('testDataStore is not found');
                transaction.set(
                  db.collection('userTestDataStore').doc(replacedId),
                  testDataStore.data() as admin.firestore.DocumentData,
                );
                transaction.delete(testDataStoreDoc);
              }
              transaction.set(db.collection(tasksPath).doc(replacedId), data);
              transaction.delete(ref);
              return {
                status: 'success',
                message: 'update user data success',
                uid,
                targetId,
                replacedId,
              };
            } catch (e) {
              if (e instanceof Error)
                throw new Error(`transaction error ${e.message}`);
              throw new Error('transaction error');
            }
          })
          .catch((e) => {
            if (e instanceof Error) {
              console.error("_updateAllUserData：処理失敗", e);
              return {status: 'error', message: e.message};
            }
            return {status: 'error', message: 'unknown transaction error'};
          });
        results.push({status: result.status, message: result.message, uid});
      }
    }
    return {results};
  } catch (e) {
    if (e instanceof Error) throw new https.HttpsError('unknown', e.message, e);
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

// 1日分のchangedDailyLogをページングで適用する（メモリセーフ）
// 戻り値: 処理件数、成功件数、失敗件数、次ページ有無、次ページのカーソルID
export const applyChangedDailyLogsByDatePage = async (
  dateYYYYMMDD: string,
  pageSize: number = 200,
  lastDocId?: string,
  db?: admin.firestore.Firestore,
): Promise<{
  processed: number;
  success: number;
  error: number;
  hasMore: boolean;
  lastDocId?: string;
}> => {
  try {
    const _db = db ?? getDb();
    const colRef = _db
      .collection('users')
      .doc('_log')
      .collection('changedDailyLog');

    // date一致 + __name__（ドキュメントID）で安定ソート → ページング
    let query = colRef
      .where('date', '==', dateYYYYMMDD)
      .orderBy(FieldPath.documentId())
      .limit(pageSize);

    if (lastDocId) {
      const lastSnap = await colRef.doc(lastDocId).get();
      if (lastSnap.exists) {
        query = query.startAfter(lastSnap);
      }
    }

    const snap = await query.get();
    if (snap.empty) {
      return {processed: 0, success: 0, error: 0, hasMore: false};
    }

    let processed = 0;
    let success = 0;
    let error = 0;

    for (const doc of snap.docs) {
      processed++;
      const dailyLog = doc.data() as DailyLog;
      // 既に適用済みならスキップ（false/undefinedのみ処理）
      if (dailyLog.applied === true) continue;

      const uid = dailyLog.uid;
      if (!uid) {
        error++;
        continue;
      }

      try {
        const userDoc = await _db.collection('users').doc(uid).get();
        await applyChangedUserDailyLog(doc, userDoc, Timestamp.now(), _db);
        success++;
      } catch (e) {
        console.error('[applyChangedDailyLogsByDatePage] failed', summarizeConsoleValue(doc.id), e);
        error++;
      }
    }

    const last = snap.docs[snap.docs.length - 1];
    const hasMore = snap.size === pageSize;

    return {
      processed,
      success,
      error,
      hasMore,
      lastDocId: last?.id,
    };
  } catch (e) {
    if (e instanceof Error)
      throw new Error(`applyChangedDailyLogsByDatePage error ${e.message}`);
    throw new Error('applyChangedDailyLogsByDatePage error');
  }
};
