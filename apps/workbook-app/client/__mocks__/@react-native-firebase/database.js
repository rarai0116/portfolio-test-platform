// Manual Jest mock for @react-native-firebase/database
module.exports = {
  __esModule: true,
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  onValue: jest.fn(() => jest.fn()), // returns unsubscribe
  onChildChanged: jest.fn(() => jest.fn()),
  off: jest.fn(),
  get: jest.fn(async () => ({val: () => null, exists: () => false})),
  goOnline: jest.fn(),
  goOffline: jest.fn(),
  setPersistenceEnabled: jest.fn(),
  setPersistenceCacheSizeBytes: jest.fn(),
};
