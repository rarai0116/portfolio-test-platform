// Manual Jest mock for @react-native-firebase/auth
const authInstance = {currentUser: null};

module.exports = {
  __esModule: true,
  default: jest.fn(() => authInstance),
  getAuth: jest.fn(() => authInstance),
  signInWithCredential: jest.fn(async () => ({user: {uid: 'test-uid'}})),
  onAuthStateChanged: jest.fn((_auth, _callback) => jest.fn()), // returns unsubscribe
  signOut: jest.fn(async () => undefined),
  getIdToken: jest.fn(async () => 'test-id-token'),
  getIdTokenResult: jest.fn(async () => ({
    token: 'test-id-token',
    claims: {},
    authTime: '',
    issuedAtTime: '',
    expirationTime: '',
    signInProvider: null,
  })),
  GoogleAuthProvider: {
    credential: jest.fn(() => ({providerId: 'google.com'})),
    PROVIDER_ID: 'google.com',
  },
};
