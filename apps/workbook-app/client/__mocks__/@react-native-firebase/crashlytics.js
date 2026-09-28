// Manual Jest mock for @react-native-firebase/crashlytics
module.exports = {
  __esModule: true,
  getCrashlytics: jest.fn(() => ({
    recordError: jest.fn(),
    log: jest.fn(),
    setAttribute: jest.fn(),
  })),
  recordError: jest.fn(),
  log: jest.fn(),
};
