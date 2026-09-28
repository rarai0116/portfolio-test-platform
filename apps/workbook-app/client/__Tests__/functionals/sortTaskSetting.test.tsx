/**
 * getSelectedDateAllTaskSettingCardPropsList の等価性 + 速度の回帰テスト。
 * 旧実装は期間の全日付文字列を生成してSet.hasしていた(重い)。
 * 新実装はJSTの日インデックス境界比較(O(1))。挙動が変わらないこと/十分高速を保証する。
 */
import {getSelectedDateAllTaskSettingCardPropsList} from '../../components/functionals/sortTaskSetting';

const DAY = 86_400;
// JST(UTC+9)のカレンダー日 D のちょうど 1:00(JST) を指す Timestamp 風スタブ(.secondsのみ使用)
const tsForJstDay = (d: number) => ({seconds: d * DAY - 9 * 3600 + 3600}) as any;

const taskWithRange = (id: string, startDay: number, endDay: number) =>
  ({
    id,
    taskSetting: {
      taskDate: [{startAt: tsForJstDay(startDay), endAt: tsForJstDay(endDay)}],
    },
  }) as any;

const taskWithDeadline = (id: string, day: number) =>
  ({
    id,
    taskSetting: {deadlineDate: tsForJstDay(day)},
  }) as any;

const ids = (list: any[]) => list.map((t) => t.id);

describe('getSelectedDateAllTaskSettingCardPropsList', () => {
  it('taskDate範囲は端点を含み、範囲外は除外する', () => {
    const task = taskWithRange('A', 10, 12);
    expect(
      ids(getSelectedDateAllTaskSettingCardPropsList([task], tsForJstDay(9))),
    ).toEqual([]);
    for (const d of [10, 11, 12]) {
      expect(
        ids(getSelectedDateAllTaskSettingCardPropsList([task], tsForJstDay(d))),
      ).toEqual(['A']);
    }
    expect(
      ids(getSelectedDateAllTaskSettingCardPropsList([task], tsForJstDay(13))),
    ).toEqual([]);
  });

  it('deadlineは当日のみ一致する', () => {
    const task = taskWithDeadline('D', 20);
    expect(
      ids(getSelectedDateAllTaskSettingCardPropsList([task], tsForJstDay(20))),
    ).toEqual(['D']);
    expect(
      ids(getSelectedDateAllTaskSettingCardPropsList([task], tsForJstDay(19))),
    ).toEqual([]);
  });

  it('taskSettingが無い/dateが無いものは除外', () => {
    const none = {id: 'N'} as any;
    expect(
      ids(getSelectedDateAllTaskSettingCardPropsList([none], tsForJstDay(5))),
    ).toEqual([]);
    expect(getSelectedDateAllTaskSettingCardPropsList([none], null as any)).toEqual(
      [],
    );
  });

  it('大量・広範囲タスクでも高速(<50ms)', () => {
    // 2000件 各365日レンジ(旧実装なら全日付生成で激重)
    const tasks = Array.from({length: 2000}, (_, i) =>
      taskWithRange(`T${i}`, 0, 364),
    );
    const t0 = performance.now();
    const result = getSelectedDateAllTaskSettingCardPropsList(
      tasks,
      tsForJstDay(100),
    );
    const ms = performance.now() - t0;
    console.info(`[PERF] selectedDateTaskList 2000x365d: ${ms.toFixed(1)}ms`);
    expect(result.length).toBe(2000);
    expect(ms).toBeLessThan(50);
  });
});
