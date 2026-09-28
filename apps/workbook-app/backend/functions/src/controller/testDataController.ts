import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import {Timestamp} from 'firebase-admin/firestore';
// import { ulid } from "ulid";
// import { db } from "./admin";
import {https} from 'firebase-functions/v1';
import {updateUserData} from './userDataController';
import type {TestPlayDataLog} from '../types/settingCard';
/**
 * テストIDを作成
 * @param uid
 * @returns string
 * @description テストIDをULID方式で作成する
 * @description 重複チェックは行い、重複していた場合は再度実行する
 */
/*
export const createTestID:(uid: string,counter?:number) => Promise<string> = async (uid,counter?)=>{
    if(counter === undefined) counter = 0;
    counter++;
    // サーバーのタイムスタンプからULIDを作成
    const testID = ulid(Timestamp.now().toMillis());
    const ref = db.collection('users').doc(uid).collection('personalAnalysis').doc('testData').collection('execute').doc(testID);
    const snapshot = await ref.get();
    if(snapshot.exists){
        if(counter > 10) throw new https.HttpsError('unknown', 'unknown error', 'creating testID Process is filed over 10 times');
        return await createTestID(uid,counter);
    }else{
        return testID;        
    }
}
*/
/**
 * ChangeTestLogの更新
 * @param uid
 * @param changeData
 * @returns result | Error
 * @description users/{uid}/personalAnalysis/changeTestLogを更新する
 */
export const updateChangeTestLog = async (
  transaction: admin.firestore.Transaction,
  parentRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  data: any,
  context: functions.https.CallableContext,
) => {
  if (!context.auth)
    throw new functions.https.HttpsError('unauthenticated', 'unauthenticated');
  try {
    const timeStr = Timestamp.now().toMillis().toString();
    const ref = parentRef.collection('changeTestLog').doc(timeStr);
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      throw new https.HttpsError('already-exists', 'already-exists');
    }
    transaction.set(ref, data);
    return {status: 'success', message: 'update user data success'};
  } catch (e) {
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

/**
 * ChangeDailyLogの更新
 * @param uid
 * @param changeData
 * @returns　result | Error
 * @description ユーザーデータのログを更新する
 * @example
 */
export const updateChangeDailyLog = async (
  transaction: admin.firestore.Transaction,
  parentRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  data: any,
  context: functions.https.CallableContext,
) => {
  if (!context.auth)
    throw new functions.https.HttpsError('unauthenticated', 'unauthenticated');
  try {
    const timeStr = Timestamp.now().toMillis().toString();
    const ref = parentRef.collection('changeDailyLog').doc(timeStr);
    if (ref === null)
      throw new https.HttpsError('unknown', 'reference error', 'ref is null');
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      throw new https.HttpsError('already-exists', 'already-exists');
    }
    transaction.set(ref, data);
    return {status: 'success', message: 'update user data success'};
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message);
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

/**
 * テスト変更データをアップデート処理
 * @param uid
 * @param data
 * @returns
 */

export const updateChangeTestData = async (
  data: TestPlayDataLog,
  db: admin.firestore.Firestore,
) => {
  try {
    // validation check
    if (!data.uid || !data.testId || !data.controll || !data.changeAt) {
      throw new https.HttpsError(
        'invalid-argument',
        'invalid data',
        'data is invalid',
      );
    }
    const {uid} = data;
    const uidRef = admin.firestore().collection('users').doc(data.uid);
    // 個人データが存在しない場合は作成
    const snapshot = await uidRef.get();
    if (!snapshot.exists) {
      await updateUserData(uid, {}, db).catch((e) => {
        throw new https.HttpsError('unknown', 'failed create user data', e);
      });
    }
    const personalRef = admin
      .firestore()
      .collection('users')
      .doc(uid)
      .collection('personalAnalysis');
    const targetTestDataref = (target: 'execute' | 'completed') =>
      personalRef.doc('testData').collection(target).doc(data.testId);
    // テストデータが存在するか確認
    let isRollback = false;
    let isCompleted = false;
    const hasExecuteData = await targetTestDataref('execute').get();
    const hasCompletedData = await targetTestDataref('completed').get();
    if (hasExecuteData.exists) {
      const exdata = hasExecuteData.data() as TestPlayDataLog | undefined;
      if (exdata && exdata.changeAt.toMillis() > data.changeAt.toMillis()) {
        isRollback = true;
      }
    }
    if (hasCompletedData.exists) {
      const codata = hasCompletedData.data() as TestPlayDataLog | undefined;
      if (codata && codata.changeAt.toMillis() > data.changeAt.toMillis()) {
        isRollback = true;
        isCompleted = true;
      }
    }

    switch (data.controll) {
      case 'create':
        // テストデータを/users/{uid}/personalAnalysis/{testId}/executeに作成
        if (isRollback) {
          // ロールバック処理
          targetTestDataref(isCompleted ? 'completed' : 'execute').update({
            ...data,
            ...hasExecuteData.data(),
          });
        } else {
          // 作成処理
          targetTestDataref('execute')
            .set(data)
            .catch((e) => {
              throw new https.HttpsError(
                'unknown',
                'failed create Test Data',
                e,
              );
            });
        }
        break;
      case 'update':
        // テストデータを更新
        if (isRollback) {
          // ロールバック処理
          targetTestDataref(isCompleted ? 'completed' : 'execute').update({
            ...data,
            ...hasExecuteData.data(),
          });
        } else {
          // 更新処理
          targetTestDataref('execute')
            .update(data)
            .catch((e) => {
              throw new https.HttpsError(
                'unknown',
                'failed update Test Data',
                e,
              );
            });
        }
        break;
      case 'delete':
        // 完了済みの場合は削除しない
        if (isCompleted)
          throw new https.HttpsError(
            'invalid-argument',
            'invalid data',
            'completed data is not delete',
          );
        // 削除処理
        targetTestDataref('execute')
          .delete()
          .catch((e) => {
            throw new https.HttpsError('unknown', 'failed delete Test Data', e);
          });
        break;
      default:
        throw new https.HttpsError(
          'invalid-argument',
          'invalid data',
          'invalid controll data',
        );
    }
  } catch (e) {
    if (e instanceof Error) throw new Error(e.message);
    throw new https.HttpsError('unknown', 'update error', e);
  }
};
