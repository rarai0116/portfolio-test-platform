import type { GradeId } from '@shared/types/contracts';

export type CollectionCacheDefinition = {
  collectionPath: string;
  grade?: GradeId;
  indexCollectionPath: string;
  indexDocIdPrefix: string;
  shardCount: number;
  supportsLocalQuery: true;
};

export const TESTDATA_COLLECTIONS: CollectionCacheDefinition[] = [
  {
    collectionPath: 'firstGrade',
    grade: 'firstGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'firstGrade',
    shardCount: 16,
    supportsLocalQuery: true,
  },
  {
    collectionPath: 'secondGrade',
    grade: 'secondGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'secondGrade',
    shardCount: 16,
    supportsLocalQuery: true,
  },
  {
    collectionPath: 'storageList/firstGrade/images',
    grade: 'firstGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_firstGrade_images',
    shardCount: 16,
    supportsLocalQuery: true,
  },
  {
    collectionPath: 'storageList/secondGrade/images',
    grade: 'secondGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_secondGrade_images',
    shardCount: 16,
    supportsLocalQuery: true,
  },
];

export const getCollectionDefinition = (collectionPath: string) =>
  TESTDATA_COLLECTIONS.find((item) => item.collectionPath === collectionPath);

export const buildIndexDocId = (
  definition: CollectionCacheDefinition,
  shardSuffix: string,
): string => `${definition.indexDocIdPrefix}_${shardSuffix}`;
