'use strict';
/*
 * Firebase Emulator を相手にした I/O。
 *
 * TestManager と WorkbookApp は別プロジェクト・別 emulator インスタンスで、
 * 変換は前者を読み後者へ書く。両方の host を受け取り、片方でも欠けていれば起動を拒否する。
 * firebase-admin と同じく、host 未設定のまま動くと本番へ向かう事故が起きうるため。
 *
 * 実プロジェクト名は持たない。projectId / bucket はすべて引数で受ける。
 */

const SOURCE_IMAGE_PREFIX = 'original';

function requireHost(value, label) {
  if (!value) throw new Error(`${label} が未設定です（emulator の host を環境変数で渡してください）`);
  return value;
}

function origin(host) {
  return /^https?:\/\//i.test(host) ? host : `http://${host}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: 'Bearer owner', ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${new URL(url).pathname} -> HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  return response;
}

/**
 * Emulator Hub へ export を依頼する。
 *
 * 変換そのものは起動中の emulator へ書き込むだけなので、これを呼ばないと
 * ディスク上の _data は作られない。hub は外部オリジンからの呼び出しを拒否するため、
 * Origin ヘッダを付けない（fetch は既定で付けない）。
 */
async function requestExport(hubHost, exportPath) {
  const url = `${origin(hubHost)}/_admin/export`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: exportPath, initiatedBy: 'workbook-convert' }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`export の依頼に失敗しました: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
}

/**
 * @param source  TestManager 側 { firestoreHost, storageHost, projectId }
 * @param target  WorkbookApp 側 { databaseHost, storageHost, projectId, bucket }
 */
function createEmulatorIo({ source, target }) {
  const firestoreHost = requireHost(source.firestoreHost, 'TestManager の Firestore host');
  const sourceStorage = requireHost(source.storageHost, 'TestManager の Storage host');
  const databaseHost = requireHost(target.databaseHost, 'WorkbookApp の Database host');
  const targetStorage = requireHost(target.storageHost, 'WorkbookApp の Storage host');
  // WorkbookApp 側の Firestore / Auth は、起動に必要な状態の seed に使う。
  const targetFirestore = requireHost(target.firestoreHost, 'WorkbookApp の Firestore host');
  const targetAuth = requireHost(target.authHost, 'WorkbookApp の Auth host');
  if (!source.projectId) throw new Error('source.projectId が必要です');
  if (!target.projectId) throw new Error('target.projectId が必要です');

  const sourceBucket = source.bucket || `${source.projectId}.appspot.com`;
  const targetBucket = target.bucket || `${target.projectId}.appspot.com`;
  // RTDB の namespace は <projectId>-default-rtdb。projectId だけを渡すと別 namespace が
  // 作られ、ルールの効かない空データを読み書きしてしまう。
  const namespace = `${target.projectId}-default-rtdb`;

  return {
    sourceBucket,
    targetBucket,
    namespace,

    async listDocs(grade) {
      const db = `projects/${source.projectId}/databases/(default)`;
      const out = [];
      let pageToken = '';
      do {
        const query = new URLSearchParams({ pageSize: '300' });
        if (pageToken) query.set('pageToken', pageToken);
        const url = `${origin(firestoreHost)}/v1/${db}/documents/${encodeURIComponent(grade)}?${query}`;
        const json = await (await request(url)).json();
        for (const doc of json.documents || []) {
          out.push({ id: doc.name.split('/').pop(), fields: doc.fields || {} });
        }
        pageToken = json.nextPageToken || '';
      } while (pageToken);
      // doc id は文字列だが実体は番号。数値順に並べて 0 始まり配列の並びを安定させる。
      return out.sort((a, b) => Number(a.id) - Number(b.id));
    },

    async readImage(grade, key) {
      const objectPath = `${SOURCE_IMAGE_PREFIX}/${grade}/${key}.png`;
      const url = `${origin(sourceStorage)}/v0/b/${sourceBucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
      try {
        const response = await request(url);
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        if (/HTTP 404/.test(error.message)) return null;
        throw error;
      }
    },

    async writeStorage(objectPath, buffer, contentType) {
      const query = new URLSearchParams({ name: objectPath, uploadType: 'media' });
      const url = `${origin(targetStorage)}/upload/storage/v1/b/${targetBucket}/o?${query}`;
      await request(url, { method: 'POST', headers: { 'content-type': contentType }, body: buffer });
    },

    async writeDatabase(nodePath, value) {
      const url = `${origin(databaseHost)}/${nodePath}.json?ns=${namespace}`;
      await request(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(value),
      });
    },

    async writeFirestore(collection, documentId, fields) {
      const db = `projects/${target.projectId}/databases/(default)`;
      // documents?documentId=<id> は作成のみ。既に在る場合に備えて PATCH で上書きする。
      const url = `${origin(targetFirestore)}/v1/${db}/documents/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`;
      await request(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
    },

    async createAuthUser(email, password) {
      // Auth Emulator の signUp。既に居る場合は EMAIL_EXISTS になるので許容する。
      const url = `${origin(targetAuth)}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
      try {
        await request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        });
      } catch (error) {
        if (!/EMAIL_EXISTS/.test(error.message)) throw error;
      }
    },

    async readDatabase(nodePath, { shallow = false } = {}) {
      const query = new URLSearchParams({ ns: namespace });
      if (shallow) query.set('shallow', 'true');
      const url = `${origin(databaseHost)}/${nodePath}.json?${query}`;
      return (await request(url)).json();
    },
  };
}

module.exports = { createEmulatorIo, requestExport, SOURCE_IMAGE_PREFIX };
