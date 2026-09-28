// Manual Jest mock for @react-native-firebase/functions
module.exports = {
  __esModule: true,
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(async () => ({data: {}}))),
};
