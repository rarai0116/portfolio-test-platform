import { ensureAuthClaims, firestore } from '@main/services/firebase';
import {
  type DocumentData,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { FirestoreClient } from './clients';
import {
  buildIndexDocId,
  getCollectionDefinition,
} from './collectionDefinitions';

export type FirestoreMutationPayload = {
  kind: 'create' | 'set' | 'update' | 'delete';
  path: string;
  data?: unknown;
};

export interface FirestoreMutationExecutor {
  execute(payload: FirestoreMutationPayload): Promise<void>;
}

const hashDocId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const toShardSuffix = (docId: string, shardCount: number): string => {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
};

const parseDocData = (value: unknown): DocumentData => {
  if (value === undefined) {
    return {};
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('mutation data must be a plain object');
    }
    return parsed as DocumentData;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('mutation data must be a plain object');
  }

  return value as DocumentData;
};

const parseCollectionDocPath = (
  path: string,
): { collectionPath: string; docId: string } | null => {
  const parts = path.split('/');

  if (parts.length < 2 || parts.length % 2 !== 0) {
    return null;
  }

  const docId = parts.at(-1);
  const collectionPath = parts.slice(0, -1).join('/');

  if (!collectionPath || !docId) {
    return null;
  }

  return { collectionPath, docId };
};

export class FirestoreIndexMutationExecutor
  implements FirestoreMutationExecutor
{
  constructor(private readonly client: FirestoreClient) {}

  async execute(payload: FirestoreMutationPayload): Promise<void> {
    const target = parseCollectionDocPath(payload.path);
    const definition = target
      ? getCollectionDefinition(target.collectionPath)
      : null;

    // step1 対象外は既存経路にフォールバック
    if (!target || !definition) {
      await this.client.applyWrite(payload);
      return;
    }

    await ensureAuthClaims({
      requireWrite: true,
      timeoutMs: 15_000,
    });

    const docRef = doc(firestore, payload.path);
    const shard = toShardSuffix(target.docId, definition.shardCount);
    const indexDocId = buildIndexDocId(definition, shard);
    const indexRef = doc(firestore, definition.indexCollectionPath, indexDocId);
    const input = parseDocData(payload.data);

    let alreadyExists = false;

    await runTransaction(firestore, async (tx) => {
      const docSnap = await tx.get(docRef);
      const indexSnap = await tx.get(indexRef);

      const currentIndex = indexSnap.exists()
        ? (indexSnap.data() as { items?: Record<string, unknown> })
        : {};
      const currentItems =
        currentIndex.items &&
        typeof currentIndex.items === 'object' &&
        !Array.isArray(currentIndex.items)
          ? { ...currentIndex.items }
          : {};

      if (payload.kind === 'create') {
        if (docSnap.exists()) {
          alreadyExists = true;
          return;
        }

        tx.set(docRef, {
          ...input,
          deleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (payload.kind === 'set') {
        const base = {
          ...input,
          deleted: false,
          updatedAt: serverTimestamp(),
        };

        if (docSnap.exists()) {
          tx.set(docRef, base, { merge: true });
        } else {
          tx.set(
            docRef,
            {
              ...base,
              createdAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } else if (payload.kind === 'update') {
        if (!docSnap.exists()) {
          throw new Error(`Document does not exist: ${payload.path}`);
        }

        tx.update(docRef, {
          ...input,
          deleted: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        if (!docSnap.exists()) {
          return;
        }

        tx.set(
          docRef,
          {
            ...(docSnap.data() as DocumentData),
            deleted: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      currentItems[target.docId] = {
        updatedAt: serverTimestamp(),
        deleted: payload.kind === 'delete',
      };

      tx.set(
        indexRef,
        {
          collectionPath: definition.collectionPath,
          shard,
          updatedAt: serverTimestamp(),
          items: currentItems,
        },
        { merge: true },
      );
    });

    if (payload.kind === 'create' && alreadyExists) {
      throw new Error(`Document already exists: ${payload.path}`);
    }
  }
}
