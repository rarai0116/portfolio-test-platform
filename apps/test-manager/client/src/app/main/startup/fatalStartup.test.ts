import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exit: vi.fn(),
  showErrorBox: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { exit: mocks.exit },
  dialog: { showErrorBox: mocks.showErrorBox },
}));

const loadModule = async () => {
  vi.resetModules();
  return import('./fatalStartup');
};

beforeEach(() => {
  mocks.exit.mockReset();
  mocks.showErrorBox.mockReset();
  // このモジュールは意図的に console.error でログを残すため、共通の
  // console.error 検知ポリシーを上書きして無効化する。
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('handleFatalStartupError', () => {
  it('画像アセット系phaseでは画像アセット向けの文言でダイアログを出して exit 1 する', async () => {
    const { handleFatalStartupError, StartupError } = await loadModule();

    handleFatalStartupError(
      new StartupError('asset-db-open', 'db open failed'),
    );

    expect(mocks.showErrorBox).toHaveBeenCalledTimes(1);
    const [title, body] = mocks.showErrorBox.mock.calls[0];
    expect(title).toContain('画像アセット');
    expect(body).toContain('画像アセット');
    // ローカルパスや stack を利用者向け文言へ載せない
    expect(body).not.toContain('db open failed');
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('ready前のscheme登録失敗も画像アセット向け文言として扱う', async () => {
    const { handleFatalStartupError, StartupError } = await loadModule();

    handleFatalStartupError(
      new StartupError('scheme-register', 'register failed'),
    );

    expect(mocks.showErrorBox.mock.calls[0][0]).toContain('画像アセット');
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('画像アセット以外の起動失敗は汎用文言になる', async () => {
    const { handleFatalStartupError } = await loadModule();

    handleFatalStartupError(new Error('unexpected'));

    expect(mocks.showErrorBox.mock.calls[0][0]).not.toContain('画像アセット');
    expect(mocks.showErrorBox.mock.calls[0][1]).toContain('起動処理');
    expect(mocks.exit).toHaveBeenCalledWith(1);
  });

  it('複数回呼ばれてもダイアログと終了を重複させない', async () => {
    const { handleFatalStartupError } = await loadModule();

    handleFatalStartupError(new Error('first'));
    handleFatalStartupError(new Error('second'));

    expect(mocks.showErrorBox).toHaveBeenCalledTimes(1);
    expect(mocks.exit).toHaveBeenCalledTimes(1);
  });

  it('ダイアログ表示が失敗しても exit 1 する', async () => {
    const { handleFatalStartupError } = await loadModule();
    mocks.showErrorBox.mockImplementation(() => {
      throw new Error('dialog unavailable');
    });

    handleFatalStartupError(new Error('boom'));

    expect(mocks.exit).toHaveBeenCalledWith(1);
  });
});
