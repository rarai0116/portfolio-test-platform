// Manual Jest mock for @dr.pogodin/react-native-fs (native filesystem module)
module.exports = {
  __esModule: true,
  DocumentDirectoryPath: '/mock/document',
  LibraryDirectoryPath: '/mock/library',
  CachesDirectoryPath: '/mock/caches',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
  readDir: jest.fn(async () => []),
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({size: 0, isFile: () => true, isDirectory: () => false})),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({statusCode: 200, bytesWritten: 0}),
  })),
  resumeDownload: jest.fn(),
  stopDownload: jest.fn(),
  isResumable: jest.fn(async () => false),
};
