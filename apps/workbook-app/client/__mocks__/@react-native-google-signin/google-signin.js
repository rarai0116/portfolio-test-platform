// Manual Jest mock for @react-native-google-signin/google-signin
const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(async () => true),
  hasPreviousSignIn: jest.fn(() => false),
  signIn: jest.fn(async () => ({type: 'success', data: {idToken: 'test-id-token'}})),
  signInSilently: jest.fn(async () => ({type: 'success', data: {idToken: 'test-id-token'}})),
  signOut: jest.fn(async () => undefined),
  getCurrentUser: jest.fn(() => null),
};

module.exports = {
  __esModule: true,
  GoogleSignin,
  GoogleSigninButton: () => null,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};
