import {
  getDatabase,
  goOnline,
  goOffline,
  ref,
  onValue,
  setPersistenceEnabled,
  setPersistenceCacheSizeBytes,
  get,
  onChildChanged,
} from '@react-native-firebase/database';
import type * as FirebaseDatabaseTypes from '@react-native-firebase/database';
import * as RNFS from '@dr.pogodin/react-native-fs';
import type {GradeCommonType} from '../../types/commonUnionType';
// import {getStorageMetaData} from './firebaseStorageManager';
import {getBaseDirectory, getLibDirectory} from './adjusttestData';
import app from './firebase';

export const localDownloadStates = {
  none: 'none',
  downloaded: 'downloaded',
  error: 'error',
} as const;
export type LocalDownloadStatus =
  (typeof localDownloadStates)[keyof typeof localDownloadStates];
export type Asset = {
  name: string;
  status: StatusType;
  size: number;
  path: string;
  contentType: string;
  folder: string;
  grade: string;
  bucket: string;
  generation: number | undefined;
  updatedAt: {
    _nanoseconds: number;
    _seconds: number;
  };
  localPath?: string;
  localDownloadStatus?: LocalDownloadStatus;
};
export type AssetList = Record<string, Asset>;
export const AssetStatus = {
  active: 'active',
  deleted: 'deleted',
} as const;
export type StatusType = (typeof AssetStatus)[keyof typeof AssetStatus];

export const db = getDatabase(app);
setPersistenceEnabled(db, true);
setPersistenceCacheSizeBytes(db, 100_000_000);

// テストデータを取得
export const getTestData: (
  grade: GradeCommonType,
  isRetry?: boolean,
) => Promise<FirebaseDatabaseTypes.DataSnapshot> = async (grade, _isRetry) => {
  return new Promise((resolve, _reject) => {
    /*
    db.ref(`test/${grade}`)
      .once('value', (snapshot) => {
        console.log('get testdata success', snapshot.val());
        resolve(snapshot);
      })
      .catch((error: unknown) => {
        console.error('firebaseからのTestData取得失敗', error);
        if (isRetry) throw new Error('テストデータの取得に完全に失敗しました');
        getLocalTestData(grade, true)
          .then((result) => {
            console.log('getLocalTestData', result.val());
            resolve(result);
          })
          .catch((error: unknown) => {
            console.error('get local and network TestData Error', error);
            reject(error);
          });
      });
    */
    onValue(ref(db, `test/${grade}`), (snapshot) => {
      resolve(snapshot);
    });
  });
};

export const getLocalTestData: (
  grade: GradeCommonType,
  isRetry?: boolean,
) => Promise<FirebaseDatabaseTypes.DataSnapshot> = async (grade, isRetry) => {
  return new Promise((resolve, reject) => {
    Promise.resolve(goOffline(db))
      .then(() => {
        get(ref(db, `test/${grade}`))
          .then((snapshot) => {
            resolve(snapshot);
          })
          .catch((error: unknown) => {
            console.error('getLocalTestData：処理失敗', error);
            if (isRetry)
              throw new Error('テストデータの取得に完全に失敗しました');
            getTestData(grade, true).catch((error: unknown) => {
              console.error('getLocalTestData：処理失敗', error);
              throw new Error('テストデータの取得に完全に失敗しました');
            });
          });
      })
      .catch((error: unknown) => {
        console.error('getLocalTestData：処理失敗', error);
        reject(new Error('テストデータのオフライン取得に失敗しました'));
      });
  });
};

