// Manual Jest mock for @react-native-firebase/storage
module.exports = {
  __esModule: true,
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  getDownloadURL: jest.fn(async () => 'https://example.com/mock-file'),
};
