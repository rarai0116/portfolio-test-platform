import { randomId } from '@hooks/useFirestoreHandler';
import BasicDialog from '@parts/basicDialog';
import BasicTabs from '@parts/basicTabs';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { AssetData, GradeId } from '@shared/types/contracts';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import useImageAssetObserver from '@views/testDataEditor/hooks/useImageAssetObserver';
import useUsedIdLabelResolver from '@views/testDataEditor/hooks/useUsedIdLabelResolver';
import ImageAssetList from '@views/testDataEditor/organism/imageAssetList';
import ImageUpload from '@views/testDataEditor/organism/imageUpload';
import useImageDropzoneStore, {
  type UploadImageMeta,
} from '@views/testDataEditor/store/useImageDropzoneStore';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export type MetaDataUpdate = Pick<
  AssetData,
  | 'subject'
  | 'bigCategoryTag'
  | 'smallCategoryTag'
  | 'title'
  | 'tag'
  | 'usedIds'
  | 'updatedAt'
>;

type UploadErrorItem = {
  fileName: string;
  message: string;
};

const isAbsolutePath = (value: string | null | undefined): value is string => {
  if (!value) return false;

  return (
    value.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith('\\\\')
  );
};

const DEFAULT_SUBJECT = '学科Ⅰ';
const DEFAULT_UPLOAD_CATEGORY = '未指定';
const DEFAULT_SEARCH_CATEGORY = 'すべて';

const normalizeMeta = (
  partial: Partial<
    Pick<UploadImageMeta, 'subject' | 'bigCategoryTag' | 'smallCategoryTag'>
  >,
  categoryFallback: string,
): Pick<UploadImageMeta, 'subject' | 'bigCategoryTag' | 'smallCategoryTag'> => {
  return {
    subject: partial.subject || DEFAULT_SUBJECT,
    bigCategoryTag: partial.bigCategoryTag?.trim() || categoryFallback,
    smallCategoryTag: partial.smallCategoryTag?.trim() || categoryFallback,
  };
};

