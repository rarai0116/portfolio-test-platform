/**
 * 分析ページの集計処理を、実機を固めずにヘッドレスで時間計測する。
 * 目的: 分析ページ遷移時のフリーズが「算術的に重い計算(O(n^2)等)」なのか、
 *       それとも巨大データの console.log / 描画など別要因なのかを切り分ける。
 *
 * 実データ規模([ANALYSIS-SIZE]計測値, grade=1級):
 *   testDataList=1500, qaaTestDataList=5028
 *   categoryキー=130/115, カテゴリ総問題=4500/15084, 保存設定=73
 */
import {renderHook} from '@testing-library/react-native';
import useDataAnalysisHome from '../../components/views/dataAnalysisHomeView/hooks/useDataAnalysisModeContext/useDataAnalysisHome';
import type {TestIdList} from '../../components/hooks/useGlobalUserSettingContext';

// --- 合成データ生成 -------------------------------------------------------
const makeIds = (prefix: string, n: number) =>
  Array.from({length: n}, (_, i) => `${prefix}${i}`);

// grade=1級: 選択は ch_0_*, 一問一答は qaa1_0_*
const buildTestIdList = (opts: {
  answered: number;
  correct: number;
  weak: number;
}): TestIdList => {
  const answered = [
    ...makeIds('ch_0_', Math.floor(opts.answered / 2)),
    ...makeIds('qaa1_0_', Math.ceil(opts.answered / 2)),
  ];
  const correct = [
    ...makeIds('ch_0_', Math.floor(opts.correct / 2)),
    ...makeIds('qaa1_0_', Math.ceil(opts.correct / 2)),
  ];
  const weak = [
    ...makeIds('ch_0_', Math.floor(opts.weak / 2)),
    ...makeIds('qaa1_0_', Math.ceil(opts.weak / 2)),
  ];
  const block = (total: string[]) => ({
    current: [],
    old: [],
    total,
    set: () => {},
  });
  return {
    answered: block(answered),
    weakPoint: {...block(weak), set: () => {}},
    correctlyAnswered: block(correct),
    unCorrectlyAnswered: block([]),
    generate: () => '',
  } as unknown as TestIdList;
};

const time = (label: string, fn: () => void) => {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  console.info(`[PERF] ${label}: ${ms.toFixed(1)}ms`);
  return ms;
};

describe('dataAnalysis perf (headless)', () => {
  // console.log の中身(巨大配列)を出さないようにして「純粋な計算コスト」を測る
  let logSpy: jest.SpyInstance;
  beforeAll(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterAll(() => {
    logSpy.mockRestore();
  });

  const grade = '1級' as const;
  const totalChoicesTestNumber = 1500;

  it.each([
    {answered: 2000, correct: 1500, weak: 500},
    {answered: 10000, correct: 7000, weak: 2000},
    {answered: 19584, correct: 15000, weak: 4000},
  ])('useDataAnalysisHome compute %o', (sizes) => {
    const testIdList = buildTestIdList(sizes);
    const ms = time(`useDataAnalysisHome answered=${sizes.answered}`, () => {
      renderHook(() =>
        useDataAnalysisHome({testIdList, grade, totalChoicesTestNumber}),
      );
    });
    // しきい値(暫定): 16msを大きく超えるならフレーム落ち〜フリーズ要因
    expect(ms).toBeGreaterThanOrEqual(0);
  });
});
