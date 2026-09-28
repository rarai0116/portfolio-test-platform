import crypto from 'node:crypto';
import type { FirestoreQuerySpec, QueryKey } from '@shared/types/contracts';


const stableStringify = (spec: FirestoreQuerySpec): string => {
  type WhereTuple = [string, string, unknown];
  type OrderByInput = [string, 'asc' | 'desc' | undefined];
  type OrderByTuple = [string, 'asc' | 'desc'];

  const where = ((spec.where ?? []) as WhereTuple[])
    .map(([f, op, v]) => [f, op, v] as WhereTuple)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const orderBy = ((spec.orderBy ?? []) as OrderByInput[])
    .map(([f, dir]) => [f, (dir ?? 'asc') as 'asc' | 'desc'] as OrderByTuple)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const obj = {
    collectionPath: spec.collectionPath,
    where,
    orderBy,
    limit: spec.limit ?? null,
  };
  return JSON.stringify(obj);
};

// QueryKey をハッシュで生成
export const makeQueryKey = (spec: FirestoreQuerySpec): QueryKey => {
  const s = stableStringify(spec);
  return crypto.createHash('sha1').update(s).digest('hex');
};
