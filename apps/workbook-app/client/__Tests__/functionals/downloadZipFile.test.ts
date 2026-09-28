import * as RNFS from '@dr.pogodin/react-native-fs';
import {downloadZipFile} from '../../components/functionals/downloadZipFile';

jest.mock('@dr.pogodin/react-native-fs');

type Result = Awaited<ReturnType<typeof RNFS.downloadFile>['promise']>;
let options: Parameters<typeof RNFS.downloadFile>[0];
let resolve: (result: Result) => void;
let reject: (error: Error) => void;
let jobId: number;
const progress = (bytesWritten: number, contentLength = 100) =>
  options.progress?.({jobId, bytesWritten, contentLength});
const start = (onProgress = jest.fn()) =>
  downloadZipFile('http://localhost/archive.zip', '/tmp/_.zip', 'private-token', onProgress);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jobId = 1;
  jest.mocked(RNFS.exists).mockResolvedValue(true);
  jest.mocked(RNFS.downloadFile).mockImplementation((value) => {
    options = value;
    return {
      jobId,
      promise: new Promise<Result>((yes, no) => { resolve = yes; reject = no; }),
    };
  });
});
afterEach(() => jest.useRealTimers());

it('updates progress from zero after a previous transfer fails near completion', async () => {
  const onProgress = jest.fn();
  const first = start(onProgress);
  progress(99);
  const failed = expect(first.promise).rejects.toThrow('unexpected end of stream');
  reject(new Error('unexpected end of stream'));
  await failed;
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/_.zip');
  onProgress.mockClear();
  jobId = 2;
  const retry = start(onProgress);
  progress(1);
  progress(25);
  expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([0, 1, 25]);
  resolve({jobId, statusCode: 200, bytesWritten: 100});
  await retry.promise;
  expect(jest.getTimerCount()).toBe(0);
});

it('stops the current job even if no bytes have arrived and removes the timer after rejection', async () => {
  jobId = 7;
  const transfer = start();
  jest.advanceTimersByTime(5000);
  expect(RNFS.stopDownload).toHaveBeenCalledWith(7);
  const failed = expect(transfer.promise).rejects.toThrow('cancelled');
  reject(new Error('cancelled'));
  await failed;
  expect(jest.getTimerCount()).toBe(0);
});

it('refreshes the watchdog on progress and never stops a completed job', async () => {
  const transfer = start();
  jest.advanceTimersByTime(4000);
  progress(10);
  jest.advanceTimersByTime(4000);
  expect(RNFS.stopDownload).not.toHaveBeenCalled();
  resolve({jobId, statusCode: 200, bytesWritten: 100});
  await transfer.promise;
  jest.advanceTimersByTime(10000);
  expect(RNFS.stopDownload).not.toHaveBeenCalled();
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

it('discards an HTTP error response instead of treating it as a ZIP', async () => {
  const transfer = start();
  resolve({jobId, statusCode: 403, bytesWritten: 10});
  await expect(transfer.promise).rejects.toThrow('zipファイルのダウンロードに失敗しました');
  expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/_.zip');
  expect(jest.getTimerCount()).toBe(0);
});

it('does not publish invalid percentages when content length is unknown', async () => {
  const onProgress = jest.fn();
  const transfer = start(onProgress);
  progress(10, 0);
  expect(onProgress.mock.calls).toEqual([[0]]);
  resolve({jobId, statusCode: 200, bytesWritten: 100});
  await transfer.promise;
});
