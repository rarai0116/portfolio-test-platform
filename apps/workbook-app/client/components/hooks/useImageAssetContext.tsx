import {summarizeConsoleValue} from '../functionals/consoleLevels';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {getLibDirectory} from '@functionals/adjusttestData';
import type {Asset, AssetList} from '@functionals/realtimeDatabaseController';
import {getIdToken} from '@react-native-firebase/auth';
// import * as RNFS from '@dr.pogodin/react-native-fs';
import {getDownloadURL, getStorage, ref} from '@react-native-firebase/storage';
import {PromisePool} from '@supercharge/promise-pool';
import _ from 'lodash';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {Platform} from 'react-native';
import Constants from 'expo-constants';
import {normalizeAssetDownloadUrl} from '../functionals/normalizeAssetDownloadUrl';
import {downloadZipFile} from '../functionals/downloadZipFile';
import {unzip} from 'react-native-zip-archive';
import app from '../functionals/firebase';
import {localDownloadStates} from '../functionals/realtimeDatabaseController';
import {StorageContext} from './useAsyncStorageContext';
import {AuthContext} from './useAuthContext';
import {GlobalSaveDataContext} from './useGlobalSaveDataContext';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';

type ErrorsType = Error[];
type ValueType = {
  localAssetList: AssetList | null;
  setLocalAssetList: React.Dispatch<React.SetStateAction<AssetList | null>>;
  assetDownloadedSize: number;
  downloadList: AssetList;
  setDownloadList: React.Dispatch<React.SetStateAction<AssetList>>;
  setDownloadImageCaches: (getList?: AssetList) => Promise<{
    successes: Asset[];
    errors: ErrorsType;
  }>;
  downloadZip: (uri: string) => Promise<AssetList>;
  loadingBarPercent: number | null;
  setLoadingBarPercent: React.Dispatch<React.SetStateAction<number | null>>;
  deleteAllAssets: () => Promise<'success' | 'error'>;
  isDownloadFailed: boolean;
  setIsDownloadFailed: React.Dispatch<React.SetStateAction<boolean>>;
  deletePngFiles: (path?: string) => Promise<void>;
};
type Props = {
  readonly children: ReactNode;
};
export const ImageAssetContext = createContext<ValueType>({} as ValueType);

const storage = getStorage(app);

const getAssetDownloadURL = async (path: string) =>
  normalizeAssetDownloadUrl(
    await getDownloadURL(ref(storage, path)),
    Constants.expoConfig?.extra ?? {},
  );

