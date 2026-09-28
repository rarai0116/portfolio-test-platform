import type { FirestoreQuerySpec } from '@shared/types/contracts';
import { getCollectionDefinition } from './collectionDefinitions';

export function assertSupportedLocalQuery(spec: FirestoreQuerySpec): void {
  const def = getCollectionDefinition(spec.collectionPath);

  if (!def) {
    throw new Error(`unsupported collectionPath: ${spec.collectionPath}`);
  }
  if (spec.group) {
    throw new Error(
      'collectionGroup query is not supported in local cache step1',
    );
  }
  if ((spec.where?.length ?? 0) > 0) {
    throw new Error('where query is not supported in local cache step1');
  }
  if ((spec.orderBy?.length ?? 0) > 0) {
    throw new Error('orderBy query is not supported in local cache step1');
  }
}
