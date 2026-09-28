import {get, goOffline, ref} from '@react-native-firebase/database';
import {getLocalTestData} from '../../components/functionals/realtimeDatabaseController';

jest.mock('../../components/hooks/useAsyncStorageContext', () => ({StorageContext: {}}));
jest.mock('../../components/functionals/adjusttestData', () => ({
  getBaseDirectory: jest.fn(),
  getLibDirectory: jest.fn(),
}));

describe('Firebase 25 offline database reads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached data when goOffline is synchronous', async () => {
    const snapshot = {val: () => ({question: 'cached'})};
    jest.mocked(goOffline).mockReturnValueOnce(undefined);
    jest.mocked(get).mockResolvedValueOnce(snapshot as Awaited<ReturnType<typeof get>>);

    await expect(getLocalTestData('1')).resolves.toBe(snapshot);
    expect(goOffline).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'test/1');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects when the native offline switch throws', async () => {
    jest.mocked(goOffline).mockImplementationOnce(() => {
      throw new Error('native database unavailable');
    });

    await expect(getLocalTestData('1')).rejects.toThrow('native database unavailable');
    expect(get).not.toHaveBeenCalled();
  });
});
