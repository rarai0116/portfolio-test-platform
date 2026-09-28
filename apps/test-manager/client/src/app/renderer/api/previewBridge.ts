import { buildReadyAssetUrl } from '@api/imageAssetCache';
import type {
  PreviewFullPayload,
  PreviewImagesMap,
  PreviewPatchPayload,
} from '@shared/types/preview';
import useAssetCacheStore from '@stores/useAssetCacheStore';

export const getPreviewImagesMap = (): PreviewImagesMap => {
  const { imagesStateMap } = useAssetCacheStore.getState();
  const map: PreviewImagesMap = {};

  Object.entries(imagesStateMap).forEach(([id, st]) => {
    if (st?.status !== 'ready') {
      return;
    }

    const [grade, ...rest] = id.split('/');
    const key = rest.join('/');
    if (grade !== 'firstGrade' && grade !== 'secondGrade') {
      return;
    }

    map[key] = {
      // 画像本体ではなく demo-asset URL を渡す（設計11.4）
      url: buildReadyAssetUrl(grade, key, st),
      contentType: st.contentType,
      width: st.width,
      height: st.height,
    };
  });

  return map;
};

export const sendPreviewFull = (payload: PreviewFullPayload) => {
  window.preview.send(payload);
};

export const sendPreviewPatch = (payload: PreviewPatchPayload) => {
  window.preview.send(payload);
};

export const patchPreviewImages = async (
  id: string,
  images?: PreviewImagesMap,
) => {
  const imgs = images ?? getPreviewImagesMap();
  await window.preview.patchImages({ id: String(id ?? ''), images: imgs });
};