// ストレージリストのデータを取得
// 古いデータを取得してしまう場合がある
export const getDatabaseAssetsList: (
  grade: GradeCommonType,
) => Promise<AssetList> = async (grade) => {
  try {
    await goOnline(db);
    const _ref = ref(db, `assets/${grade}/b64/`);

    // これをしないと.once('value')が最新のデータを取得しない
    const _addImage = onChildChanged(_ref, (snapshot) => {
      return snapshot;
    });
    const _addHtml = onChildChanged(
      ref(db, `assets/${grade}/html/`),
      (snapshot) => {
        return snapshot;
      },
    );

    const _addCommonHtml = onChildChanged(
      ref(db, `assets/common/html/`),
      (snapshot) => {
        return snapshot;
      },
    );

    const image = await get(_ref)
      .catch((_error: unknown) => {
        throw new Error('データリストの取得に失敗しました');
      })
      .then((snapshot) => {
        return snapshot;
      });

    const html = await get(ref(db, `assets/${grade}/html/`)).catch(
      (error: unknown) => {
        console.error('getDatabaseAssetsList：処理失敗', error);
        throw new Error('データリストの取得に失敗しました');
      },
    );

    const commonHtml = await get(ref(db, `assets/common/html/`)).catch(
      (error: unknown) => {
        console.error('getDatabaseAssetsList：処理失敗', error);
        throw new Error('データリストの取得に失敗しました');
      },
    );

    return {
      ...(html.val() as AssetList),
      ...(image.val() as AssetList),
      ...(commonHtml.val() as AssetList),
    };
  } catch (error: unknown) {
    console.error('getDatabaseAssetsList：処理失敗', error);
    throw new Error('データリストの取得に失敗しました');
  }
};

export const getNewestZipFile: (grade: GradeCommonType) => Promise<AssetList> =
  async (grade) => {
    try {
      await goOnline(db);
      const _ref = ref(db, `assets/${grade}/zip/`);
      const zip = await get(_ref);
      // zipリストの中から
      return zip.val() as AssetList;
    } catch (error: unknown) {
      console.error('getNewestZipFile：処理失敗', error);
      throw new Error('データリストの取得に失敗しました');
    }
  };

/** checkAndReadDir
 *  指定パスのディレクトリの存在確認をした後、そのディレクトリのファイルリストを読み込む
 *  ディレクトリがない場合は作成する
 */
const checkAndReadDir = async (path: string) => {
  try {
    const dirExists = await RNFS.exists(path);
    //    const dir = await FileSystem.getInfoAsync(path);
    if (!dirExists)
      await RNFS.mkdir(path).catch((error: unknown) => {
        console.error('checkAndReadDir：処理失敗', error);
        throw new Error('ディレクトリの作成に失敗しました');
      });
    // await FileSystem.makeDirectoryAsync(path, {intermediates: true});
    // return await FileSystem.readDirectoryAsync(path);
    return await RNFS.readDir(path).then((result) => {
      return result.map((file) => file.name);
    });
  } catch (error) {
    console.error('checkAndReadDir：処理失敗', error);
    throw new Error('ディレクトリの読み込みに失敗しました');
  }
};

/** 画像リストの更新チェック
 *  キャッシュされている既存の画像リスト(once)とサーバーの画像リスト(get)を比較して
 *  更新/追加画像・削除画像のリストを返す
 *  @returns {server: AssetList;local: AssetList;update: AssetList;delete: AssetList;updateSize: number;}
 */

