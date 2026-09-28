import type { GradeId, TestSubject } from '@shared/types/contracts';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { useCategoryTagOptions } from '@views/testDataEditor/hooks/useCategoryTagOptions';
import type { ImageItem } from '@views/testDataEditor/hooks/useImageAssetList';
import type { MetaDataUpdate } from '@views/testDataEditor/templates/imageAssetPanel';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';

type Props = {
  id: string;
  item: ImageItem;
  usedIdLabel: string | undefined;
  selectedGrade: GradeId;
  onUpdateMetaData?: (id: string, metadata: MetaDataUpdate) => void;
  onCancelEdit?: () => void;
};

const ImageAssetItemEditor = (props: Props) => {
  const [title, setTitle] = useState(props.item.title ? props.item.title : '');
  const [subject, setSubject] = useState<TestSubject | '未指定'>(
    props.item.subject ? props.item.subject : '未指定',
  );
  const [bigCategory, setBigCategory] = useState(
    props.item.bigCategoryTag ? props.item.bigCategoryTag : '未指定',
  );
  const [smallCategory, setSmallCategory] = useState(
    props.item.smallCategoryTag ? props.item.smallCategoryTag : '未指定',
  );

  // 現在選択中の学科・大分類に対応したカテゴリオプションを取得
  const currentCategoryOptions = useCategoryTagOptions({
    grade: props.selectedGrade,
    subject: subject,
    bigCategoryTag: bigCategory,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <div className="flex w-full h-11 items-center bg-secondary">
          <div className="w-25 ml-2">タイトル</div>
          <Input
            className="flex-1"
            placeholder="タイトルを入力"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex h-11 items-center">
          <div className="w-25 ml-2">級</div>
          <div>{props.item.grade === 'firstGrade' ? '1級' : '2級'}</div>
        </div>
        <div className="flex w-full h-11 items-center bg-secondary">
          <div className="w-25 ml-2">学科</div>
          <Select
            onValueChange={(v) => {
              setSubject(v as TestSubject | '未指定');
              setBigCategory('未指定');
              setSmallCategory('未指定');
            }}
            value={subject || '未指定'}
          >
            <SelectTrigger className="w-25" size="default">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent className="w-25">
              <SelectGroup>
                <SelectItem value="未指定">未指定</SelectItem>
                <SelectItem value="学科Ⅰ">学科Ⅰ</SelectItem>
                <SelectItem value="学科Ⅱ">学科Ⅱ</SelectItem>
                <SelectItem value="学科Ⅲ">学科Ⅲ</SelectItem>
                <SelectItem value="学科Ⅳ">学科Ⅳ</SelectItem>
                <SelectItem value="学科Ⅴ">学科Ⅴ</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full h-11 items-center">
          <div className="flex w-25 ml-2">大分類</div>
          <Select
            onValueChange={(v) => {
              setBigCategory(v);
              setSmallCategory('未指定');
            }}
            value={bigCategory || '未指定'}
          >
            <SelectTrigger className="flex-1" size="default">
              <SelectValue placeholder="" />
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

        <div className="flex w-full h-11 items-center bg-secondary">
          <div className="flex w-25 ml-2">小分類</div>
          <Select
            onValueChange={(v) => setSmallCategory(v)}
            value={smallCategory || '未指定'}
          >
            <SelectTrigger className="flex-1" size="default">
              <SelectValue placeholder="" />
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
        <div className="flex min-h-11 w-full items-center">
          <div className="flex w-25 ml-2">使用箇所</div>
          <div>{props.usedIdLabel ? props.usedIdLabel : '未使用'}</div>
        </div>
        <div className="flex min-h-11 w-full items-center bg-secondary">
          <div className="flex w-25 ml-2">追加日</div>
          <div>
            {props.item.createdAt
              ? new Date(props.item.createdAt.seconds * 1000).toLocaleString()
              : 'ー'}
          </div>
        </div>
        <div className="flex min-h-10 w-full items-center ">
          <div className="flex w-25 ml-2">最終更新日</div>
          <div>
            {props.item.updatedAt
              ? new Date(props.item.updatedAt.seconds * 1000).toLocaleString()
              : 'ー'}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              props.onCancelEdit?.();
              setTitle(props.item.title ? props.item.title : '');
              setSubject(props.item.subject ? props.item.subject : '未指定');
              setBigCategory(
                props.item.bigCategoryTag ? props.item.bigCategoryTag : '',
              );
              setSmallCategory(
                props.item.smallCategoryTag ? props.item.smallCategoryTag : '',
              );
            }}
          >
            キャンセル
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const metadata: MetaDataUpdate = {
                title,
                subject: subject === '未指定' ? undefined : subject,
                bigCategoryTag: bigCategory,
                smallCategoryTag: smallCategory,
                updatedAt: Timestamp.fromMillis(Date.now()),
                tag: [],
              };
              props.onUpdateMetaData?.(props.id, metadata);
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageAssetItemEditor;
