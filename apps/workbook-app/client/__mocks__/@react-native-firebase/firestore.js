// Manual Jest mock for @react-native-firebase/firestore
class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }

  static fromDate(date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }

  static fromMillis(milliseconds) {
    return new Timestamp(Math.floor(milliseconds / 1000), 0);
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }

  toMillis() {
    return this.seconds * 1000;
  }

  isEqual(other) {
    return Boolean(other) && this.seconds === other.seconds;
  }
}

module.exports = {
  __esModule: true,
  Timestamp,
  FieldValue: {},
  getFirestore: jest.fn(() => ({})),
  // initializeFirestore returns a Promise (firestoreController chains .then/.catch).
  initializeFirestore: jest.fn(async () => ({})),
  serverTimestamp: jest.fn(() => Timestamp.now()),
  arrayUnion: jest.fn((...values) => ({__op: 'arrayUnion', values})),
  deleteField: jest.fn(() => ({__op: 'deleteField'})),
  doc: jest.fn(() => ({id: 'mock-doc'})),
  collection: jest.fn(() => ({id: 'mock-collection'})),
  query: jest.fn((reference) => reference),
  where: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({exists: false, data: () => undefined})),
  getDocFromServer: jest.fn(async () => ({
    exists: () => false,
    data: () => undefined,
  })),
  getDocs: jest.fn(async () => ({
    empty: true,
    docs: [],
    forEach() {},
  })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  onSnapshot: jest.fn(() => jest.fn()), // returns unsubscribe
};
