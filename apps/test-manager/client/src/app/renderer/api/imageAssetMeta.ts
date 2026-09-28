// 第二段階: grade 指定で再利用できる画像メタ購読共通 hook (T47)
// testDataEditor と createPdf の双方から参照する
import {
  assetsPath,
  type Grade,
  useTypedFirestoreHandler,
} from '@hooks/useTypedFirestoreHandler';
import {
  buildReadyAssetUrl,
  mergeImageMetaState,
  mergeReadyImageState,
  readImageDimensionsFromAsset,
} from '@renderer/api/imageAssetCache';
import type { AssetKey, AssetReadyNotice } from '@shared/types/assets';
import type { AssetData, GradeId } from '@shared/types/contracts';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';

export type ImageItem = Omit<AssetData, 'md5Hash' | 'contentType' | 'size'> & {
  name: string;
};

/** `${grade}/${key}` 形式の複合キーを生成する */
export const kOf = (it: AssetKey): string => `${it.grade}/${it.key}`;

/** Firestore ドキュメントを UI 用エントリに射影する純粋変換 */
export const docToImageItem = (
  grade: GradeId,
  d: { path: string; data?: AssetData | null },
): ImageItem => {
  const keyFromPath = d.path.split('/').pop() ?? '';
  return {
    grade,
    key: d.data?.key ?? keyFromPath,
    objectPath: d.data?.objectPath,
    name: d.data?.objectPath?.split('/').pop() ?? keyFromPath,
    subject: d.data?.subject,
    bigCategoryTag: d.data?.bigCategoryTag,
    smallCategoryTag: d.data?.smallCategoryTag,
    tag: d.data?.tag ?? [],
    title: d.data?.title ?? '',
    createdAt: d.data?.createdAt,
    updatedAt: d.data?.updatedAt,
    usedIds: d.data?.usedIds ?? [],
    width: d.data?.width,
    height: d.data?.height,
  };
};

type ImageMetaSubscriptionResult = {
  imageItems: ImageItem[];
  isLoadingImageMeta: boolean;
};

/**
 * grade 指定で画像メタ一覧を返す共通 hook。
 * Firestore 購読 + IPC イベント購読（ready/progress/error）を担い、
 * ダウンロード状態を useAssetCacheStore へ書き込む。
 * testDataEditor と createPdf の両方から再利用する。
 */
export const useImageMetaSubscription = (
  grade: Grade,
): ImageMetaSubscriptionResult => {
  const { setImagesStateMap, setLogs } = useAssetCacheStore(
    useShallow((s) => ({
      setImagesStateMap: s.setImagesStateMap,
      setLogs: s.setLogs,
    })),
  );

  const collectionPath = useMemo(() => assetsPath(grade), [grade]);
  const h = useTypedFirestoreHandler<typeof collectionPath>(collectionPath, {
    autoSubscribe: true,
    includeOutbox: true,
  });

  const imageItems = useMemo(
    () => h.docs.map((d) => docToImageItem(grade, d)),
    [h.docs, grade],
  );

  // Firestore ドキュメント変化時: 一覧を更新し、新規 item を idle で初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    console.log('Firestore image meta updated', { items: imageItems });
    setImagesStateMap((prev) => {
      const next = { ...prev };
      for (const it of imageItems) {
        const id = kOf(it);
        next[id] = mergeImageMetaState(next[id], {
          width: it.width,
          height: it.height,
        });
      }
      return next;
    });
  }, [imageItems]);

  // IPC イベント購読: ダウンロード状態を useAssetCacheStore へ反映
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    const offReady = window.assets.onReady((x: AssetReadyNotice) => {
      const id = kOf({ grade: x.grade, key: x.key });
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: mergeReadyImageState(prev[id], x),
      }));

      // 寸法はFirestoreメタを優先し、不足時だけ asset URL から補完する（設計10.1）
      readImageDimensionsFromAsset({
        url: buildReadyAssetUrl(x.grade, x.key, x),
      }).then((dimensions) => {
        if (!dimensions) return;
        setImagesStateMap((prev) => ({
          ...prev,
          [id]: mergeImageMetaState(prev[id], dimensions),
        }));
      });
    });

    const offProg = window.assets.onProgress((x) => {
      const id = `${x.grade}/${x.key}`;
      setImagesStateMap((prev) => {
        const prevSt = prev[id];
        const prevTransferred =
          prevSt?.status === 'downloading' ? prevSt.transferred : 0;
        const prevTotal =
          prevSt?.status === 'downloading' ? prevSt.total : undefined;
        const transferred = Math.max(prevTransferred ?? 0, x.transferred ?? 0);
        const total = x.total ?? prevTotal;
        return {
          ...prev,
          [id]: {
            status: 'downloading',
            transferred,
            total,
            width: prevSt?.width,
            height: prevSt?.height,
          },
        };
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
      const id = kOf({ grade: g as GradeId, key: k });
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: {
          status: 'failed',
          message: msg,
          width: prev[id]?.width,
          height: prev[id]?.height,
        },
      }));
      setLogs([`ERROR ${id} ${msg}`]);
    });

    return () => {
      offReady?.();
      offProg?.();
      offErr?.();
    };
  }, []);

  return { imageItems, isLoadingImageMeta: h.loading };
};
