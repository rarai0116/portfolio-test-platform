import {Reference} from 'firebase-admin/database';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import {https} from 'firebase-functions/v1';
import Grade from './grade';
import type {GradeStr} from './grade';

const {isGrade} = Grade;

/************************
 * AssetStatus
 * @description アセットのステータスの定義
 ***********************/
const StatusList = {
  active: 'active',
  deleted: 'deleted',
  processing: 'processing',
} as const;
export type StatusType = (typeof StatusList)[keyof typeof StatusList];
const isAssetStatus = (value: string): value is StatusType => {
  return Object.values(StatusList).includes(value as StatusType);
};
const AssetStatus = {
  isAssetStatus,
  StatusList,
};
/************************
 * AssetFolder
 * @description アセットのフォルダ名の定義
 ***********************/
const AssetFolderList = {
  Image: 'image',
  Html: 'html',
  B64: 'b64',
  Lib: 'lib',
  Zip: 'zip',
  Bzip: 'bzip',
} as const;
export type AssetFolderStr =
  (typeof AssetFolderList)[keyof typeof AssetFolderList];
const isFolder = (value: string): value is AssetFolderStr => {
  return Object.values(AssetFolderList).includes(value as AssetFolderStr);
};
const AssetFolder = {
  isFolder,
  AssetFolderList,
};

/************************
 * Asset
 * @description アセットのデータ構造
 ***********************/
export type AssetData = {
  name: string;
  status: StatusType;
  size: number;
  path: string;
  contentType: string;
  folder: AssetFolderStr;
  grade: GradeStr;
  bucket: string;
  generation: number | undefined;
  updatedAt: admin.firestore.Timestamp;
};
/************************
 *  ValidedAssetDataRef
 * @description データベース内の検証済みアセットデータの参照
 * @returns {Reference}
 ***********************/
export type ValidedAssetDataRef = Reference;
const getValidationAssetDataRef = (
  key: string,
  grade: GradeStr,
  folder: AssetFolderStr,
): ValidedAssetDataRef => {
  // 拡張子付きのkeyが渡された場合はエラーを返す
  if (key.includes('.'))
    throw new https.HttpsError('invalid-argument', 'invalid data name');
  return admin.database().ref(`assets/${grade}/${folder}/${key}`);
};

/************************
 * validationAssetData
 * @description アセットデータの検証
 * @param {functions.storage.ObjectMetadata} data
 * @returns {grade: GradeStr, folder: AssetFolderStr, filename: string, key: string}
 ***********************/
const validationAssetData = (data: functions.storage.ObjectMetadata) => {
  if (data.name === undefined)
    throw new https.HttpsError('invalid-argument', 'invalid data name');

  // パスの構造がassets/{common | firstGrade | secondGrade}/{image| html | lib}/{filename}の場合のみ処理する
  const path = data.name.match(/assets\/([^/]*)\/([^/]*)\/([^/]*[.][^.]*)$/i);
  if (path === null)
    throw new https.HttpsError('invalid-argument', 'invalid data name');

  if (!isGrade(path[1]) || !isFolder(path[2]))
    throw new https.HttpsError('invalid-argument', 'invalid data name');
  const filename = path[3];
  const grade = path[1];
  const folder = path[2];
  const key = filename.replace(/([.][^.]*)$/, '');
  return {grade, folder, filename, key};
};

const Asset = {
  validationAssetData,
  getValidationAssetDataRef,
  AssetFolder,
  AssetStatus,
};

export default Asset;
