import UploadIcon from '@assets/upload.svg';
import type { GradeId, TestSubject } from '@shared/types/contracts';
import { Button } from '@ui/button';
import useImageDropzoneStore from '@views/testDataEditor/store/useImageDropzoneStore';
import { useCallback } from 'react';
import { type DropEvent, useDropzone } from 'react-dropzone';

type FileWithOptionalPath = File & {
  path?: string;
};

const isAbsolutePath = (value: string | null | undefined): value is string => {
  if (!value) return false;

  return (
    value.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith('\\\\')
  );
};

const isSameFile = (left: File, right: File): boolean => {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.type === right.type &&
    left.lastModified === right.lastModified
  );
};

const getEventFiles = (event?: DropEvent): File[] => {
  if (!event) return [];

  if ('dataTransfer' in event && event.dataTransfer?.files) {
    return Array.from(event.dataTransfer.files);
  }

  if ('target' in event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files) {
      return Array.from(target.files);
    }
  }

  return [];
};

const resolveFilePath = (file: File): string | null => {
  const fileWithPath = file as FileWithOptionalPath;
  const resolvedFilePath = window.webUtils.getPathForFile(file);
  if (isAbsolutePath(resolvedFilePath)) {
    return resolvedFilePath;
  }

  return isAbsolutePath(fileWithPath.path) ? fileWithPath.path : null;
};

export type BasicDropzoneProps = {
  metadata: {
    grade: GradeId;
    subject: TestSubject;
    bigCategoryTag: string;
    smallCategoryTag: string;
  };
};

const BasicDropzone = ({ metadata }: BasicDropzoneProps) => {
  const { addImageFiles } = useImageDropzoneStore();

  const onDrop = useCallback(
    (acceptedFiles: File[], _fileRejections: unknown[], event?: DropEvent) => {
      const sourceFiles = getEventFiles(event);

      addImageFiles(
        acceptedFiles.map((file) => {
          const sourceFile = sourceFiles.find((candidate) =>
            isSameFile(candidate, file),
          );
          const nativeFile = sourceFile ?? file;
          const nativeFilePath = resolveFilePath(nativeFile);
          const acceptedFilePath = resolveFilePath(file);

          return {
            id: crypto.randomUUID(),
            file: nativeFile,
            filePath: nativeFilePath ?? acceptedFilePath,
            metadata,
          };
        }),
      );
    },
    [addImageFiles, metadata],
  );

  const { getRootProps, getInputProps, open, fileRejections } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    accept: {
      'image/png': ['.png'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className="flex w-full justify-center border-2 border-dashed border-demoblue-200 
      bg-demoblue-50 p-6 rounded-[20px]"
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <img src={UploadIcon} alt="画像アップロード" width={30} height={30} />
        <div className="text-center ">
          <p>画像をドラッグ＆ドロップ</p>
          <div className="flex justify-center gap-1">
            <p className="text-sm">または選択してください [ 対応画像: png ]</p>
          </div>
        </div>

        <Button variant="outline" onClick={open}>
          画像を選択
        </Button>
        {fileRejections.length > 0 && (
          <p className="text-sm text-error-text">対応していない形式です</p>
        )}
      </div>
    </div>
  );
};

export default BasicDropzone;
