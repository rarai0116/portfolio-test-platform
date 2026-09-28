import { createUid } from '@api/utils';
import useImageAssetStore, {
  SortOrder,
  type SortOrderType,
} from '@stores/useImageAssetStore';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radioGroup';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { Separator } from '@ui/separator';
import { useCategoryTagOptions } from '@views/testDataEditor/hooks/useCategoryTagOptions';
import {
  type ImageItem,
  kOf,
} from '@views/testDataEditor/hooks/useImageAssetList';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import type { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export const searchImage = {
  unUsed: 'unUsed',
  usedInQuestionList: 'usedInQuestionList',
  detail: 'detail',
} as const;

import type { AssetSubject } from '@views/testDataEditor/organism/imageAssetList';

export type SearchImage = (typeof searchImage)[keyof typeof searchImage];

type Props = {
  imageItems: ImageItem[];
  initialSubject?: AssetSubject;
  initialBigCategory?: string;
  initialSmallCategory?: string;
  onSearchStart?: () => void;
  onSearchComplete?: () => void;
};

const ImageAssetSearch = (props: Props) => {
  const { selectedDataIdList, selectedGrade } = useSelectedIdStore();
  const { sortOrder, setSortOrder, setImageItemKeys } = useImageAssetStore(
    useShallow((s) => {
      return {
        ignoreRequestItemKeys: s.ignoreRequestItemKeys,
        sortOrder: s.sortOrder,
        setSortOrder: s.setSortOrder,
        imageItemKeys: s.imageItemKeys,
        setImageItemKeys: s.setImageItemKeys,
      };
    }),
  );

  const id = useId();
  const usedInDataListId = createUid(id, { prefix: 'usedInDataListId' });
  const unUsedImageId = createUid(id, { prefix: 'unUsedImageId' });
  const detailSearchId = createUid(id, { prefix: 'detailSearchId' });
  const subjectId = createUid(id, { prefix: 'subject' });
  const bigCategoryId = createUid(id, { prefix: 'bigCategory' });
  const smallCategoryId = createUid(id, { prefix: 'smallCategory' });
  const filterSortId = createUid(id, { prefix: 'filterSort' });

  const [searchMode, setSearchMode] = useState<SearchImage>(
    searchImage.usedInQuestionList,
  );
  const [subject, setSubject] = useState<AssetSubject>(
    props.initialSubject ?? '学科Ⅰ',
  );
  const [bigCategory, setBigCategory] = useState(
    props.initialBigCategory ?? 'すべて',
  );
  const [smallCategory, setSmallCategory] = useState(
    props.initialSmallCategory ?? 'すべて',
  );
  const hasAutoSearchedRef = useRef(false);

  const handleChangeSubject = useCallback((value: string) => {
    setSubject(value as AssetSubject);
    setBigCategory('すべて');
    setSmallCategory('すべて');
  }, []);

  const handleChangeBigCategory = useCallback((value: string) => {
    setBigCategory(value);
    setSmallCategory('すべて');
  }, []);

  // 現在選択中の学科・大分類に対応したカテゴリオプションを取得
  const currentCategoryOptions = useCategoryTagOptions({
    grade: selectedGrade,
    subject: subject === 'すべて' ? undefined : subject,
    bigCategoryTag: bigCategory,
    firstOptionLabel: 'すべて',
  });

  //searchModeに応じてフィルタリングされた画像アイテムのキーリストを生成
  const sortedItemList = useCallback(
    (itemList: ImageItem[], sort: SortOrderType) => {
      const getTimestamp = (date: Timestamp) => {
        if (!date) return 0;
        return (
          date.seconds * 1000 + Math.floor((date.nanoseconds || 0) / 1_000_000)
        );
      };

      return itemList.toSorted((a, b) => {
        let aValue = 0;
        let bValue = 0;
        if (
          sort === SortOrder.createdAt_asc ||
          sort === SortOrder.createdAt_desc
        ) {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          aValue = getTimestamp(a.createdAt);
          bValue = getTimestamp(b.createdAt);
        } else {
          if (!a.updatedAt) return 1;
          if (!b.updatedAt) return -1;
          aValue = getTimestamp(a.updatedAt);
          bValue = getTimestamp(b.updatedAt);
        }
        return sort.includes('_asc') ? aValue - bValue : bValue - aValue;
      });
    },
    [],
  );

  const filteredItemListKey = useCallback(
    (itemList: ImageItem[], sort: SortOrderType) => {
      const selectedUsedIdKeySet = new Set(
        selectedDataIdList.map(
          (id) => `${selectedGrade === 'firstGrade' ? '0' : '1'}_${id}`,
        ),
      );
      const sorted = sortedItemList(itemList, sort);

      return sorted
        .filter((it) => {
          if (it.grade !== selectedGrade) return false;
          switch (searchMode) {
            case searchImage.unUsed:
              return (it.usedIds?.length ?? 0) === 0;
            case searchImage.usedInQuestionList:
              return it.usedIds?.some((usedId) =>
                selectedUsedIdKeySet.has(usedId),
              );
            case searchImage.detail:
              return (
                (subject === 'すべて' || it.subject === subject) &&
                (bigCategory === 'すべて' ||
                  it.bigCategoryTag === bigCategory) &&
                (smallCategory === 'すべて' ||
                  it.smallCategoryTag === smallCategory)
              );
            default:
              return true;
          }
        })
        .map((it) => kOf(it));
    },
    [
      selectedGrade,
      subject,
      bigCategory,
      smallCategory,
      sortedItemList,
      searchMode,
      selectedDataIdList,
    ],
  );
  const handleFilterSortItems = useCallback(() => {
    props.onSearchStart?.();
    requestAnimationFrame(() => {
      setImageItemKeys(filteredItemListKey(props.imageItems, sortOrder));
      props.onSearchComplete?.();
    });
  }, [
    filteredItemListKey,
    props.imageItems,
    props.onSearchComplete,
    props.onSearchStart,
    setImageItemKeys,
    sortOrder,
  ]);

  useEffect(() => {
    if (hasAutoSearchedRef.current) return;
    hasAutoSearchedRef.current = true;
    handleFilterSortItems();
  }, [handleFilterSortItems]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col w-full gap-1.5">
        <Label htmlFor={filterSortId} className="flex w-16">
          並び替え
        </Label>
        <Select
          value={sortOrder as string}
          onValueChange={(v) => {
            setSortOrder(v as SortOrderType);
          }}
        >
          <SelectTrigger id={filterSortId} className="flex w-full" size="sm">
            <SelectValue placeholder="並び替え" />
          </SelectTrigger>
          <SelectContent className="min-w-(--radix-select-trigger-width)">
            <SelectGroup>
              <SelectItem value={SortOrder.updatedAt_desc}>
                更新日が新しい順
              </SelectItem>
              <SelectItem value={SortOrder.updatedAt_asc}>
                更新日が古い順
              </SelectItem>
              <SelectItem value={SortOrder.createdAt_desc}>
                追加日が新しい順
              </SelectItem>
              <SelectItem value={SortOrder.createdAt_asc}>
                追加日が古い順
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <RadioGroup
        className="flex flex-col gap-4 pl-1"
        value={searchMode}
        onValueChange={(v) => setSearchMode(v as SearchImage)}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem
            id={usedInDataListId}
            value={searchImage.usedInQuestionList}
          />
          <Label htmlFor={usedInDataListId} className="text-nowrap">
            編集リストで使用中
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem id={unUsedImageId} value={searchImage.unUsed} />
          <Label htmlFor={unUsedImageId} className="text-nowrap">
            未使用
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem id={detailSearchId} value={searchImage.detail} />

          <Label htmlFor={detailSearchId} className="text-nowrap">
            詳細検索
          </Label>
        </div>
      </RadioGroup>

      <div
        className={`flex flex-col  gap-4 ${searchMode === searchImage.detail ? '' : 'opacity-30 pointer-events-none'}`}
      >
        <div className="">{selectedGrade === 'firstGrade' ? '1級' : '2級'}</div>
        <div className="flex flex-col  w-full gap-1.5">
          <Label htmlFor={subjectId} className="flex w-16">
            学科
          </Label>
          <Select value={subject} onValueChange={handleChangeSubject}>
            <SelectTrigger id={subjectId} className="w-25" size="sm">
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
        <div className="flex flex-col  w-full gap-1.5">
          <Label htmlFor={bigCategoryId} className="flex w-16">
            大分類
          </Label>
          <Select value={bigCategory} onValueChange={handleChangeBigCategory}>
            <SelectTrigger id={bigCategoryId} className="flex w-full" size="sm">
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
        <div className="flex flex-col w-full gap-1.5">
          <Label htmlFor={smallCategoryId} className="flex w-16">
            小分類
          </Label>
          <Select
            value={smallCategory}
            onValueChange={(v) => setSmallCategory(v)}
          >
            <SelectTrigger
              id={smallCategoryId}
              className="flex w-full"
              size="sm"
            >
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

      <div className="w-full flex justify-end">
        <Button
          size="md"
          variant="primary"
          onClick={() => {
            handleFilterSortItems();
          }}
        >
          表示
        </Button>
      </div>
    </div>
  );
};

export default ImageAssetSearch;
