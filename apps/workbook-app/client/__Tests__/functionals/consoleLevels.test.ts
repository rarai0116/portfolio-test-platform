import {createConsoleController, summarizeConsoleValue} from '../../components/functionals/consoleLevels';

const output = () => ({log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()});

describe('開発コンソールの表示レベル', () => {
  test('errorレベルでも重要イベントとエラーは表示する', () => {
    const sink = output();
    const controller = createConsoleController(sink);
    controller.setLevel('error');
    controller.console.log('ローディングフェーズ変更', 'download');
    controller.console.info('補助情報');
    controller.console.warn('警告');
    controller.console.error('処理失敗');
    expect(sink.log).toHaveBeenCalledWith('ローディングフェーズ変更', 'download');
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).toHaveBeenCalledWith('処理失敗');
  });
  test('実行中にwarnからinfoへ戻せる', () => {
    const sink = output();
    const controller = createConsoleController(sink);
    controller.setLevel('warn');
    controller.console.info('非表示');
    controller.console.warn('警告');
    controller.setLevel('info');
    controller.console.info('再表示');
    expect(controller.getLevel()).toBe('info');
    expect(sink.info).toHaveBeenCalledTimes(1);
    expect(sink.info).toHaveBeenCalledWith('再表示');
    expect(sink.warn).toHaveBeenCalledTimes(1);
  });
  test('非表示のオブジェクトは列挙しない', () => {
    const sink = output();
    const controller = createConsoleController(sink);
    controller.setLevel('error');
    const ownKeys = jest.fn(() => []);
    controller.console.info('非表示', new Proxy({}, {ownKeys}));
    expect(ownKeys).not.toHaveBeenCalled();
  });
  test('循環参照を展開せず、配列・Map・オブジェクトは件数を出す', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(summarizeConsoleValue(circular)).toBe('キー数=1');
    expect(summarizeConsoleValue([1, 2])).toBe('件数=2');
    expect(summarizeConsoleValue(new Map([['a', 1]]))).toBe('件数=1');
  });
  test('例外を消さず、認証トークンを除去する', () => {
    const result = summarizeConsoleValue(new Error('failed ?token=secret eyJabc.def.sig'));
    expect(result).toContain('Error: failed');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('eyJabc');
  });
  test('本番向けの重要イベント抑制でも警告とエラーを維持する', () => {
    const sink = output();
    const controller = createConsoleController(sink, false);
    controller.console.log('重要イベント');
    controller.console.warn('警告');
    controller.console.error('エラー');
    expect(sink.log).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledTimes(1);
    expect(sink.error).toHaveBeenCalledTimes(1);
  });
  test('不正な設定は拒否して現在のレベルを維持する', () => {
    const controller = createConsoleController(output());
    expect(() => controller.setLevel('silent' as never)).toThrow();
    expect(controller.getLevel()).toBe('info');
  });
});
