import {
  type TestCategoryChangedCategory,
  type TestCategoryChangedOtherTag,
  TestCategoryChannels,
  type TestCategoryGetKeyPayload,
  type TestCategoryGetKeyResult,
  type TestCategoryOtherTagKeysPayload,
  type TestCategoryOtherTagKeysResult,
  type TestCategoryOtherTagRequestPayload,
  type TestCategoryOtherTagRequestResult,
  type TestCategoryRequestPayload,
  type TestCategoryRequestResult,
} from '@shared/types/testCategory';
import { ipcMain, webContents } from 'electron';
import type { TestCategoryClient } from './client';

export function registerTestCategoryIpc(service: TestCategoryClient) {
  ipcMain.handle(
    TestCategoryChannels.request,
    async (
      _evt,
      payload: TestCategoryRequestPayload,
    ): Promise<TestCategoryRequestResult> => {
      try {
        if (!payload?.grade) return { ok: false, error: 'grade は必須です' };
        if (payload.smallCategoryTag && !payload.bigCategoryTag) {
          return {
            ok: false,
            error:
              'smallCategoryTag は bigCategoryTag と併せて指定してください',
          };
        }
        const nos = await service.requestNos(payload);
        return { ok: true, nos };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    TestCategoryChannels.getKey,
    async (
      _evt,
      payload: TestCategoryGetKeyPayload,
    ): Promise<TestCategoryGetKeyResult> => {
      try {
        if (!payload?.grade) return { ok: false, error: 'grade は必須です' };
        if (payload.bigCategoryTag && !payload.subject) {
          return {
            ok: false,
            error: 'bigCategoryTag を指定する場合は subject も必須です',
          };
        }
        const keys = await service.getKeys(payload);
        return { ok: true, keys };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    TestCategoryChannels.requestOtherTagNos,
    async (
      _evt,
      payload: TestCategoryOtherTagRequestPayload,
    ): Promise<TestCategoryOtherTagRequestResult> => {
      try {
        if (!payload?.grade) return { ok: false, error: 'grade は必須です' };
        if (!payload?.tag?.trim()) {
          return { ok: false, error: 'tag は必須です' };
        }
        const nos = await service.requestOtherTagNos(payload);
        return { ok: true, nos };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    TestCategoryChannels.getOtherTagKeys,
    async (
      _evt,
      payload: TestCategoryOtherTagKeysPayload,
    ): Promise<TestCategoryOtherTagKeysResult> => {
      try {
        if (!payload?.grade) return { ok: false, error: 'grade は必須です' };
        const keys = await service.getOtherTagKeys(payload);
        return { ok: true, keys };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  // 更新イベントを全rendererへ配送
  service.onUpdated((changes: TestCategoryChangedCategory[]) => {
    for (const wc of webContents.getAllWebContents()) {
      wc.send(TestCategoryChannels.updated, changes);
    }
  });

  service.onOtherTagsUpdated((changes: TestCategoryChangedOtherTag[]) => {
    for (const wc of webContents.getAllWebContents()) {
      wc.send(TestCategoryChannels.otherTagsUpdated, changes);
    }
  });
}
