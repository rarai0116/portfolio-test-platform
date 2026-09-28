import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import type { PastExamDuplicateEntry } from './pastExamDuplicate';
import {
  buildPastExamDuplicateIndex,
  getPastExamDuplicateIds,
  getPastExamDuplicateKey,
  upsertPastExamDuplicateIndexEntry,
} from './pastExamDuplicate';

function makeEntry(
  id: string,
  patch?: Partial<
    Pick<
      TestData,
      'grade' | 'nengo' | 'year' | 'subject' | 'testNo' | 'isOriginal'
    >
  >,
): PastExamDuplicateEntry {
  return {
    id,
    data: {
      grade: 1,
      nengo: '令和',
      year: '5',
      subject: '学科Ⅰ',
      testNo: '10',
      isOriginal: false,
      ...patch,
    },
  };
}

describe('本試験過去問題の重複判定インデックス', () => {
  it('本試験同士でキー一致したIDだけを重複相手として返す', () => {
    const index = buildPastExamDuplicateIndex([
      makeEntry('1'),
      makeEntry('2'),
      makeEntry('3', { testNo: '11' }),
      makeEntry('4', { isOriginal: true }),
    ]);

    expect(getPastExamDuplicateIds(index, makeEntry('1'))).toEqual(['2']);
    expect(getPastExamDuplicateIds(index, makeEntry('2'))).toEqual(['1']);
    expect(
      getPastExamDuplicateIds(index, makeEntry('3', { testNo: '11' })),
    ).toEqual([]);
    expect(
      getPastExamDuplicateIds(index, makeEntry('4', { isOriginal: true })),
    ).toEqual([]);
  });

  it('必須項目が欠けている場合は重複キーを作らない', () => {
    expect(
      getPastExamDuplicateKey(makeEntry('1', { year: '' }).data),
    ).toBeNull();
    expect(
      getPastExamDuplicateKey(makeEntry('1', { testNo: '0' }).data),
    ).toBeNull();
    expect(
      getPastExamDuplicateKey(makeEntry('1', { isOriginal: true }).data),
    ).toBeNull();
  });

  it('upsertで同一IDのキー変更を反映できる', () => {
    const base = buildPastExamDuplicateIndex([makeEntry('1'), makeEntry('2')]);

    const updated = upsertPastExamDuplicateIndexEntry(
      base,
      makeEntry('1', { testNo: '20' }),
    );

    expect(
      getPastExamDuplicateIds(updated, makeEntry('1', { testNo: '20' })),
    ).toEqual([]);
    expect(getPastExamDuplicateIds(updated, makeEntry('2'))).toEqual([]);
  });
});
