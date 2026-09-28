import {summarizeConsoleValue} from '../utils/consoleSummary';
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import {Timestamp} from 'firebase-admin/firestore';
import {https} from 'firebase-functions/v1';
import Asset from '../types/asset';
import type {AssetFolderStr, AssetData} from '../types/asset';
import type {GradeStr} from '../types/grade';
import * as archiver from 'archiver';
import {getBucket} from '../admin';
const {getValidationAssetDataRef, AssetStatus} = Asset;
const {StatusList} = AssetStatus;

// タイムスタンプに変換
const dateTimeStringToTimestamp = (str: string) => {
  return Timestamp.fromDate(new Date(str));
};

/**
 * アセット情報を更新する
 */
const updateAssetsData = async (
  data: Pick<
    functions.storage.ObjectMetadata,
    'name' | 'updated' | 'size' | 'selfLink' | 'contentType' | 'bucket' | 'generation'
  >,
  options: {key: string; folder: AssetFolderStr; grade: GradeStr},
  noUpdateTimeStamp?: boolean,
) => {
  try {
    if (noUpdateTimeStamp === undefined) noUpdateTimeStamp = false;

    const {key, folder, grade} = options;
    console.log('===updateAssetsData===');
    // 名前にドットやスラッシュが含まれている場合はファイルを削除して処理を終了する
    if (key.includes('.') || key.includes('/')) {

      await deleteAsset(data.name!);
      return null;
    }
    /*
            const key = _key ?? names[3];
            const folder = _folder ?? names[2];
        */
    const updatedAt = dateTimeStringToTimestamp(data.updated);
    const seliarizeData: AssetData = {
      name: key,
      size: Number(data.size) ?? 0,
      path: data.selfLink! ?? '',
      status: StatusList.active,
      contentType: data.contentType ?? '',
      grade: grade,
      folder: folder,
      bucket: data.bucket,
      generation: Number(data.generation) ?? 0,
      updatedAt: updatedAt,
    };

    // filesをDatabaseに書き込む
    const ref = getValidationAssetDataRef(key, grade, folder);
    const snapshot = await ref.once('value');

    void [snapshot.exists()];
    if (snapshot.exists()) {
      // データを更新する
      await ref.update(seliarizeData).catch((error) => {
        console.error("updateAssetsData：処理失敗", error);
        return {status: 'error', message: error};
      });
    } else {
      // データを作成する
      await ref.set({...seliarizeData, createdAt: updatedAt}).catch((error) => {
        console.error("updateAssetsData：処理失敗", error);
        return {status: 'error', message: error};
      });
    }

    // 成功した場合はタイムスタンプを更新する
    if (noUpdateTimeStamp) return seliarizeData;
    await admin
      .firestore()
      .collection('metadata')
      .doc(`${seliarizeData.grade}LastUpdate`)
      .update({
        assets: seliarizeData.updatedAt,
        [folder]: seliarizeData.updatedAt,
      });

    return seliarizeData;
  } catch (e) {
    console.error("updateAssetsData：処理失敗", e);
    await deleteAsset(data.name!);
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

export const updateAssetsDataInList = async (
  data: functions.storage.ObjectMetadata,
  grade: GradeStr,
  folder: AssetFolderStr,
  filename: string,
  extensions: string[],
) => {
  console.log('start update');

  //        const extensions = ['.png'];
  if (data !== undefined && typeof data.name === 'string') {
    const names = filename.match(/([^.]*)([.][^.]*)$/);
    if (names === null || !extensions.includes(names[2])) {
      console.warn('invalid name or extension', summarizeConsoleValue(data.name));
      return await deleteAsset(data.name!);
    } else {
      const key = names[1];
      return await updateAssetsData(data, {key, folder, grade});
    }
  } else {
    return null;
  }
};

/**
 * アセット情報を削除する
 * @param folder
 * @param data
 * @returns
 */
export const deleteAssetsData = async (
  key: string,
  grade: GradeStr,
  folder: AssetFolderStr,
  noUpdateTimeStamp?: boolean,
) => {
  try {
    if (noUpdateTimeStamp === undefined) noUpdateTimeStamp = false;
    const ref = getValidationAssetDataRef(key, grade, folder);
    const values = (await ref.once('value')).val() as AssetData;
    // statusがprocessingの場合は削除しない
    if (values.status === StatusList.processing) return null;
    await ref.update({
      ...values,
      ...{status: StatusList.deleted, updatedAt: Timestamp.now()},
    });
    if (noUpdateTimeStamp) return null;
    return await admin
      .firestore()
      .collection('metadata')
      .doc(`${grade}LastUpdate`)
      .update({assets: Timestamp.now(), [values.folder]: Timestamp.now()});
  } catch (e) {
    throw new https.HttpsError('unknown', 'unknown error', e);
  }
};

/**
 * ストレージの指定アセットを削除
 */
export const deleteAsset = async (name: string) => {
  try {
    const bucket = getBucket();
    const file = bucket.file(name);
    const result = await file.delete();

    return result;
  } catch (e) {
    throw new https.HttpsError('unknown', 'delete file error', e);
  }
};

/** DBのassets/{grade}/image/内のリストにあるファイルの中からstatus:deletedのものに対して
 *  Storageに存在しているかチェックを行う。存在していた場合はDBのstatusをactiveに変更する
 */
export const checkDeletedImageAssets = async (grade: string) => {
  try {
    const bucket = getBucket();
    const ref = admin.database().ref(`assets/${grade}/image`);
    const snapshot = await ref.once('value');
    const values = snapshot.val() as {[key: string]: AssetData};
    const updateTargets = [];
    const notExists = [];
    for (const key in values) {
      if (values[key].status === 'deleted') {
        const file = bucket.file(`assets/${grade}/image/${key}.png`);
        const [exists] = await file.exists();
        if (exists) {
          await ref.child(key).update({status: 'active'});
          updateTargets.push(key);
        } else {
          notExists.push(key);
        }
      }
    }
    return {
      status: 'success',
      message: 'check deleted assets success',
      updateTargets,
      notExists,
    };
  } catch (e) {
    throw new https.HttpsError('unknown', 'check deleted assets error', e);
  }
};

/** storage内の/assets/{grade}/b64/にあるファイルを
 * zip化して/assets/{grade}/zip/に保存する
 */
export const updateGradeB64Zip = async (grade: GradeStr) => {
  try {
    const bucket = getBucket();
    // 権限を持ったユーザーかどうかを確認
    const zipFileName = `assets/${grade}/bzip/_.zip`;
    const output = bucket.file(zipFileName).createWriteStream();


    const archive = archiver.create('zip', {
      zlib: {level: 7}, // Sets the compression level.
    });

    archive.pipe(output);

    // assets/{grade}/b64/のファイルをZIPに追加
    const directories = [`assets/${grade}/b64/`];
    for (const directory of directories) {
      const [files] = await bucket.getFiles({prefix: directory});
      for (const file of files) {
        const filePath = file.name;
        archive.append(bucket.file(filePath).createReadStream(), {
          name: filePath,
        });
      }
    }

    await archive.finalize();
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (typeof e === 'string') throw new Error(e);
    throw new Error('zip error');
  }
};

export const processImageToBase64 = async (filePath: string) => {
  // 正規表現でファイルパスが対象パスであるかチェック
  // 例: assets/firstGrade/image/filename.png または assets/secondGrade/image/filename.png
  const regex = /^assets\/(firstGrade|secondGrade)\/image\/(.+)\.png$/i;
  const match = filePath.match(regex);
  if (!match) {

    throw new Error(`Invalid file path: ${filePath}`);
  }
  const grade = match[1];
  const fileName = match[2];


  try {
    // バケット取得
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    // ファイルをメモリにダウンロード
    const [buffer] = await file.download();
    const base64Content = buffer.toString('base64');

    // 保存先パスを設定: assets/{grade}/b64/{filename}.b64
    const destPath = `assets/${grade}/b64/${fileName}.b64`;
    const destFile = bucket.file(destPath);

    // base64文字列をテキストファイルとして保存
    await destFile.save(base64Content, {
      contentType: 'text/plain',
    });
    console.log(`Base64変換後ファイルを保存しました: ${destPath}`);
    // メタデータを取得
    const metadata = await destFile.getMetadata();
    return metadata[0] as functions.storage.ObjectMetadata;
  } catch (error) {
    console.error('画像のbase64変換処理に失敗しました:', error);
    throw new Error(`Failed to process image: ${filePath}`);
  }
};

// processImageToBase64をfirstGradeまたはSecondGradeのimageフォルダ内のすべてのPNGファイルに対して実行
// 失敗した場合、失敗したファイル名をログに出力
export const processAllImagesToBase64 = async (grade: GradeStr) => {
  try {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({prefix: `assets/${grade}/image/`});
    const pngFiles = files.filter((file) => file.name.endsWith('.png'));

    const errorFiles: string[] = [];
    for (const file of pngFiles) {
      try {
        await processImageToBase64(file.name);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errorFiles.push(file.name);
      }
    }
    return {
      status: 'success',
      message: 'すべての画像のbase64変換処理が完了しました',
      errorFiles: errorFiles,
    };
  } catch (error) {
    console.error('すべての画像のbase64変換処理に失敗しました:', error);
    throw error;
  }
};

// 該当ファイルパスからファイルの有無を確認し、statusがprocessingの場合、メタデータを参照してAssetDataを更新する
export const checkFileAndUpdateAssetData = async (
  filePath: string,
  grade: GradeStr,
  folder: AssetFolderStr,
) => {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(`assets/${grade}/${folder}/${filePath}.${folder}`);
    const [exists] = await file.exists();
    if (exists) {

      const metadata = await file.getMetadata();

      if (metadata[0].updated) {
        return await updateAssetsData(
          {
            ...metadata[0],
            updated: metadata[0].updated,
            bucket: metadata[0].bucket ?? bucket.name,
            size: String(metadata[0].size ?? 0),
            generation: String(metadata[0].generation ?? 0),
          },
          {key: filePath.split('/').pop()!, folder, grade},
        );
      }
      return null;
    } else {

      return null;
    }
  } catch (error) {
    console.error('Error checking file and updating asset data:', error);
    throw error;
  }
};
