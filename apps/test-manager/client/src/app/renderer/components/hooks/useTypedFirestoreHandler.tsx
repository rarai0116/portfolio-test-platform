import type {
  AssetData,
  FirestoreQuerySpec,
  TestData,
} from '@shared/types/contracts';
import type { HandlerOptions, HandlerResult } from './useFirestoreHandler';
import { useFirestoreHandler } from './useFirestoreHandler';

export type Grade = 'firstGrade' | 'secondGrade';

export type ValidCollectionPath =
  | 'firstGrade'
  | 'secondGrade'
  | `storageList/${Grade}/images`;

export type ValidCollectionGroupId = 'images';

export type DocByCollectionPath<P extends ValidCollectionPath> =
  P extends `storageList/${Grade}/images` // 画像サブコレクション
    ? AssetData
    : P extends 'firstGrade' | 'secondGrade' //テストデータコレクション
      ? TestData
      : never;

export type DocByGroupId<I extends ValidCollectionGroupId> = I extends 'images'
  ? AssetData
  : never;

export const assetsPath = (grade: Grade) =>
  `storageList/${grade}/images` as const;

type BaseOptions = Omit<HandlerOptions, 'collectionPath' | 'group'>;

export function useTypedFirestoreHandler<P extends ValidCollectionPath>(
  collectionPath: P,
  options?: BaseOptions & { specOverrides?: Partial<FirestoreQuerySpec> },
): HandlerResult<DocByCollectionPath<P>> {
  const { specOverrides, ...rest } = options ?? {};
  return useFirestoreHandler<DocByCollectionPath<P>>({
    collectionPath,
    group: false,
    where: specOverrides?.where,
    orderBy: specOverrides?.orderBy,
    limit: specOverrides?.limit,
    ...rest,
  });
}

export function useCollectionGroupHandler<I extends ValidCollectionGroupId>(
  collectionId: I,
  options?: BaseOptions & { specOverrides?: Partial<FirestoreQuerySpec> },
): HandlerResult<DocByGroupId<I>> {
  const { specOverrides, ...rest } = options ?? {};
  return useFirestoreHandler<DocByGroupId<I>>({
    collectionPath: collectionId, // group=true のときは ID を渡す契約
    group: true,
    where: specOverrides?.where,
    orderBy: specOverrides?.orderBy,
    limit: specOverrides?.limit,
    ...rest,
  });
}
