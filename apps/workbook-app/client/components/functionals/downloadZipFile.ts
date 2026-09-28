import * as RNFS from '@dr.pogodin/react-native-fs';

/** ZIP転送ごとに進捗・監視タイマーを管理し、失敗した一時ファイルを削除する。 */
export const downloadZipFile = (
  uri: string,
  localPath: string,
  token: string,
  onProgress: (percent: number) => void,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPercent = 0;
  const clearTimer = () => clearTimeout(timer);
  const resetTimer = () => {
    clearTimer();
    timer = setTimeout(() => RNFS.stopDownload(process.jobId), 5000);
  };
  onProgress(0);
  const process = RNFS.downloadFile({
    fromUrl: uri,
    toFile: localPath,
    headers: {Authorization: `Bearer ${token}`},
    connectionTimeout: 5000,
    readTimeout: 5000,
    cacheable: false,
    progressInterval: 100,
    begin: resetTimer,
    progress: ({bytesWritten, contentLength}) => {
      resetTimer();
      if (contentLength <= 0) return;
      const percent = Math.min((bytesWritten / contentLength) * 100, 100);
      if (Math.floor(percent) > Math.floor(lastPercent)) {
        lastPercent = percent;
        onProgress(percent);
      }
    },
  });
  resetTimer();
  return {
    jobId: process.jobId,
    promise: process.promise
      .then((result) => {
        if (result.statusCode !== 200) {
          throw new Error('zipファイルのダウンロードに失敗しました');
        }
        return result;
      })
      .finally(clearTimer)
      .catch(async (error: unknown) => {
        try {
          if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);
        } catch {
          console.error('失敗したzipファイルの削除に失敗しました');
        }
        throw error;
      }),
  };
};
