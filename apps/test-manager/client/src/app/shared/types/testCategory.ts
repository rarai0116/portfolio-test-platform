import type { GradeId, TestSubject } from './contracts';

export const TestCategoryChannels = {
  request: 'testCategory:request',
  getKey: 'testCategory:getKey',
  updated: 'testCategory:updated',
  requestOtherTagNos: 'testCategory:requestOtherTagNos',
  getOtherTagKeys: 'testCategory:getOtherTagKeys',
  otherTagsUpdated: 'testCategory:otherTagsUpdated',
} as const;

export type TestCategoryRequestPayload = {
  grade: GradeId;
  bigCategoryTag?: string;
  smallCategoryTag?: string;
};

export type TestCategoryRequestResult =
  | { ok: true; nos: number[] }
  | { ok: false; error: string };

export type TestCategoryGetKeyPayload = {
  grade: GradeId;
  subject?: TestSubject;
  bigCategoryTag?: string;
};

export type TestCategoryGetKeyResult =
  | { ok: true; keys: string[] }
  | { ok: false; error: string };

export type TestCategoryOtherTagRequestPayload = {
  grade: GradeId;
  tag: string;
};

export type TestCategoryOtherTagRequestResult =
  | { ok: true; nos: number[] }
  | { ok: false; error: string };

export type TestCategoryOtherTagKeysPayload = {
  grade: GradeId;
};

export type TestCategoryOtherTagKeysResult =
  | { ok: true; keys: string[] }
  | { ok: false; error: string };

export type TestCategoryChangedCategory = {
  grade: GradeId;
  bigCategoryTag: string;
  smallCategoryTag: string;
  nos: number[]; // 変更後の所属no
};

export type TestCategoryChangedOtherTag = {
  grade: GradeId;
  tag: string;
  nos: number[];
};