const ImageAssetPanel = () => {
  const { imageItems, imageItemKeys, setIgnoreRequestItemKeys } =
    useImageAssetStore(
      useShallow((s) => ({
        imageItems: s.imageItems,
        imageItemKeys: s.imageItemKeys,
        setIgnoreRequestItemKeys: s.setIgnoreRequestItemKeys,
      })),
    );
  // T47: imagesStateMap の書き込み先はインフラ層 useAssetCacheStore
  const { setImagesStateMap } = useAssetCacheStore();
  const { listRef } = useImageAssetObserver({ imageItems });
  const { selectedGrade, selectedDataId } = useSelectedIdStore();
  const { editMap } = useTestDataStore();
  const { run } = useGlobalLoading();
  const { formatUsedIdLabel } = useUsedIdLabelResolver({
    imageItems,
    imageItemKeys,
    editMap,
  });

  // 画像挿入ハンドラ
  const handleInsert = useCallback(async (id: string) => {
    const [grade, key] = id.split('/') as [GradeId, string];
    console.log('画像挿入', { grade, key });
    // main 経由で QuestionEditorPanel へ配信 → Editor に挿入
    window.editor
      ?.insertImage({ grade, key })
      .catch((e) => console.error('insertImage error', e));
  }, []);

  // メタデータ更新ハンドラ
  const handleUpdateMetaData = useCallback(
    async (id: string, metadata: MetaDataUpdate) => {
      const [grade, key] = id.split('/') as [GradeId, string];
      const fullPath = `storageList/${grade}/images/${key}`;
      const mutationId = randomId();

      try {
        const res = await window.fs.mutate({
          mutationId,
          kind: 'update',
          path: fullPath,
          data: metadata,
        });
        console.log('メタデータ更新成功:', res);
        return res;
      } catch (e) {
        console.error('メタデータ更新失敗:', e);
        throw e;
      }
    },
    [],
  );

  // 削除ダイアログの状態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 削除リクエスト（一覧からのクリックを受けてダイアログを開く）
  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  }, []);
  //　削除確定（IPC: window.assets.delete）
  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    const [grade, key] = deleteTargetId.split('/') as [GradeId, string];
    setDeleting(true);
    try {
      const res = await window.assets.delete({ grade, key });
      if (!res?.ok) {
        console.error('delete error', res?.error);
        return;
      }
      console.log('削除成功:', deleteTargetId);

      // ローカル表示を即時反映（Firestore購読反映までの間の暫定非表示）
      setIgnoreRequestItemKeys((prev) => [...prev, deleteTargetId]);
      setImagesStateMap((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
    } catch (e) {
      console.error('削除例外:', e);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, setIgnoreRequestItemKeys, setImagesStateMap]);

  // キャンセル
  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  }, []);

  // アップロード関連
  const { imageFiles, removeImageFile } = useImageDropzoneStore();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErrorDialogOpen, setUploadErrorDialogOpen] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<UploadErrorItem[]>([]);

  const selectedData = selectedDataId
    ? editMap[selectedDataId]?.data
    : undefined;

  const selectedMetaSource = useMemo(
    () => ({
      subject:
        typeof selectedData?.subject === 'string'
          ? selectedData.subject
          : undefined,
      bigCategoryTag:
        typeof selectedData?.bigCategoryTag === 'string'
          ? selectedData.bigCategoryTag
          : undefined,
      smallCategoryTag:
        typeof selectedData?.smallCategoryTag === 'string'
          ? selectedData.smallCategoryTag
          : undefined,
    }),
    [selectedData],
  );

  const uploadDefaults = useMemo(() => {
    const normalized = normalizeMeta(
      selectedMetaSource,
      DEFAULT_UPLOAD_CATEGORY,
    );

    return {
      grade: selectedGrade,
      ...normalized,
    } satisfies UploadImageMeta;
  }, [selectedGrade, selectedMetaSource]);

  const searchDefaults = useMemo(
    () => normalizeMeta(selectedMetaSource, DEFAULT_SEARCH_CATEGORY),
    [selectedMetaSource],
  );

  const searchFormKey = useMemo(() => {
    return [
      selectedDataId ?? 'none',
      selectedGrade,
      searchDefaults.subject,
      searchDefaults.bigCategoryTag,
      searchDefaults.smallCategoryTag,
    ].join(':');
  }, [selectedDataId, searchDefaults, selectedGrade]);

  const uploadFormKey = useMemo(() => {
    return [
      selectedDataId ?? 'none',
      uploadDefaults.grade,
      uploadDefaults.subject,
      uploadDefaults.bigCategoryTag,
      uploadDefaults.smallCategoryTag,
    ].join(':');
  }, [selectedDataId, uploadDefaults]);

  // ダイアログ文言用
  const uploadSummary = useMemo(() => {
    const count = imageFiles.length;
    return count
      ? `対象: ${count}件\n級: ${selectedGrade === 'firstGrade' ? '1級' : '2級'}\n実行しますか？`
      : 'アップロード対象のファイルがありません。';
  }, [imageFiles.length, selectedGrade]);

  const handleOpenUploadDialog = useCallback(() => {
    if (imageFiles.length === 0) return;
    setUploadDialogOpen(true);
  }, [imageFiles.length]);

  const formatUploadError = useCallback((errors: UploadErrorItem[]) => {
    return errors
      .map((error) => `・${error.fileName}: ${error.message}`)
      .join('\n');
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!imageFiles.length) return;

    setUploading(true);
    setUploadErrors([]);

    try {
      const failures: UploadErrorItem[] = [];

      await run(async () => {
        for (const {
          id,
          file,
          filePath: storedFilePath,
          metadata,
        } of imageFiles) {
          const resolvedFilePath = window.webUtils.getPathForFile(file);
          const filePath = isAbsolutePath(resolvedFilePath)
            ? resolvedFilePath
            : isAbsolutePath(storedFilePath)
              ? storedFilePath
              : null;

          let res:
            | Awaited<ReturnType<typeof window.assets.upload>>
            | Awaited<ReturnType<typeof window.assets.uploadBuffer>>;

          if (filePath) {
            res = await window.assets.upload(filePath, metadata.grade);
          } else {
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              res = await window.assets.uploadBuffer(
                file.name,
                bytes,
                metadata.grade,
                file.type || 'image/png',
              );
            } catch (e) {
              const message =
                e instanceof Error
                  ? e.message
                  : 'ファイルの読み込みに失敗しました';
              failures.push({
                fileName: file.name,
                message,
              });
              continue;
            }
          }

          console.log('アップロード結果:', file.name, res);

          if (res?.ok) {
            const normalizedMeta = normalizeMeta(
              metadata,
              DEFAULT_UPLOAD_CATEGORY,
            );
            const fullPath = `storageList/${res.grade}/images/${res.key}`;
            const mutationId = randomId();

            try {
              await window.fs.mutate({
                mutationId,
                kind: 'update',
                path: fullPath,
                data: {
                  grade: res.grade,
                  subject: normalizedMeta.subject,
                  bigCategoryTag: normalizedMeta.bigCategoryTag,
                  smallCategoryTag: normalizedMeta.smallCategoryTag,
                  tag: res.data?.tag ?? [],
                } as MetaDataUpdate,
              });

              removeImageFile(id);

              window.editor
                ?.insertImage({ grade: res.grade, key: res.key })
                .catch((e) => console.error('insertImage error', e));
            } catch (e) {
              const message =
                e instanceof Error ? e.message : 'メタデータ更新に失敗しました';
              console.error(
                'アップロード後のメタデータ更新失敗:',
                file.name,
                e,
              );
              failures.push({
                fileName: file.name,
                message,
              });
            }
          } else {
            console.error('アップロード失敗:', file.name, res?.error);
            failures.push({
              fileName: file.name,
              message: res?.error ?? 'アップロードに失敗しました',
            });
          }
        }
      }, '画像をアップロード中…');

      if (failures.length > 0) {
        setUploadErrors(failures);
        setUploadErrorDialogOpen(true);
      }
    } catch (e) {
      console.error('アップロード/更新例外:', e);
      setUploadErrors([
        {
          fileName: '不明なファイル',
          message:
            e instanceof Error ? e.message : 'アップロード処理に失敗しました',
        },
      ]);
      setUploadErrorDialogOpen(true);
    } finally {
      setUploading(false);
      setUploadDialogOpen(false);
    }
  }, [imageFiles, removeImageFile, run]);

  return (
    <>
      <BasicTabs
        tabs={[
          {
            id: 'imageListTab',
            label: '一覧',
            content: (
              <ImageAssetList
                listRef={listRef}
                imageItems={imageItems}
                onInsertImage={handleInsert}
                onDeleteImage={handleDeleteRequest}
                onUpdateMetaData={handleUpdateMetaData}
                formatUsedIdLabel={formatUsedIdLabel}
                searchFormKey={searchFormKey}
                initialSubject={searchDefaults.subject}
                initialBigCategory={searchDefaults.bigCategoryTag}
                initialSmallCategory={searchDefaults.smallCategoryTag}
              />
            ),
          },
          {
            id: 'imageUploadTab',
            label: 'アップロード',
            content: (
              <ImageUpload
                key={uploadFormKey}
                selectedGrade={selectedGrade}
                initialSubject={uploadDefaults.subject}
                initialBigCategory={uploadDefaults.bigCategoryTag}
                initialSmallCategory={uploadDefaults.smallCategoryTag}
                onClickUpload={handleOpenUploadDialog}
                isUploading={uploading}
              />
            ),
          },
        ]}
      />
      <BasicDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="画像を削除しますか？"
        description={
          deleteTargetId
            ? `対象: ${deleteTargetId}\nこの操作は元に戻せません。`
            : undefined
        }
        primaryButtonText={deleting ? '削除中…' : '削除する'}
        onClickPrimaryButton={deleting ? undefined : confirmDelete}
        secondaryButtonText="キャンセル"
        onClickSecondaryButton={cancelDelete}
      />
      <BasicDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        title="画像をアップロードしますか？"
        description={uploadSummary}
        primaryButtonText={uploading ? 'アップロード中…' : 'アップロードする'}
        onClickPrimaryButton={uploading ? undefined : confirmUpload}
        secondaryButtonText="キャンセル"
        onClickSecondaryButton={() => setUploadDialogOpen(false)}
      />
      <BasicDialog
        open={uploadErrorDialogOpen}
        onOpenChange={setUploadErrorDialogOpen}
        title="画像アップロードに失敗しました"
        description={formatUploadError(uploadErrors)}
        primaryButtonText="OK"
        onClickPrimaryButton={() => setUploadErrorDialogOpen(false)}
      />
    </>
  );
};

export default ImageAssetPanel;