export const ImageAssetContextProvider = (props: Props) => {
  const {getAssetLisInStorage, setAssetLisInStorage} =
    useContext(StorageContext);
  const {localAssetList, setLocalAssetList, basisDir} = useContext(
    GlobalSaveDataContext,
  );
  const {isOffline} = useContext(GlobalUserSettingContext);
  const {loginUser} = useContext(AuthContext);
  const [downloadList, setDownloadList] = useState<AssetList>({});
  //	const [downloadData, setDownloadData] = useState<number>(0);
  const [assetDownloadedSize, setAssetDownloadedSize] = useState<number>(0);
  const [downloadJobId, setDownloadJobId] = useState<number | null>(null);
  const [storageAssetUpdatedCount, setStorageAssetUpdatedCount] =
    useState<number>(0);
  const [loadingBarPercent, setLoadingBarPercent] = useState<number | null>(
    null,
  );
  const [isDownloadFailed, setIsDownloadFailed] = useState<boolean>(false);
  //	const [updateAssetList, setUpdateAssetList] = useState<boolean>(false);
  /** 起動時にローカルアセットをストレージから読み込み */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    //		console.log('ローカルアセット取得待機', isAuthenticated, updateAssetList);
    //		if (isAuthenticated || updateAssetList) {
    // AsyncStorageからImageAssetListを取得する
    getAssetLisInStorage()
      .then((_data) => {
        // console.log('アセットリスト更新', _data);
        if (_data) {
          // _dataからfoler:imageのものを削除
          const data = Object.keys(_data).reduce<AssetList>((acc, key) => {
            if (_data[key].folder !== 'image') {
              acc[key] = _data[key];
            }

            return acc;
          }, {});
          setLocalAssetList((previous) => {
            return {...previous, ...data};
          });
        } else {
          setLocalAssetList({});
        }
      })
      .catch((error: unknown) => {
        console.error('ImageAssetContextProvider：処理失敗', error);
      });
    //		}
  }, []);
  useEffect(() => {
    if (Platform.OS === 'ios' && !isOffline && downloadJobId !== null) {
      RNFS.isResumable(downloadJobId)
        .then((isResumable) => {
          if (isResumable) RNFS.resumeDownload(downloadJobId);
        })
        .catch((error: unknown) => {
          console.error('ImageAssetContextProvider：処理失敗', error);
          throw new Error('ダウンロードの再開に失敗しました');
        });
    }
  }, [isOffline, downloadJobId]);

  /** localAssetが変更された場合、ストレージのAssetListを同期的に変更する */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (localAssetList !== null) {
      setStorageAssetUpdatedCount((previous) => previous + 1);
      if (
        Object.keys(localAssetList).length > 0 &&
        storageAssetUpdatedCount > 0
      )
        console.log(
          'localAssetListInStorageUpdate',
          summarizeConsoleValue(localAssetList),
        );
      setAssetLisInStorage(localAssetList).catch((error: unknown) => {
        console.error('setAssetLisInStorageエラー', error);
        throw new Error('アセットリストの保存に失敗しました');
      });
    }
  }, [localAssetList, setAssetLisInStorage]);

  /**
   * ダウンロード予定のイメージリストをダウンロードしてキャッシュ化
   * @returns {results:成功データ, errors:キャッシュ化失敗リスト}
   */
  const setDownloadImageCaches = useCallback(
    async (getList?: AssetList) => {
      if (loginUser === null) throw new Error('ログインしていません');
      const basisSavedDir = `${basisDir}/_/`;
      // basisSavedDirがない場合は作成
      const basisDirInfo = await RNFS.stat(basisSavedDir).catch(
        (error: unknown) => {
          console.error('setDownloadImageCaches：処理失敗', error);
          throw new Error('ベースディレクトリーの取得に失敗しました');
        },
      );
      // const basisDirInfo = await FileSystem.getInfoAsync(basisSavedDir);
      if (!basisDirInfo.isDirectory())
        await RNFS.mkdir(basisSavedDir).catch((error: unknown) => {
          console.error('setDownloadImageCaches：処理失敗', error);
          throw new Error('ベースディレクトリーの作成に失敗しました');
        });
      // if (!basisDirInfo.exists) await FileSystem.makeDirectoryAsync(basisSavedDir);
      // libフォルダがない場合は作成
      await getLibDirectory();

      // console.log(getList);
      // console.log(downloadList);
      getList ??= downloadList;
      // ダウンロードが済んでいないもののみを抽出
      const actualGetList: AssetList = Object.values(getList)
        .filter(
          (asset) =>
            asset.localDownloadStatus !== localDownloadStates.downloaded,
        )
        .reduce<AssetList>((acc, asset) => {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          return {...acc, [asset.name]: asset};
        }, {});
      // 一つもダウンロードするものがない場合は終了
      if (Object.keys(actualGetList).length === 0) {
        return {successes: [], errors: []};
      }

      const token = await getIdToken(loginUser, true);
      const _errors: Error[] = [];
      let dataSize = 0;
      const {results} = await PromisePool.for(Object.values(getList))
        .withConcurrency(5) // 並列数の指定
        .handleError(async (error) => {
          // エラー時の処理を指定
          console.error('handleError：処理失敗', error);
          _errors.push(error);
        })
        .process<Asset>(async (data) => {
          //          console.log('⭐︎data', data);
          const name = (() => {
            switch (data.folder) {
              case 'b64': {
                return `${data.name}.b64`;
              }

              case 'html': {
                // %2Fを/に変換
                const path =
                  /\/([^/]+)$/.exec(data.path.replaceAll('%2F', '/'))?.[1] ??
                  '';
                //                console.log('path', path);
                if (path === '') return '';
                // data.nameに_lib_が含まれている場合、pathにlib/を追加
                if (data.name.startsWith('_lib_')) return `lib/${path}`;
                return path;
              }

              default: {
                return '';
              }
            }
          })();
          if (name === '') throw new Error('不正なパスを検出しました');
          const uri = `assets/${data.grade}/${data.folder}/${name}`;
          // const downloadUri = data.path;

          /*
					setAssetDownloadedSize((previous) => {
						const size = data.size;
						return previous + size;
					});
					*/
          // ダウンロード済みの場合はスキップ
          if (data.localDownloadStatus === localDownloadStates.downloaded) {
            const {size} = data;
            dataSize += size;
            return {
              ...data,
              localPath: `_/${name}`,
              localDownloadStatus: localDownloadStates.downloaded,
            };
          }

          const downloadUri = await getAssetDownloadURL(uri).catch(
            (error: unknown) => {
              console.error('process：処理失敗', error);

              throw new Error('ダウンロードURL取得失敗');
            },
          );

          const localPath = `${basisSavedDir}${name}`;

          const downloadedFile = await RNFS.downloadFile({
            fromUrl: downloadUri,
            toFile: localPath,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).promise;
          /*
          const downloadedFile: FileSystem.FileSystemDownloadResult =
            await FileSystem.downloadAsync(downloadUri, localPath, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            */

          // console.log(downloadedFile);
          // const localPath = await CacheManager.get(downloadUri, {}).getPath();
          if (downloadedFile === undefined) throw new Error('ダウンロード失敗');
          if (downloadedFile.statusCode !== 200)
            throw new Error('ダウンロード失敗');

          const {size} = data;
          setAssetDownloadedSize((previous) => {
            return previous + dataSize + size;
          });
          dataSize = 0;
          return {
            ...data,
            status: 'active',
            localPath: `_/${name}`,
            localDownloadStatus: localDownloadStates.downloaded,
          };
        });
      // 成功情報を保存
      // setSuccesses(results);
      // 失敗情報を保存
      // setErrors(_errors);

      console.error('setDownloadImageCaches：処理失敗', _errors);

      try {
        /*
				const _successes = results.reduce<AssetList>((acc, result) => {
					return {...acc, [result.name]: result};
				}, localAssetList ?? {});
				*/

        /*
				const resultsNameList = new Set(results.map((result) => result.name));
				const _successes = Object.keys(getList).reduce<AssetList>(
					(acc, key) => {
						if (resultsNameList.has(key)) {
							const asset = getList![key];
							const result = results.find(
								(result) => result.name === asset.name,
							);
							console.log(result);
							if (result) {
								const successAsset: Asset = {
									...asset,
									localPath: result.localPath,
									localDownloadStatus: localDownloadStates.downloaded,
								};
								return {...acc, [key]: successAsset};
							}
						}

						return acc;
					},
					localAssetList ?? {},
				);
				console.log(_successes);
				*/
        return {successes: results, errors: _errors};
      } catch (error: unknown) {
        console.error('setDownloadImageCaches：処理失敗', error);
        throw new Error('ダウンロード情報の保存に失敗しました');
      }
    },

    [basisDir, downloadList, loginUser],
  );
  /**
   * ローカルのzipデータを削除する
   * @param {string} localPath 削除するzipファイルの保存先
   * @returns {Promise<void>}
   */
  const deleteZip = useCallback(async (localPath: string) => {
    // await FileSystem.deleteAsync(localPath);
    await RNFS.unlink(localPath).catch((error: unknown) => {
      console.error('deleteZip：処理失敗', error);
      throw new Error('zipファイルの削除に失敗しました');
    });
  }, []);

  const attatchDownloadResumable = useCallback(
    (uri: string, localPath: string, token: string) => {
      setIsDownloadFailed(false);
      const process = downloadZipFile(
        uri,
        localPath,
        token,
        setLoadingBarPercent,
      );
      setDownloadJobId(process.jobId);
      return {
        jobId: process.jobId,
        promise: process.promise
          .catch((error: unknown) => {
            setIsDownloadFailed(true);
            throw error;
          })
          .finally(() => {
            setDownloadJobId((current) =>
              current === process.jobId ? null : current,
            );
          }),
      };
    },
    [],
  );
  /**
   * basisDir/_ディレクトリ配下のファイルをすべて削除する
   * @returns {success | error} 結果
   */
  const deleteAllAssets = useCallback(async () => {
    if (basisDir === null)
      throw new Error('ベースディレクトリーが取得できませんでした');
    const path = `${basisDir}_/`;
    const isSuccess = await RNFS.unlink(path)
      .then(() => {
        return true;
      })
      .catch((error: unknown) => {
        console.error('deleteAllAssets：処理失敗', error);
        return false;
      });
    if (isSuccess) {
      setLocalAssetList({});
    }

    return isSuccess ? 'success' : 'error';
  }, [basisDir, setLocalAssetList]);

  /**
   * zipデータをダウンロードして展開する
   * @param {string} grade grade名
   * @returns {Promise<string>} 展開したファイルの保存先
   */
  const downloadZip = useCallback(
    async (grade: string) => {
      if (loginUser === null) throw new Error('ログインしていません');
      if (basisDir === null)
        throw new Error('ベースディレクトリーが取得できませんでした');
      const localPath = `${basisDir}_.zip`;
      const _downloadList = _.cloneDeep(downloadList);
      try {
        /*
        const timer = setTimeout(() => {
          console.log('ダウンロードURI取得タイムアウト');
          console.log(isDownloadFailed);
          setIsDownloadFailed(true);
        }, 5000);
        */
        const uri = await getAssetDownloadURL(
          `assets/${grade}/bzip/_.zip`,
        ).catch((error: unknown) => {
          console.error('ダウンロードURI取得に失敗しました', error);
          // zipファイルのダウンロードに失敗した場合は全てダウンロード失敗として扱う
          for (const key of Object.keys(_downloadList)) {
            _downloadList[key].localDownloadStatus = localDownloadStates.error;
          }

          setDownloadList((_previous) => _downloadList);
          return 'error';
        });
        // トークン情報を削除する(token=~~~)
        // const uri = _uri.replace(/&token=.+$/, '');
        console.log('zipダウンロード開始', grade);
        // clearTimeout(timer);
        if (uri === 'error') {
          throw new Error('ダウンロードURI取得に失敗しました');
        }

        const token = await getIdToken(loginUser, true);
        const downloadResumable = attatchDownloadResumable(
          uri,
          localPath,
          token,
        );

        const downloadedFile = await downloadResumable.promise.catch(
          (error: unknown) => {
            console.error('downloadZip：処理失敗', error);
            throw new Error('zipファイルのダウンロードに失敗しました');
          },
        );
        console.info('downloadedFile', summarizeConsoleValue(downloadedFile));
        // const downloadedFile = await downloadResumable.downloadAsync();
        if (downloadedFile === undefined) throw new Error('ダウンロード失敗');
        if (downloadedFile.statusCode !== 200)
          throw new Error('ダウンロード失敗');
      } catch (error: unknown) {
        console.error('downloadZip：処理失敗', error);
        throw new Error('zipファイルのダウンロード処理に失敗しました');
      }

      try {
        console.info(
          'unzip operation',
          summarizeConsoleValue(localPath),
          summarizeConsoleValue(basisDir),
        );
        const unzipped = await unzip(localPath, basisDir).catch(
          (error: unknown) => {
            console.error('downloadZip：処理失敗', error);
            throw new Error('展開失敗');
          },
        );
        console.info(
          'unzipped',
          summarizeConsoleValue(unzipped),
          `${basisDir}_`,
        );
        const files = await RNFS.readDir(`${basisDir}_/`).catch(
          (error: unknown) => {
            console.error('downloadZip：処理失敗', error);
            throw new Error('ファイルリストの取得に失敗しました');
          },
        );
        /*
        const files = await FileSystem.readDirectoryAsync(`${basisDir}_/`)
          .then((files_) => files_)
          .catch((error: unknown) => {
            console.log(error);
            throw new Error('ファイルリストの取得に失敗しました');
          });
        */
        const newAssetList: Asset[] = [];
        const assetDownloadedProcess = (id: string, _localPath: string) => {
          if (_downloadList[id]) {
            _downloadList[id].localPath = _localPath;
            _downloadList[id].localDownloadStatus =
              localDownloadStates.downloaded;
            newAssetList.push(_downloadList[id]);
          } else {
            // ダウンロードリストに存在しない場合はファイルを削除
            /*
            RNFS.unlink(`${basisDir}${_localPath}`).catch((error: unknown) => {
              console.log(error);
              throw new Error('ファイルの削除に失敗しました');
            });
            */
            /*
            FileSystem.deleteAsync(`${basisDir}${_localPath}`).catch(
              (error) => {
                console.log(error);
                throw new Error('ファイルの削除に失敗しました');
              },
            );
            */
          }
        };

        // ファイル群にダウンロード済み処理を行う
        const processFiles = async (files: RNFS.ReadDirResItemT[]) => {
          await PromisePool.withConcurrency(5) // 同時に実行する非同期処理の数を制限します
            .for(files)
            .process(async (file) => {
              if (file.isDirectory() && file.name === 'lib') {
                const libFiles = await RNFS.readDir(`${basisDir}_/lib`).catch(
                  (error: unknown) => {
                    console.error('process：処理失敗', error);
                    throw new Error('libファイルリストの取得に失敗しました');
                  },
                );

                await PromisePool.withConcurrency(2)
                  .for(libFiles)
                  .process(async (libFile) => {
                    const libId = `_lib_${libFile.name}`.replace(
                      /\.[^/.]+$/,
                      '',
                    );
                    // libフォルダーに存在するファイルはダウンロード済みとする
                    assetDownloadedProcess(libId, `_/lib/${libFile.name}`);
                  });
              } else {
                const id = file.name.replace(/\.[^/.]+$/, '');
                assetDownloadedProcess(id, `_/${file.name}`);
              }
            });
        };

        if (files.length > 0) await processFiles(files);
        /*
        await Promise.all(
          files.map(async (file) => {
            if (file.isDirectory() && file.name === 'lib') {
              const libFiles = await RNFS.readDir(`${basisDir}_/lib`).catch(
                (error) => {
                  console.log(error);
                  throw new Error('libファイルリストの取得に失敗しました');
                },
              );
              await Promise.all(
                libFiles.map(async (libFile) => {
                  const libId = `_lib_${libFile.name}`.replace(/\.[^/.]+$/, '');
                  // libフォルダーに存在するファイルはダウンロード済みとする
                  assetDownloadedProcess(libId, `_/lib/${libFile.name}`);
                }),
              );
            } else {
              const id = file.name.replace(/\.[^/.]+$/, '');
              assetDownloadedProcess(id, `_/${file.name}`);
            }
          }),
        );
        */

        setDownloadList((_previous) => _downloadList);
        deleteZip(localPath).catch((error: unknown) => {
          console.error('downloadZip：処理失敗', error);
          console.error('zipファイルの削除に失敗しました');
        });
        return _downloadList;
      } catch (error: unknown) {
        console.error('downloadZip：処理失敗', error);
        deleteZip(localPath).catch((error_: unknown) => {
          console.info('downloadZip：処理情報', summarizeConsoleValue(error_));
          throw new Error('zipファイルの削除に失敗しました/');
        });
        throw new Error('zipファイルのダウンロードまたは展開に失敗しました');
      }
    },
    [loginUser, deleteZip, downloadList, attatchDownloadResumable, basisDir],
  );
  /**
   * フォルダ内の全てのpngファイルを削除する
   * @param {string} path 削除するフォルダのパス
   * @returns {Promise<void>}
   */
  const deletePngFiles = useCallback(
    async (path?: string) => {
      path ??= `${basisDir}_/`;
      const _files = await RNFS.readDir(path).catch((error: unknown) => {
        console.error('deletePngFiles：処理失敗', error);
        throw new Error('ファイルリストの取得に失敗しました');
      });
      const files = _files.filter((file) => {
        return file.name.endsWith('.png');
      });

      if (files.length === 0) return;

      await PromisePool.withConcurrency(5) // 同時に実行する非同期処理の数を制限します
        .for(files)
        .process(async (file) => {
          const filePath = `${path}${file.name}`;

          await RNFS.unlink(filePath).catch((error: unknown) => {
            console.error('process：処理失敗', error);
            throw new Error('pngファイルの削除に失敗しました');
          });
        });
    },
    [basisDir],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      localAssetList,
      setLocalAssetList,
      loadingBarPercent,
      setLoadingBarPercent,
      assetDownloadedSize,
      downloadList,
      setDownloadList,
      setDownloadImageCaches,
      downloadZip,
      deleteAllAssets,
      isDownloadFailed,
      setIsDownloadFailed,
      deletePngFiles,
    };
  }, [
    localAssetList,
    setLocalAssetList,
    loadingBarPercent,
    setLoadingBarPercent,
    assetDownloadedSize,
    setDownloadImageCaches,
    downloadList,
    setDownloadList,
    downloadZip,
    deleteAllAssets,
    isDownloadFailed,
    setIsDownloadFailed,
    deletePngFiles,
  ]);
  return (
    <ImageAssetContext.Provider value={value}>
      {props.children}
    </ImageAssetContext.Provider>
  );
};

export const useImageAsset = () => useContext(ImageAssetContext);
