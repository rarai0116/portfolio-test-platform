import { mockTestDocs } from '@renderer/mocks/mockTestDataList';
import type { TestData } from '@shared/types/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EditDataEntry, TestDataEntry } from './useTestDataStore';
import useTestDataStore from './useTestDataStore';

const STORE_KEY = 'tde:edit-data:v1';

describe('useTestDataStore', () => {
  beforeEach(() => {
    localStorage.removeItem(STORE_KEY);
    useTestDataStore.setState({
      testDataMap: {},
      editMap: {},
      isQuillPrepared: {},
    });
  });

  it('mergeFromTestDataは対象IDの編集内容をfreshデータで上書きし、他IDは保持する', () => {
    const targetId = 'target-id';
    const keepId = 'keep-id';
    const baseData = structuredClone(mockTestDocs[0].data) as TestData;
    const keepData = structuredClone(mockTestDocs[1].data) as TestData;

    const testDataMap: Record<string, TestDataEntry> = {
      [targetId]: {
        id: targetId,
        status: 'ready',
        raw: baseData,
      },
      [keepId]: {
        id: keepId,
        status: 'ready',
        raw: keepData,
      },
    };

    const editMap: Record<string, EditDataEntry> = {
      [targetId]: {
        id: targetId,
        data: {
          ...baseData,
          subject: '学科Ⅳ',
          themeTag: '変更後テーマ',
          publicationNo: '999',
        },
        updatedAtMs: 1,
      },
      [keepId]: {
        id: keepId,
        data: {
          ...keepData,
          themeTag: '保持するテーマ',
        },
        updatedAtMs: 2,
      },
    };

    useTestDataStore.setState({
      testDataMap,
      editMap,
    });

    useTestDataStore.getState().mergeFromTestData({
      idList: [targetId],
      testDataMap,
    });

    const nextEditMap = useTestDataStore.getState().editMap;

    expect(nextEditMap[targetId].data.subject).toBe(baseData.subject);
    expect(nextEditMap[targetId].data.themeTag).toBe(baseData.themeTag);
    expect(nextEditMap[targetId].data.publicationNo).toBe(
      baseData.publicationNo,
    );
    expect(nextEditMap[keepId].data.themeTag).toBe('保持するテーマ');
  });
});
