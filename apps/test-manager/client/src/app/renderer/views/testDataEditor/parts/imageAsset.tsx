import { DUMMY_IMG } from '@api/dummyImage';
import { buildReadyAssetUrl } from '@api/imageAssetCache';
import { REACT_MANAGED_ASSET_ATTRIBUTE } from '@api/imageErrorRecovery';
import type { GradeId } from '@shared/types/contracts';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import React, { useCallback, useMemo, useRef, useState } from 'react';

type Props = {
  id: string;
  itemRef?: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  width?: string | number;
  height?: string | number;
};

const ImageAsset = React.memo(
  (props: Props) => {
    const st = useAssetCacheStore((s) => s.imagesStateMap[props.id]);
    const isDisplayed = useImageAssetStore((s) =>
      Boolean(s.isDisplayMap[props.id]),
    );
    const imageRef = useRef<HTMLImageElement>(null);

    // props.id は `${grade}/${key}` 形式
    const identity = useMemo(() => {
      const [grade, ...rest] = props.id.split('/');
      if (grade !== 'firstGrade' && grade !== 'secondGrade') return undefined;
      return { grade: grade as GradeId, key: rest.join('/') };
    }, [props.id]);

    const assetUrl =
      isDisplayed && st?.status === 'ready' && identity
        ? buildReadyAssetUrl(identity.grade, identity.key, st)
        : null;

    // 表示用の失敗状態（設計5.5）。失敗したURLを保持することで、
    // 新しい version / token のURLが来れば自動的に再試行できる。
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    // 現在tokenの成功報告確認待ち
    const [reportedToken, setReportedToken] = useState<string | null>(null);

    const handleError = useCallback(() => {
      if (!assetUrl || !identity || st?.status !== 'ready') return;

      setFailedUrl(assetUrl);
      void window.assets
        ?.reportLoadFailure({
          grade: identity.grade,
          key: identity.key,
          version: st.version,
          recoveryToken: st.recoveryToken,
        })
        .catch(() => {
          // IPC失敗時も表示はダミーのまま、失敗状態を維持する
        });
    }, [assetUrl, identity, st]);

    const handleLoad = useCallback(() => {
      if (!assetUrl || !identity || st?.status !== 'ready') return;
      // 通常の r なし load では成功報告を送らない（設計5.5）
      const token = st.recoveryToken;
      if (!token || reportedToken === token) return;

      setReportedToken(token);
      void window.assets
        ?.reportLoadSuccess({
          grade: identity.grade,
          key: identity.key,
          version: st.version,
          recoveryToken: token,
        })
        .then((result) => {
          // confirmed のときだけ失敗表示を解除する。
          // confirmed=false やIPC失敗では表示中画像をダミーへ戻さない。
          if (result?.ok && result.confirmed) {
            setFailedUrl(null);
          }
        })
        .catch(() => {});
    }, [assetUrl, identity, reportedToken, st]);

    return (
      <img
        ref={imageRef}
        // 共通のDOM回復listenerと二重に処理しないための目印（設計10.2 / 10.5）
        {...{ [REACT_MANAGED_ASSET_ATTRIBUTE]: '1' }}
        style={{ width: props.width, height: props.height }}
        src={assetUrl && assetUrl !== failedUrl ? assetUrl : DUMMY_IMG}
        onError={handleError}
        onLoad={handleLoad}
        alt="preview"
      />
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.width === next.width &&
    prev.height === next.height,
);

export default ImageAsset;
