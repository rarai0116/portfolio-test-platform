import {normalizeAssetDownloadUrl} from '../../components/functionals/normalizeAssetDownloadUrl';

const settings = {
  APP_ENV: 'local',
  USE_FIREBASE_EMULATOR: true,
  FIREBASE_EMULATOR_HOST: '127.0.0.1',
};
const path =
  '/v0/b/dev-app.appspot.com/o/assets%2FfirstGrade%2Fbzip%2F_.zip?alt=media&token=test%2Btoken';
const uri = `http://10.0.2.2:9699${path}`;

describe('ADB経由のアセットURL補正', () => {
  it('Storageのホストのみを変更してパスとトークンをそのまま保持する', () => {
    expect(normalizeAssetDownloadUrl(uri, settings)).toBe(
      `http://127.0.0.1:9699${path}`,
    );
  });

  it('個別画像にも適用でき、補正を繰り返してもURLが変わらない', () => {
    const image =
      'http://10.0.2.2:9699/v0/b/dev-app.appspot.com/o/assets%2Fimage.png?alt=media&token=test';
    const normalized = normalizeAssetDownloadUrl(image, settings);
    expect(normalized).toBe(image.replace('10.0.2.2', '127.0.0.1'));
    expect(normalizeAssetDownloadUrl(normalized, settings)).toBe(normalized);
  });

  it.each([
    {...settings, APP_ENV: 'production'},
    {...settings, APP_ENV: 'staging'},
    {...settings, APP_ENV: 'development'},
    {...settings, USE_FIREBASE_EMULATOR: false},
    {...settings, FIREBASE_EMULATOR_HOST: '10.0.2.2'},
    {...settings, FIREBASE_EMULATOR_HOST: 'localhost'},
    {},
  ])('ADB経由のローカル環境以外では変更しない: %j', (config) => {
    expect(normalizeAssetDownloadUrl(uri, config)).toBe(uri);
  });

  it.each([
    `https://firebasestorage.googleapis.com${path}`,
    `https://10.0.2.2:9699${path}`,
    `http://10.0.2.2:8581${path}`,
    `http://10.0.2.2:96990${path}`,
    `http://10.0.2.2:9699/other${path}`,
    `http://10.0.2.2.example.com:9699${path}`,
  ])('Storage Emulator以外のURLは変更しない: %s', (other) => {
    expect(normalizeAssetDownloadUrl(other, settings)).toBe(other);
  });
});
