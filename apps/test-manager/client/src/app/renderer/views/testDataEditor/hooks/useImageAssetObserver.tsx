import {
  buildReadyAssetUrl,
  mergeImageMetaState,
  mergeReadyImageState,
  readImageDimensionsFromAsset,
} from '@renderer/api/imageAssetCache';
import type { AssetKey } from '@shared/types/assets';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { type ImageItem, kOf } from './useImageAssetList';

type ImageAssetObserver = {
  listRef: React.RefObject<HTMLDivElement | null>;
};

type Props = {
  imageItems: ImageItem[];
};

const useImageAssetObserver = (props: Props): ImageAssetObserver => {
  const { setLogs, setImagesStateMap } = useAssetCacheStore(
    useShallow((s) => ({
      setLogs: s.setLogs,
      setImagesStateMap: s.setImagesStateMap,
      imagesStateMap: s.imagesStateMap,
    })),
  );
  const { setIsDisplayMap, imageItemKeys, ignoreRequestItemKeys } =
    useImageAssetStore(
      useShallow((s) => ({
        setIsDisplayMap: s.setIsDisplayMap,
        imageItemKeys: s.imageItemKeys,
        ignoreRequestItemKeys: s.ignoreRequestItemKeys,
      })),
    );

  const listRef = useRef<HTMLDivElement>(null);
  const options = {
    root: listRef.current,
    rootMargin: '500px 0px 500px 0px',
    threshold: 0,
  };

  //画像のリクエスト
  // biome-ignore lint/correctness/useExhaustiveDependencies: useCallbackのため
  const requestImageAsset = useCallback(async (assetKey: AssetKey) => {
    const res = await window.assets.request([assetKey]);
    if (!res.ok) {
      setLogs([`Request error: ${res.error}`]);
      return;
    }
    // 削除済み・不存在・状態確認不能・回復上限は failed として表示へ反映する（設計10.5）
    for (const f of res.failed) {
      const id = `${f.grade}/${f.key}`;
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: { status: 'failed', message: f.message },
      }));
    }

    for (const r of res.ready) {
      const id = `${r.grade}/${r.key}`;
      setImagesStateMap((prev) => ({
        ...prev,
        [id]: mergeReadyImageState(prev[id], r),
      }));
      readImageDimensionsFromAsset({
        url: buildReadyAssetUrl(r.grade, r.key, r),
      }).then((dimensions) => {
        if (!dimensions) return;
        setImagesStateMap((prev) => ({
          ...prev,
          [id]: mergeImageMetaState(prev[id], dimensions),
        }));
      });
    }
  }, []);

  // 事前リクエスト（最初の5件）
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  const preLoad = useCallback(async () => {
    const preloadKeys = imageItemKeys.slice(0, 5);
    const preloadImages = preloadKeys
      .map((k) =>
        props.imageItems.find((item) => {
          return kOf(item) === k;
        }),
      )
      .filter((it): it is ImageItem => it !== undefined);
    console.log('preloadImages:', preloadImages);
    if (!preloadImages.length) return;
    const next: Record<string, boolean> = {};
    for (const item of preloadImages) {
      //ignoreKeyがある場合はリクエストしない
      if (ignoreRequestItemKeys.includes(kOf(item))) continue;
      await requestImageAsset(item);
      next[kOf(item)] = true;
    }

    setIsDisplayMap(() => next);
  }, [
    requestImageAsset,
    ignoreRequestItemKeys,
    imageItemKeys,
    props.imageItems,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    if (!imageItemKeys.length) return;
    preLoad();
  }, [imageItemKeys]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    if (!imageItemKeys.length) return;
    // 各imageItemのDOM要素を取得
    const elements = Array.from(listRef?.current?.children ?? []);

    // IntersectionObserverで要素が表示されたらアセットをリクエスト
    const observer = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        const targetId = entry.target.id;
        if (!targetId) continue;
        const items = props.imageItems.find((item) => kOf(item) === targetId);
        if (!items) continue;
        const image = useAssetCacheStore.getState().imagesStateMap[targetId];
        if (entry.isIntersecting) {
          if (image?.status === 'ready') {
            setIsDisplayMap((prev) => ({ ...prev, [targetId]: true }));
            continue;
          }
          //ignoreKeyがある場合はリクエストしない
          if (ignoreRequestItemKeys.includes(kOf(items))) continue;
          await requestImageAsset(items);
          setIsDisplayMap((prev) => ({ ...prev, [targetId]: true }));
        } else {
          if (image?.status === 'ready') {
            setIsDisplayMap((prev) => ({ ...prev, [targetId]: false }));
          }
        }
      }
    }, options);

    // すべてのrefを監視
    if (!elements.length) return;
    elements.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [imageItemKeys]);

  return {
    listRef,
  };
};

export default useImageAssetObserver;