export const checkTargetsStorageList = async (
  grade: GradeCommonType,
  localChaches: AssetList,
): Promise<{
  serverAssetList: AssetList;
  localAssetList: AssetList;
  updateAssetList: AssetList;
  deleteAssetList: AssetList;
  updateSize: number;
}> => {
  // const localChaches = await getLocalAssetsList(grade);
  const serverChaches = await getDatabaseAssetsList(grade);

  const deleteChaches = Object.entries(localChaches).filter(
    ([key, localChache]) => {
      // delete
      // if (!serverChaches[key]) return true;
      if (
        serverChaches[key] &&
        localChache.status === AssetStatus.active &&
        serverChaches[key].status === AssetStatus.deleted
      )
        return true;
      return false;
    },
  );

  const baseDir = await getBaseDirectory();
  if (!baseDir) throw new Error('基準ディレクトリの取得に失敗しました');
  const filesDir = `${baseDir}_/`;
  const filesDirExistFiles = await checkAndReadDir(filesDir);
  const libDir = await getLibDirectory();
  const libDirExistsFiles = await checkAndReadDir(libDir);

  const updateTargets = Object.entries(serverChaches).filter(
    ([key, serverChache]) => {
      /** 暫定処理 */
      const alwaysDownloadList: string[] = [
        /*
				'_lib_answerScript',
				'_lib_questionScript',
				'_lib_questionStyle',
				'_lib_answerStyle',
				*/
      ];
      if (alwaysDownloadList.includes(key)) {
        if (localChaches[key]) {
        }

        return true;
      }

      // deleted
      if (serverChache.status === 'deleted') {
        /* console.log(
          'server側のファイルのstatusがdeletedです',
          key,
          localChaches[key],
        );
        */
        return false;
      }

      // add
      if (!localChaches[key]) {
        // console.log('localChachesに存在しません', key, localChaches[key]);
        return true;
      }

      if (localChaches[key].localDownloadStatus !== 'downloaded') {
        /* console.log(
          'localDownloadStatusがdownloadedではありません',
          key,
          localChaches[key],
        );
        */
        return true;
      }

      const localPath = localChaches[key]?.localPath;
      if (!localPath) {
        // console.log('localPathがありません', key, localChaches[key]);
        return true;
      }

      // console.log(key, localChaches[key]);
      // update
      // console.log(serverChache);
      if (localChaches[key].generation !== serverChache.generation) {
        /*
        console.log(
          '更新されています',
          'generation',
          key,
          localChaches[key].generation,
          serverChache.generation,
        );
        */
        return true;
      }

      // file exist check

      if (localPath?.includes('lib/')) {
        const fileName = localPath.split('/').pop();
        const info = libDirExistsFiles.includes(fileName!);
        /*
        if (!info)
          console.log(
            'Libディレクトリに対象ファイルが存在しません',
            fileName,
            localChaches[key].localPath,
            info,
          );
          */
        return !info;
      }

      const fileName = localPath?.split('/').pop();
      const info = filesDirExistFiles.includes(fileName!);
      /*
      if (!info)
        console.log(
          'ファイルが存在しません',
          fileName,
          localChaches[key].localPath,
          info,
        );
        */
      return !info;
    },
  );
  const updateChaches = updateTargets.reduce<AssetList>((acc, c) => {
    // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
    return {...acc, [c[0]]: c[1]};
  }, {});

  console.info(
    '更新対象ファイル抽出（件数）',
    Object.keys(updateChaches).length,
  );

  const updateChachesKeys = Object.keys(updateChaches);
  const updateSize =
    updateChachesKeys.length > 0
      ? updateChachesKeys.reduce((acc, key) => {
          if (updateChaches[key].status === 'deleted') return acc;
          if (typeof updateChaches[key].size !== 'number') {
            console.warn(
              'number型以外のファイルサイズを検出しました',
              key,
              updateChaches[key],
            );
            return acc;
          }

          return acc + updateChaches[key].size;
        }, 0)
      : 0;
  // AssetListに再変換
  const deleteValues: AssetList = {};
  for (const [_i, value] of deleteChaches.entries())
    deleteValues[value[0]] = value[1];

  return {
    serverAssetList: serverChaches,
    localAssetList: localChaches,
    updateAssetList: updateChaches,
    deleteAssetList: deleteValues,
    updateSize,
  };
};

/**
 * RealtimeDatabaseのにAssetに保存されている画像の情報を一括で書き込む(Obsolete)
 * @param items Assetから得たメタデータのリスト
 * @returns 成功ならtrue、失敗ならerrorオブジェクトを返す
 * @deprecated FirebaseStorageにAssetを保存したらメタデータを書き込む仕様にしたため不要となった
 * @returns {boolean}
 */
/*
export const setAssetsInfoList = async (
	items: StorageReference[],
	grade: GradeCommonType,
): Promise<boolean> => {
	return new Promise((resolve, error) => {
		const results: Array<Promise<FullMetadata>> = [];
		for (const item of items) {
			results.push(getStorageMetaData(item.fullPath));
		}

		Promise.all(results)
			.then((r) => {
				console.log(r);
				const db: AssetList = {};
				for (const [i, item] of items.entries()) {
					db[item.name.replace(/^(.+)\..+$/, '$1')] = {
						name: item.name,
						size: r[i].size,
						path: item.fullPath,
						grade: grade as string,
						bucket: item.bucket,
						generation: r[i].generation,
						timeCreated: r[i].timeCreated,
						updated: r[i].updated,
					};
					console.log(i);
				}

				console.log(db);
				// ディクショナリーに変換して書き込む
				set(storageRef, db)
					.then(() => {
						console.log('Data saved successfully!');
						resolve(true);
						// Data saved successfully!
					})
					.catch((error_) => {
						// The write failed...
						error(error_);
					});
			})
			.catch((error_) => {
				error(error_);
			});
	});
};
*/
