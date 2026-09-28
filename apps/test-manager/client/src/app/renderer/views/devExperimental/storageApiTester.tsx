import {
  assetsPath,
  type Grade,
  useTypedFirestoreHandler,
} from '@components/hooks/useTypedFirestoreHandler';
import { buildReadyAssetUrl } from '@renderer/api/imageAssetCache';
import type { AssetKey, AssetReadyNotice } from '@shared/types/assets';
import type { AssetData, GradeId } from '@shared/types/contracts';
import { Button } from '@ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function kOf(it: AssetKey) {
  return `${it.grade}/${it.key}`;
}

type ItemState =
  | { status: 'idle' }
  | { status: 'queued' }
  | { status: 'downloading'; transferred: number; total?: number }
  | {
      status: 'ready';
      contentType?: string;
      version?: string;
      recoveryToken?: string;
      readyNoticeSeq: number;
    }
  | { status: 'failed'; message: string };

// Firestoreのドキュメントを UI 用のエントリに射影
function docToItem(
  grade: GradeId,
  d: { path: string; data?: AssetData | null },
) {
  const keyFromPath = d.path.split('/').pop() ?? '';
  return {
    grade,
    key: d.data?.key ?? keyFromPath,
    name: d.data?.objectPath?.split('/').pop() ?? keyFromPath,
    objectPath: d.data?.objectPath,
  };
}

