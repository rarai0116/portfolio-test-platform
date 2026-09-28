import type { GradeId, TestSubject } from '@shared/types/contracts';
import { create } from 'zustand';

export type UploadImageMeta = {
  grade: GradeId;
  subject: TestSubject;
  bigCategoryTag: string;
  smallCategoryTag: string;
};

export type UploadImageFile = {
  id: string;
  file: File;
  filePath: string | null;
  metadata: UploadImageMeta;
};

type ImageDropzoneState = {
  imageFiles: UploadImageFile[];
  addImageFiles: (imageFiles: UploadImageFile[]) => void;
  removeImageFile: (id: string) => void;
};

const useImageDropzoneStore = create<ImageDropzoneState>((set) => ({
  imageFiles: [],
  addImageFiles: (imageFiles) =>
    set((prev) => ({ imageFiles: [...prev.imageFiles, ...imageFiles] })),
  removeImageFile: (id) =>
    set((prev) => ({
      imageFiles: prev.imageFiles.filter((file) => file.id !== id),
    })),
}));

export default useImageDropzoneStore;
