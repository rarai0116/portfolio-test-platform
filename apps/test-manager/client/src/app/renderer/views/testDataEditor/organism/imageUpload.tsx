import type { GradeId, TestSubject } from '@shared/types/contracts';
import { Button } from '@ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { useCategoryTagOptions } from '@views/testDataEditor/hooks/useCategoryTagOptions';
import BasicDropzone from '@views/testDataEditor/organism/imageDropzone';
import PreUploadImageList from '@views/testDataEditor/organism/preUploadImageList';
import useImageDropzoneStore from '@views/testDataEditor/store/useImageDropzoneStore';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export type ImageUploadProps = {
  selectedGrade: GradeId;
  initialSubject: TestSubject;
  initialBigCategory: string;
  initialSmallCategory: string;
  onClickUpload: () => void;
  isUploading?: boolean;
};

const ImageUpload = (props: ImageUploadProps) => {
  const { imageFiles, removeImageFile } = useImageDropzoneStore(
    useShallow((s) => ({
      imageFiles: s.imageFiles,
      removeImageFile: s.removeImageFile,
    })),
  );
  const [selectedSubject, setSelectedSubject] = useState<TestSubject>(
    props.initialSubject,
  );
  const [selectedBigCategory, setSelectedBigCategory] = useState(
    props.initialBigCategory,
  );
  const [selectedSmallCategory, setSelectedSmallCategory] = useState(
    props.initialSmallCategory,
  );

  const handleChangeSubject = useCallback((value: string) => {
    setSelectedSubject(value as TestSubject);
    setSelectedBigCategory('未指定');
    setSelectedSmallCategory('未指定');
  }, []);

  const handleChangeBigCategory = useCallback((value: string) => {
    setSelectedBigCategory(value);
    setSelectedSmallCategory('未指定');
  }, []);

  //アップロード用のカテゴリオプションを取得
  const currentCategoryOptions = useCategoryTagOptions({
    grade: props.selectedGrade,
    subject: selectedSubject,
    bigCategoryTag: selectedBigCategory,
  });

  const disabled = useMemo(
    () =>
      props.isUploading ||
      imageFiles.length === 0 ||
      !props.selectedGrade ||
      !selectedSubject ||
      !selectedBigCategory ||
      !selectedSmallCategory,
    [
      props.isUploading,
      imageFiles.length,
      props.selectedGrade,
      selectedSubject,
      selectedBigCategory,
      selectedSmallCategory,
    ],
  );

  return (
    <div className="bg-background h-full w-full flex-1 p-6 flex flex-col gap-6">
      <div className="flex w-full">
        <BasicDropzone
          metadata={{
            grade: props.selectedGrade,
            subject: selectedSubject,
            bigCategoryTag: selectedBigCategory,
            smallCategoryTag: selectedSmallCategory,
          }}
        />
      </div>

      <div className="flex w-full h-full">
        <div className="flex flex-col w-1/2 h-full text-sm border-r border-border overflow-y-scroll">
          <PreUploadImageList
            imageFileList={imageFiles}
            onClick={(event) => {
              removeImageFile(event.currentTarget.id);
            }}
          />
        </div>
        <div className="flex flex-col w-1/2 h-full justify-between pl-6">
          <div className="flex flex-col  gap-3">
            <div className="flex w-full h-11 items-center gap-1">
              <div className="flex w-16" />
              <div className="text-sm ml-2">
                {props.selectedGrade === 'firstGrade' ? '1級' : '2級'}
              </div>
            </div>
            <div className="flex w-full h-11 items-center gap-1">
              <div className="flex w-16 text-sm text-nowrap">学科</div>
              <Select
                value={selectedSubject}
                onValueChange={handleChangeSubject}
              >
                <SelectTrigger className="w-25">
                  <SelectValue placeholder="選択して下さい" />
                </SelectTrigger>
                <SelectContent className="w-25">
                  <SelectGroup>
                    <SelectItem value="学科Ⅰ">学科Ⅰ</SelectItem>
                    <SelectItem value="学科Ⅱ">学科Ⅱ</SelectItem>
                    <SelectItem value="学科Ⅲ">学科Ⅲ</SelectItem>
                    <SelectItem value="学科Ⅳ">学科Ⅳ</SelectItem>
                    <SelectItem value="学科Ⅴ">学科Ⅴ</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full h-11 items-center gap-1">
              <div className="flex w-16 text-sm text-nowrap">大分類</div>
              <Select
                value={selectedBigCategory}
                onValueChange={handleChangeBigCategory}
              >
                <SelectTrigger className="flex flex-1">
                  <SelectValue placeholder="大分類を選択" />
                </SelectTrigger>
                <SelectContent className="min-w-(--radix-select-trigger-width)">
                  <SelectGroup>
                    {currentCategoryOptions.bigOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full h-11 items-center gap-1">
              <div className="flex w-16 text-sm text-nowrap">小分類</div>
              <Select
                value={selectedSmallCategory}
                onValueChange={setSelectedSmallCategory}
              >
                <SelectTrigger className="flex flex-1">
                  <SelectValue placeholder="小分類を選択" />
                </SelectTrigger>
                <SelectContent className="min-w-(--radix-select-trigger-width)">
                  <SelectGroup>
                    {currentCategoryOptions.smallOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={props.onClickUpload} disabled={disabled}>
              {props.isUploading ? 'アップロード中…' : 'アップロード'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;
