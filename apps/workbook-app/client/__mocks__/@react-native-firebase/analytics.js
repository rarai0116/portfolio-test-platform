// Manual Jest mock for @react-native-firebase/analytics
module.exports = {
  __esModule: true,
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(async () => undefined),
};