export default function StorageApiTester() {
  // grade は devExperimental/index.tsx と同じ Grade 型を採用
  const [grade, setGrade] = useState<Grade>('firstGrade');

  // storageList/{grade}/images を購読
  const collectionPath = useMemo(() => assetsPath(grade), [grade]);
  const h = useTypedFirestoreHandler<typeof collectionPath>(collectionPath, {
    autoSubscribe: true,
    includeOutbox: true,
  });

  // ドキュメントから一覧を生成
  const items = useMemo(
    () => h.docs.map((d) => docToItem(grade, d)),
    [h.docs, grade],
  );

  // ダウンロード状態管理とプレビュー
  const [imagesStateMap, setImagesStateMap] = useState<
    Record<string, ItemState>
  >({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = useMemo<AssetKey | null>(() => {
    if (!selectedKey) return null;
    const [g, key] = selectedKey.split('/');
    return { grade: g as GradeId, key };
  }, [selectedKey]);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (!grade) {
        setLogs((l) => [...l, 'アップロード失敗: グレードが未選択です']);
        e.target.value = '';
        return;
      }

      setUploading(true);
      try {
        for (const f of Array.from(files)) {
          // Electron では drag&drop や input で File に path が付く場合がある
          const filePath = window.webUtils.getPathForFile(f);
          /* console.log('selected file', f);
          console.log(
            'file path from webUtils',
            window.webUtils.getPathForFile(f),
          );
          */

          if (!filePath) {
            setLogs((l) => [
              ...l,
              `スキップ: 絶対パスを取得できません (${f.name})`,
            ]);
            continue;
          }
          setLogs((l) => [...l, `アップロード開始: ${f.name} -> ${grade}`]);

          // console.log('uploading file', filePath, grade);
          const res = await window.assets.upload(filePath, grade);

          if (res?.ok) {
            setLogs((l) => [
              ...l,
              `アップロード成功: ${res.filePath} -> ${res.objectPath}`,
            ]);
          } else {
            setLogs((l) => [
              ...l,
              `アップロード失敗: ${f.name} -> ${res?.error ?? '原因不明'}`,
            ]);
          }
        }
      } catch (err) {
        setLogs((l) => [...l, `アップロード例外: ${String(err)}`]);
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [grade],
  );

  // 変更箇所3: ファイルダイアログを開くヘルパ
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // ログ表示
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ログ更新時にスクロール
  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight });
  }, [logs]);

  // 新規に現れたドキュメントの状態を idle で初期化
  useEffect(() => {
    setImagesStateMap((prev) => {
      const next = { ...prev };
      for (const it of items) {
        const id = kOf({ grade: it.grade, key: it.key });
        if (!next[id]) next[id] = { status: 'idle' };
      }
      return next;
    });
  }, [items]);

  // IPCイベントの購読（ready/progress/error）
  useEffect(() => {
    const offReady = window.assets.onReady((x: AssetReadyNotice) => {
      const it: AssetKey = {
        grade: x.grade,
        key: x.key,
      };
      const id = kOf(it);
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: {
          status: 'ready',
          contentType: x.contentType,
          version: x.version,
          recoveryToken: x.recoveryToken,
          readyNoticeSeq: 1,
        },
      }));
      setLogs((l) => [...l, `READY ${id} (v=${x.version ?? '-'})`]);
    });
    const offProg = window.assets.onProgress((x) => {
      const id = `${x.grade}/${x.key}`;
      setImagesStateMap((prev) => {
        const prevSt = prev[id];
        const prevTransferred =
          prevSt && prevSt.status === 'downloading' ? prevSt.transferred : 0;
        const prevTotal =
          prevSt && prevSt.status === 'downloading' ? prevSt.total : undefined;
        const transferred = Math.max(prevTransferred ?? 0, x.transferred ?? 0);
        const total = x.total ?? prevTotal;
        return { ...prev, [id]: { status: 'downloading', transferred, total } };
      });
    });
    const offErr = window.assets.onError((e: unknown) => {
      const g =
        typeof e === 'object' && e && 'grade' in e
          ? String(e.grade)
          : 'unknown';
      const k =
        typeof e === 'object' && e && 'key' in e ? String(e.key) : 'unknown';
      const msg =
        typeof e === 'object' && e && 'message' in e
          ? String(e.message)
          : String(e);
      const id = `${g}/${k}`;
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: { status: 'failed', message: msg },
      }));
      setLogs((l) => [...l, `ERROR ${id} ${msg}`]);
    });
    return () => {
      offReady?.();
      offProg?.();
      offErr?.();
    };
  }, []);

  // 一括リクエスト（hookのdocsから AssetKey[] を作成）
  const requestAll = async () => {
    if (!items.length) return;
    const keys: AssetKey[] = items.map(({ grade, key }) => ({ grade, key }));
    const res = await window.assets.request(keys);
    if (!res.ok) {
      setLogs((l) => [...l, `Request error: ${res.error}`]);
      return;
    }
    // 即時ready分を反映
    for (const r of res.ready) {
      const id = kOf(r);
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: {
          status: 'ready',
          contentType: r.contentType,
          version: r.version,
          recoveryToken: r.recoveryToken,
          readyNoticeSeq: 1,
        },
      }));
    }
    // 残りは queued 表示
    setImagesStateMap((prev) => {
      const next = { ...prev };
      for (const p of res.pending) {
        const id = kOf(p);
        const cur = next[id];
        if (!cur || cur.status === 'idle' || cur.status === 'failed') {
          next[id] = { status: 'queued' };
        }
      }
      return next;
    });
    setLogs((l) => [...l, `Requested ${keys.length} items`]);
  };

  // 行選択で未readyなら優先DL
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedKey 変更時に発火
  useEffect(() => {
    if (!selected) return;
    const id = kOf(selected);
    const st = imagesStateMap[id];
    if (
      !st ||
      st.status === 'idle' ||
      st.status === 'failed' ||
      st.status === 'queued'
    ) {
      window.assets
        .prioritize([selected], 50)
        .then((r) => {
          if (!r.ok) {
            setLogs((l) => [...l, `Prioritize error: ${r.error}`]);
            return;
          }
          setImagesStateMap((prev) => ({
            ...prev,
            [id]: { status: 'queued' },
          }));
          setLogs((l) => [...l, `Prioritized ${id}`]);
        })
        .catch((e) =>
          setLogs((l) => [...l, `Prioritize exception: ${String(e)}`]),
        );
    }
  }, [selectedKey]);

  // キャッシュ全削除（window.d.ts 未定義のためランタイム存在チェックで実行）
  const clearCache = async () => {
    const hasClear = typeof window.assets?.clearCache === 'function';
    if (!hasClear) {
      setLogs((l) => [
        ...l,
        'clearCacheは未実装（window.d.ts未定義）。メイン/Preloadへ実装追加推奨。',
      ]);
      return;
    }
    await window.assets.clearCache();
    // 表示状態を初期化
    setImagesStateMap((_prev) => {
      const next: Record<string, ItemState> = {};
      for (const it of items)
        next[kOf({ grade: it.grade, key: it.key })] = { status: 'idle' };
      return next;
    });
    setLogs((l) => [...l, 'キャッシュを全削除しました']);
  };

  // 追加テスト: 選択アイテムへの連打（重複抑止と優先度上書きの確認）
  const stressSelected = async () => {
    if (!selected) return;
    const s = selected;
    for (let i = 0; i < 5; i++) {
      // request の結果はイベントで反映されるため fire-and-forget
      void window.assets.request([s]);
      // prioritize は結果を判定

      const r = await window.assets.prioritize([s], 40 + i);
      if (!r.ok) {
        setLogs((l) => [...l, `Stress prioritize error: ${r.error}`]);
      }
    }
    setLogs((l) => [...l, `Stress requested/prioritized ${kOf(s)} x5`]);
  };

  // 追加テスト: 失敗分をまとめて優先再DL
  const retryFailed = async () => {
    const failed = items
      .map(({ grade, key }) => ({ grade, key }))
      .filter((it) => imagesStateMap[kOf(it)]?.status === 'failed');
    if (!failed.length) return;
    const r = await window.assets.prioritize(failed, 35);
    if (!r.ok) {
      setLogs((l) => [...l, `Retry failed error: ${r.error}`]);
      return;
    }
    setLogs((l) => [...l, `Retry failed ${failed.length} items`]);
  };

  // 表示用データ
  const rows = useMemo(() => {
    return items.map((it) => {
      const id = kOf({ grade: it.grade, key: it.key });
      const st = imagesStateMap[id];
      let statusText = '未リクエスト';
      if (st) {
        switch (st.status) {
          case 'idle':
            statusText = '待機（未要求）';
            break;
          case 'queued':
            statusText = 'キュー待機';
            break;
          case 'downloading': {
            const pct = st.total
              ? Math.floor((st.transferred / st.total) * 100)
              : undefined;
            statusText = `DL中 ${st.transferred}${st.total ? `/${st.total}` : ''}${pct !== undefined ? ` (${pct}%)` : ''}`;
            break;
          }
          case 'ready':
            statusText = '完了（キャッシュ有り）';
            break;
          case 'failed':
            statusText = `失敗: ${st.message}`;
            break;
        }
      }
      return { ...it, id, st, statusText };
    });
  }, [items, imagesStateMap]);


  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}
    >
      <div>
        <h2>Storage API テスター</h2>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <label>
            グレード:
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade)}
              style={{ marginLeft: 8 }}
            >
              <option value="firstGrade">firstGrade</option>
              <option value="secondGrade">secondGrade</option>
            </select>
          </label>
          <Button onClick={requestAll} disabled={!items.length}>
            一括リクエスト
          </Button>
          <Button type="button" onClick={retryFailed}>
            失敗分を再優先DL
          </Button>
          <Button type="button" onClick={clearCache}>
            キャッシュ全削除
          </Button>
          <Button type="button" onClick={stressSelected} disabled={!selected}>
            選択アイテム 連打テスト
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            multiple
            style={{ display: 'none' }}
            onChange={onFilesSelected}
          />
          <Button
            type="button"
            onClick={openFilePicker}
            disabled={uploading}
            title="PNG画像を選択してアップロード"
          >
            {uploading ? 'アップロード中…' : '画像を選択してアップロード'}
          </Button>
        </div>

        <div style={{ color: '#666', marginBottom: 8 }}>
          パス: {collectionPath} / 件数: {h.docs.length}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 6,
            height: 400,
            overflow: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: '#fafafa' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>キー</th>
                <th style={{ textAlign: 'left', padding: 8 }}>状態</th>
                <th style={{ textAlign: 'left', padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedKey(r.id)}
                  style={{
                    cursor: 'pointer',
                    background: selectedKey === r.id ? '#eef6ff' : undefined,
                    borderTop: '1px solid #eee',
                  }}
                >
                  <td style={{ padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>{r.key}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      grade: {r.grade} {r.name ? ` / ${r.name}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    {r.statusText}
                    {r.st?.status === 'downloading' && r.st.total && (
                      <div
                        style={{
                          height: 6,
                          background: '#eee',
                          borderRadius: 4,
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.floor((r.st.transferred / r.st.total) * 100)}%`,
                            height: 6,
                            background: '#4e8ef7',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.assets
                            .request([{ grade: r.grade, key: r.key }])
                            .then((res) => {
                              if (!res.ok) {
                                setLogs((l) => [
                                  ...l,
                                  `Request one ${r.id} error: ${res.error}`,
                                ]);
                                return;
                              }
                              setLogs((l) => [
                                ...l,
                                `Request one ${r.id} -> pending=${res.pending.length}, ready=${res.ready.length}`,
                              ]);
                              if (res.ready.length) {
                                const rr = res.ready[0];
                                setImagesStateMap((prev) => ({
                                  ...prev,
                                  [r.id]: {
                                    status: 'ready',
                                    contentType: rr.contentType,
                                    version: rr.version,
                                    recoveryToken: rr.recoveryToken,
                                    readyNoticeSeq: 1,
                                  },
                                }));
                              } else {
                                setImagesStateMap((prev) => ({
                                  ...prev,
                                  [r.id]: { status: 'queued' },
                                }));
                              }
                            });
                        }}
                      >
                        取得
                      </Button>
                      <Button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await window.assets.prioritize(
                            [{ grade: r.grade, key: r.key }],
                            60,
                          );
                          if (!res.ok) {
                            setLogs((l) => [
                              ...l,
                              `Prioritize error (${r.id}): ${res.error}`,
                            ]);
                            return;
                          }
                          setImagesStateMap((prev) => ({
                            ...prev,
                            [r.id]: { status: 'queued' },
                          }));
                        }}
                      >
                        優先DL
                      </Button>
                      <Button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          // 確認ダイアログ（不要なら削除可）
                          const ok = window.confirm(
                            `本当に削除しますか？\ngrade: ${r.grade}\nkey: ${r.key}`,
                          );
                          if (!ok) return;

                          try {
                            const res = await window.assets.delete({
                              grade: r.grade as GradeId,
                              key: r.key,
                            });
                            if (!res.ok) {
                              setLogs((l) => [
                                ...l,
                                `削除失敗 (${r.id}): ${res.error}`,
                              ]);
                              return;
                            }

                            setLogs((l) => [...l, `削除成功: ${r.id}`]);

                            // ローカル状態を反映: 行の state を初期化
                            setImagesStateMap((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });

                            // Firestore 購読はサーバ側削除を検知して docs が減るので、
                            // items/rows は自動的に再計算される想定
                          } catch (err) {
                            setLogs((l) => [
                              ...l,
                              `削除例外 (${r.id}): ${String(err)}`,
                            ]);
                          }
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} style={{ padding: 16, color: '#777' }}>
                    リストが空です。Firestoreのエミュレータ/オンラインにデータがない可能性があります。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 16 }}>ログ</h3>
        <div
          ref={logsRef}
          style={{
            border: '1px solid #ddd',
            borderRadius: 6,
            height: 160,
            overflow: 'auto',
            padding: 8,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            background: '#fafafa',
          }}
        >
          {logs.map((l, i) => {
            const key = `log-${i}`;
            return <div key={key}>{l}</div>;
          })}
        </div>
      </div>

      <div>
        <h3>プレビュー</h3>
        {selected ? (
          <div style={{ marginBottom: 8, color: '#555' }}>{kOf(selected)}</div>
        ) : (
          <div style={{ marginBottom: 8, color: '#777' }}>
            行を選択してください
          </div>
        )}
        {(() => {
          const st = selected ? imagesStateMap[kOf(selected)] : undefined;
          if (selected && st?.status === 'ready') {
            const src = buildReadyAssetUrl(selected.grade, selected.key, st);
            return (
              <img
                src={src}
                alt="preview"
                style={{
                  maxWidth: '100%',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                }}
              />
            );
          }
          if (selected) {
            return (
              <div
                style={{
                  padding: 16,
                  border: '1px dashed #ccc',
                  borderRadius: 6,
                  color: '#777',
                }}
              >
                まだローカルにありません。選択すると自動的に優先DLします।
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}
