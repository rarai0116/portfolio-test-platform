// Manual Jest mock for @react-native-firebase/app
// firebase.ts / useAuthContext.tsx call getApp() at module load and use app.auth().
const authInstance = {currentUser: null};
const appInstance = {
  name: '[DEFAULT]',
  options: {},
  auth: () => authInstance,
};

module.exports = {
  __esModule: true,
  default: appInstance,
  getApp: jest.fn(() => appInstance),
  getApps: jest.fn(() => [appInstance]),
  initializeApp: jest.fn(() => appInstance),
  firebase: {
    app: () => appInstance,
    apps: [appInstance],
  },
};
