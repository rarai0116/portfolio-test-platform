import type { CachedDoc } from '@shared/types/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ensureAuthClaims を no-op にモック（他の export は実物を使用）
vi.mock('@main/services/firebase', async () => {
  const actual = await vi.importActual<
    typeof import('@main/services/firebase')
  >('@main/services/firebase');
  return {
    ...actual,
    ensureAuthClaims: vi.fn().mockResolvedValue(undefined),
  };
});

import { auth, firestore, functions } from '@main/services/firebase';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { FirebaseFirestoreClient } from './clients';

describe('FirebaseFirestoreClient (emulator)', () => {
  const client = new FirebaseFirestoreClient(firestore);
  const basePath = 'storageList/firstGrade/images';

  // 事前に Auth Emulator へログインし、Functions Emulator でクレーム付与
  beforeAll(async () => {
    // 念のため（.env で既に true ならそのまま）
    process.env.USE_FIREBASE_EMULATOR =
      process.env.USE_FIREBASE_EMULATOR ?? 'true';

    const email = 't-ci@demoschool.ac.jp'; // t- プレフィックスで setCustomClaims の許可条件を満たす
    const password = 'password';

    // 既存ならサインイン、なければ作成してサインイン
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const code = e instanceof FirebaseError ? e.code : undefined;
      console.error('signInWithEmailAndPassword error:', e);
      console.error('code:', code);
      if (
        code?.includes('auth/invalid-credential') ||
        code?.includes('auth/user-not-found')
      ) {
        console.error('Creating user for test:', email);
        await createUserWithEmailAndPassword(auth, email, password).catch(
          (createError) => {
            console.error('createUserWithEmailAndPassword error:', createError);
            throw createError;
          },
        );
        console.error('User created:', email, auth);
        // 念のため、サインイン状態を保証
        if (!auth.currentUser) {
          await signInWithEmailAndPassword(auth, email, password)
            .then(() => {
              console.error('Signed in after user creation:', email);
            })
            .catch((signInError) => {
              console.error(
                'signInWithEmailAndPassword after creation error:',
                signInError,
              );
              throw signInError;
            });
        }
      } else {
        throw e;
      }
    }

    // クレーム付与（Functions v2 onCall）
    const callSetClaims = httpsCallable(functions, 'setCustomClaims');
    await callSetClaims();

    // 反映待ち（ID トークン強制リフレッシュで atpAllowRead/Write を確認）
    const start = Date.now();
    const timeoutMs = 10000;

    while (true) {
      const r = await auth.currentUser?.getIdTokenResult(true);
      const claims = r?.claims ?? {};
      if (claims.atpAllowRead || claims.atpAllowWrite) break;
      if (Date.now() - start > timeoutMs) {
        throw new Error('custom claims were not applied within timeout');
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }, 20000);

  it('getOnce returns [] on empty collection', async () => {
    const docs = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      limit: 10,
    });
    expect(docs).toEqual([]);
  }, 20000);

  it('applyWrite set -> getOnce -> update -> delete', async () => {
    const docId = 'e2e-1';
    const docPath = `${basePath}/${docId}`;

    // create はルール上、grade と key が必須
    await client.applyWrite({
      kind: 'set',
      path: docPath,
      data: { key: docId, grade: 'firstGrade', name: 'n1', status: 'active' },
    });

    const afterSet = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      where: [['name', '==', 'n1']],
      limit: 10,
    });
    expect(afterSet.find((d) => d.path === docPath)?.data).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      name: 'n1',
      status: 'active',
    });

    // update も grade / key の不変性を満たす必要あり
    await client.applyWrite({
      kind: 'update',
      path: docPath,
      data: { key: docId, grade: 'firstGrade', status: 'archived' },
    });

    const afterUpdate = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      where: [['status', '==', 'archived']],
      limit: 10,
    });
    expect(afterUpdate.find((d) => d.path === docPath)?.data).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      status: 'archived',
    });

    await client.applyWrite({ kind: 'delete', path: docPath });

    const afterDelete = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      where: [['name', '==', 'n1']],
      limit: 10,
    });
    expect(afterDelete.find((d) => d.path === docPath)).toBeUndefined();
  }, 30000);

  it('delete 後の getDoc は null を返す', async () => {
    const docId = 'e2e-delete-getdoc-1';
    const docPath = `${basePath}/${docId}`;

    await client.applyWrite({
      kind: 'set',
      path: docPath,
      data: {
        key: docId,
        grade: 'firstGrade',
        name: 'delete-target',
        status: 'active',
      },
    });

    const beforeDelete = await client.getDoc(docPath);
    expect(beforeDelete?.data).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      name: 'delete-target',
      status: 'active',
    });

    await client.applyWrite({
      kind: 'delete',
      path: docPath,
    });

    const afterDelete = await client.getDoc(docPath);
    expect(afterDelete).toBeNull();
  }, 30000);

  it('listenQuery は logical delete を removed として通知する', async () => {
    const docId = 'e2e-listen-delete-1';
    const docPath = `${basePath}/${docId}`;

    await client.applyWrite({
      kind: 'set',
      path: docPath,
      data: {
        key: docId,
        grade: 'firstGrade',
        name: 'listen-delete-target',
        status: 'active',
      },
    });

    const removedEvent = new Promise<{
      type: 'added' | 'modified' | 'removed';
      doc: CachedDoc;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        stop();
        reject(new Error('removed イベントを受信できませんでした'));
      }, 10000);

      const stop = client.listenQuery(
        {
          collectionPath: basePath,
          group: false,
          where: [['key', '==', docId]],
          limit: 10,
        },
        (events) => {
          const removed = events.find(
            (event) => event.type === 'removed' && event.doc.path === docPath,
          );

          if (!removed) {
            return;
          }

          clearTimeout(timeout);
          stop();
          resolve(removed);
        },
      );
    });

    await client.applyWrite({
      kind: 'delete',
      path: docPath,
    });

    const event = await removedEvent;
    expect(event.type).toBe('removed');
    expect(event.doc.path).toBe(docPath);
    expect(event.doc.data).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      deleted: true,
    });
  }, 30000);
  it('getOnce paginates beyond 1000 (creates 1003 docs)', async () => {
    const toCreate = 1003;
    for (let i = 0; i < toCreate; i++) {
      const id = `p-${i}`;
      await client.applyWrite({
        kind: 'set',
        path: `${basePath}/${id}`,
        data: { key: id, grade: 'firstGrade', i },
      });
    }

    const all = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      // limit 未指定 => 全件（内部は1000件ページング）
    });

    expect(all.length).toBeGreaterThanOrEqual(1003);
  }, 120000);

  it('create は未存在ドキュメントのみ作成し、既存ドキュメントには失敗する', async () => {
    const docId = 'create-only-1';
    const docPath = `${basePath}/${docId}`;

    await client.applyWrite({
      kind: 'create',
      path: docPath,
      data: {
        key: docId,
        grade: 'firstGrade',
        name: 'created-by-create',
        status: 'draft',
      },
    });

    const afterCreate = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      where: [['name', '==', 'created-by-create']],
      limit: 10,
    });

    expect(afterCreate.find((d) => d.path === docPath)?.data).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      name: 'created-by-create',
      status: 'draft',
    });

    await expect(
      client.applyWrite({
        kind: 'create',
        path: docPath,
        data: {
          key: docId,
          grade: 'firstGrade',
          name: 'should-not-overwrite',
          status: 'archived',
        },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Document already exists/),
    });

    const afterSecondCreate = await client.getOnce({
      collectionPath: `${basePath}`,
      group: false,
      where: [['key', '==', docId]],
      limit: 10,
    });

    expect(
      afterSecondCreate.find((d) => d.path === docPath)?.data,
    ).toMatchObject({
      key: docId,
      grade: 'firstGrade',
      name: 'created-by-create',
      status: 'draft',
    });

    await client.applyWrite({ kind: 'delete', path: docPath });
  }, 30000);
});
