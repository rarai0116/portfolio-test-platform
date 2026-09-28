// 開発専用ガード（本番で読み込まれたら即例外）
if (!import.meta.env.DEV) {
  throw new Error('DevExperimental は開発専用のページです（本番では使用不可）');
}

import {
  assetsPath,
  type Grade,
  useTypedFirestoreHandler,
} from '@components/hooks/useTypedFirestoreHandler';
import type { AssetKey } from '@shared/types/assets';
import type { AssetData } from '@shared/types/contracts';
import { Button } from '@ui/button';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';

async function requestAssets(items: AssetKey[]) {
  // preload 経由の安全な API を利用
  return window.assets.request(items);
}
// -----------------------------
// 小パネル: Assets 用（既存）
// -----------------------------
function AssetsPanel({ grade }: { grade: Grade }) {
  const collectionPath = useMemo(() => assetsPath(grade), [grade]);
  const h = useTypedFirestoreHandler<typeof collectionPath>(collectionPath, {
    autoSubscribe: true,
    includeOutbox: true,
  });

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const data: Partial<AssetData> = {
      grade: grade,
      key: newId,
      contentType: 'image/png',
      objectPath: `images/${newId || 'sample'}.png`,
      size: 0,
      md5Hash: undefined,
      updatedAt: Timestamp.now(),
    };
    await h
      .create(data, newId || undefined)
      .catch((e) => console.error('create error', e));
    setNewId('');
    setNewName('');
  };

  const handleUpdate = async (path: string) => {
    const _d = h.docs.find((d) => d.path === path);
    if (!_d?.data) {
      console.error('Document not found for update', path);
      return;
    }
    const data: Partial<AssetData> = {
      // ここでは updatedAt のみ更新
      key: _d.data.key ?? '',
      grade: _d.data.grade,
      updatedAt: Timestamp.now(),
    };
    console.log('Updating document', path, data);
    await h.update(path, data).catch((e) => console.error('update error', e));
  };

  const handleDelete = async (path: string) => {
    await h.remove(path).catch((e) => console.error('delete error', e));
  };

  useEffect(() => {
    const offReady = window.assets.onReady((item) => {
      console.log(
        '[assets] READY',
        item.grade,
        item.key,
        item.contentType,
        item.version,
      );
    });
    const offErr = window.assets.onError((e) => {
      console.error('[assets] ERROR', e);
    });
    const offProg = window.assets.onProgress(
      (e: {
        grade: string;
        key: string;
        transferred: number;
        total?: number;
      }) => {
        if (e.total) {
          console.log(
            '[assets] PROGRESS',
            e.grade,
            e.key,
            `${e.transferred}/${e.total}`,
          );
        } else {
          console.log('[assets] PROGRESS', e.grade, e.key, `${e.transferred}`);
        }
      },
    );
    return () => {
      offReady();
      offErr();
      offProg();
    };
  }, []);
  return (
    <>
      <div className="space-y-2 border rounded-md p-3">
        <div className="font-semibold">
          Create ({collectionPath}/{'{id}'})
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="id (空なら自動)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        <Button
          onClick={() => {
            requestAssets(
              h.docs.map((d) => ({
                grade,
                key: d.data?.key || '',
              })),
            ).then((res) => {
              if (!res.ok) {
                console.error('requestAssets error', res.error);
                return;
              }
              console.log('requestAssets result', res);
            });
          }}
          variant="outline"
        >
          Assetsを全部リクエスト
        </Button>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Docs ({h.docs.length})</div>
        <ul className="space-y-2">
          {h.docs
            .slice()
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((d) => (
              <li key={d.path} className="border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs">{d.path}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdate(d.path)}
                    >
                      Update
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(d.path)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="text-xs mt-2 bg-muted/30 p-2 rounded overflow-auto">
                  {JSON.stringify(d.data, null, 2)}
                </pre>
              </li>
            ))}
        </ul>
      </div>

      {Array.isArray(h.outboxItems) && (
        <div className="space-y-2 border rounded-md p-3">
          <div className="font-semibold">
            Outbox Items ({h.outboxItems.length})
          </div>
          <ul className="space-y-1">
            {h.outboxItems
              .slice()
              .sort((a, b) => a.createdAtMs - b.createdAtMs)
              .map((it) => (
                <li key={it.mutationId} className="text-xs font-mono">
                  [{new Date(it.createdAtMs).toLocaleTimeString()}]{' '}
                  {it.status.toUpperCase()} {it.kind} {it.path} retries=
                  {it.retries} id={it.mutationId.slice(0, 8)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ---------------------------------
// 小パネル: TestData 用（新規追加）
// - JSON で自由に作成/更新できるようにする
// ---------------------------------
function TestDataPanel({ path }: { path: 'firstGrade' | 'secondGrade' }) {
  // apps/client/src/app/renderer/devExperimental/index.tsx: 変更点 - 変数への 'as const' アサーションは不可のため削除
  const p = path;
  const h = useTypedFirestoreHandler<typeof p>(p, {
    autoSubscribe: true,
    includeOutbox: true,
  });

  const [newId, setNewId] = useState('');
  const [jsonText, setJsonText] = useState(
    '{"name":"sample","status":"active"}',
  );

  const parseJson = () => {
    try {
      const obj = JSON.parse(jsonText);
      if (obj && typeof obj === 'object') return obj;
    } catch {
      // noop
    }
    return null;
  };

  const handleCreate = async () => {
    const obj = parseJson();
    if (!obj) {
      throw new Error('JSON が不正です');
    }
    await h
      .create(obj, newId || undefined)
      .catch((e) => console.error('create error', e));
    setNewId('');
  };

  const handleUpdate = async (docPath: string) => {
    const obj = parseJson();
    if (!obj) {
      throw new Error('JSON が不正です');
    }
    await h.update(docPath, obj).catch((e) => console.error('update error', e));
  };

  const handleDelete = async (docPath: string) => {
    await h.remove(docPath).catch((e) => console.error('delete error', e));
  };

  return (
    <>
      <div className="space-y-2 border rounded-md p-3">
        <div className="font-semibold">
          Create ({path}/{'{id}'})
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          <input
            className="border rounded px-2 py-1"
            placeholder="id (空なら自動)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <textarea
            className="border rounded px-2 py-1 font-mono text-xs min-h-24 w-full"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Docs ({h.docs.length})</div>
        <ul className="space-y-2">
          {h.docs
            .slice()
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((d) => (
              <li key={d.path} className="border rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs">{d.path}</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdate(d.path)}
                    >
                      Update(JSON適用)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(d.path)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="text-xs mt-2 bg-muted/30 p-2 rounded overflow-auto">
                  {JSON.stringify(d.data, null, 2)}
                </pre>
              </li>
            ))}
        </ul>
      </div>

      {Array.isArray(h.outboxItems) && (
        <div className="space-y-2 border rounded-md p-3">
          <div className="font-semibold">
            Outbox Items ({h.outboxItems.length})
          </div>
          <ul className="space-y-1">
            {h.outboxItems
              .slice()
              .sort((a, b) => a.createdAtMs - b.createdAtMs)
              .map((it) => (
                <li key={it.mutationId} className="text-xs font-mono">
                  [{new Date(it.createdAtMs).toLocaleTimeString()}]{' '}
                  {it.status.toUpperCase()} {it.kind} {it.path} retries=
                  {it.retries} id={it.mutationId.slice(0, 8)}
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
}

// -----------------------------
// 親: ページ本体（切り替え UI）
// -----------------------------
const DevExperimental = () => {
  // 切り替え状態
  const [mode, setMode] = useState<'images' | 'testData'>('images');
  const [grade, setGrade] = useState<Grade>('firstGrade');

  const handleRefreshDocs = async () => {
    // 個別パネルの h.refresh() を叩く必要があるため、ここでは案内のみ
    // → 現在のパネルに Refresh ボタンがあります
  };

  if (!(typeof window !== 'undefined' && 'fs' in window)) {
    // window.fs 未初期化時の安全弁
    return (
      <div className="p-4 text-sm">
        Preload API (window.fs) が未初期化です。ウィンドウを再読み込みするか、
        preload/index.ts で `import './firebase'`
        が呼ばれているか、BrowserWindow の preload パスを確認してください。
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <NavLink to="/testDataEditor" state={{ idList: ['no1', 'no2', 'no3'] }}>
          <Button variant="primary">編集する</Button>
        </NavLink>

        <div className="ml-auto flex items-center gap-2">
          {/* 切り替えコントロール */}
          <select
            className="border rounded px-2 py-1"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'images' | 'testData')}
            aria-label="dataset-type"
          >
            <option value="images">
              Images (storageList/{'{grade}'}/images)
            </option>
            <option value="testData">TestData (firstGrade/secondGrade)</option>
          </select>
          <select
            className="border rounded px-2 py-1"
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade)}
            aria-label="grade"
          >
            <option value="firstGrade">firstGrade</option>
            <option value="secondGrade">secondGrade</option>
          </select>
          <Button onClick={handleRefreshDocs} variant="outline" disabled>
            Refresh Docs（各パネル内のボタンを使用）
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        mode={mode} / grade={grade}
      </div>

      {/* パネル切り替え */}
      {mode === 'images' ? (
        <AssetsPanel grade={grade} />
      ) : (
        <TestDataPanel path={grade} />
      )}
    </div>
  );
};

export default DevExperimental;
