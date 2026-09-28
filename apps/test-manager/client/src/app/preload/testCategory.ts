import type { GradeId } from '@shared/types/contracts';
import type {
  TestCategoryGetKeyResult,
  TestCategoryOtherTagKeysPayload,
  TestCategoryOtherTagKeysResult,
  TestCategoryOtherTagRequestPayload,
  TestCategoryOtherTagRequestResult,
  TestCategoryRequestPayload,
  TestCategoryRequestResult,
} from '@shared/types/testCategory';
import {
  type TestCategoryChangedCategory,
  type TestCategoryChangedOtherTag,
  TestCategoryChannels,
} from '@shared/types/testCategory';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('testCategory', {
  request: (payload: TestCategoryRequestPayload) =>
    ipcRenderer.invoke(
      TestCategoryChannels.request,
      payload,
    ) as Promise<TestCategoryRequestResult>,

  getKey: (grade: GradeId, subject?: string, bigCategoryTag?: string) =>
    ipcRenderer.invoke(TestCategoryChannels.getKey, {
      grade,
      subject,
      bigCategoryTag,
    }) as Promise<TestCategoryGetKeyResult>,

  requestOtherTagNos: (payload: TestCategoryOtherTagRequestPayload) =>
    ipcRenderer.invoke(
      TestCategoryChannels.requestOtherTagNos,
      payload,
    ) as Promise<TestCategoryOtherTagRequestResult>,

  getOtherTagKeys: (payload: TestCategoryOtherTagKeysPayload) =>
    ipcRenderer.invoke(
      TestCategoryChannels.getOtherTagKeys,
      payload,
    ) as Promise<TestCategoryOtherTagKeysResult>,

  onUpdated: (handler: (changes: TestCategoryChangedCategory[]) => void) => {
    const listener = (
      _evt: unknown,
      changes: TestCategoryChangedCategory[],
    ) => {
      handler(changes);
    };
    ipcRenderer.on(TestCategoryChannels.updated, listener);
    return () => ipcRenderer.off(TestCategoryChannels.updated, listener);
  },

  onOtherTagsUpdated: (
    handler: (changes: TestCategoryChangedOtherTag[]) => void,
  ) => {
    const listener = (
      _evt: unknown,
      changes: TestCategoryChangedOtherTag[],
    ) => {
      handler(changes);
    };
    ipcRenderer.on(TestCategoryChannels.otherTagsUpdated, listener);
    return () =>
      ipcRenderer.off(TestCategoryChannels.otherTagsUpdated, listener);
  },
});
