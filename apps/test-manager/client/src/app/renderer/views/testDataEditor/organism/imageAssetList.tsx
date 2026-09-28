import type { TestSubject } from '@shared/types/contracts';
import useImageAssetStore from '@stores/useImageAssetStore';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@ui/resizable';
import {
  type ImageItem,
  kOf,
} from '@views/testDataEditor/hooks/useImageAssetList';
import ImageAssetItem from '@views/testDataEditor/organism/imageAssetItem';
import ImageAssetSearch from '@views/testDataEditor/organism/imageAssetSearch';
import type { MetaDataUpdate } from '@views/testDataEditor/templates/imageAssetPanel';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export type AssetSubject = TestSubject | 'すべて';

type Props = {
  listRef: React.RefObject<HTMLDivElement | null>;
  imageItems: ImageItem[];
  onInsertImage?: (id: string) => void;
  onDeleteImage?: (id: string) => void;
  onUpdateMetaData?: (id: string, metadata: MetaDataUpdate) => void;
  formatUsedIdLabel?: (usedId: string) => string;
  searchFormKey: string;
  initialSubject: AssetSubject;
  initialBigCategory: string;
  initialSmallCategory: string;
};

const ImageAssetList = (props: Props) => {
  const { ignoreRequestItemKeys, imageItemKeys } = useImageAssetStore(
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
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const visibleItems = useMemo(
    () =>
      imageItemKeys
        .map((key) => props.imageItems.find((item) => kOf(item) === key))
        .filter((item): item is ImageItem => item !== undefined)
        .filter((item) => !ignoreRequestItemKeys.includes(kOf(item))),
    [ignoreRequestItemKeys, imageItemKeys, props.imageItems],
  );

  return (
    <div className="bg-background flex w-full h-full min-h-full ">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          defaultSize={30}
          minSize={200}
          className="border-r flex flex-col px-1"
        >
          <ImageAssetSearch
            key={props.searchFormKey}
            imageItems={props.imageItems}
            initialSubject={props.initialSubject}
            initialBigCategory={props.initialBigCategory}
            initialSmallCategory={props.initialSmallCategory}
            onSearchStart={() => {
              setIsSearching(true);
              setHasSearched(true);
            }}
            onSearchComplete={() => {
              setIsSearching(false);
            }}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={70}
          minSize={200}
          className="flex flex-col"
        >
          <div
            ref={props.listRef}
            className="w-full overflow-y-scroll h-full px-6"
          >
            {isSearching ? (
              <div className="py-8 text-center text-foreground">検索中...</div>
            ) : visibleItems.length > 0 ? (
              visibleItems.map((it) => {
                const id = kOf(it);
                const usedIdLabel = it.usedIds
                  ?.map((usedId) =>
                    props.formatUsedIdLabel
                      ? props.formatUsedIdLabel(usedId)
                      : usedId,
                  )
                  .join(', ');
                return (
                  <ImageAssetItem
                    key={id}
                    id={id}
                    item={it}
                    listRef={props.listRef}
                    onInsert={props.onInsertImage}
                    onDelete={props.onDeleteImage}
                    onUpdateMetaData={props.onUpdateMetaData}
                    usedIdLabel={usedIdLabel}
                  />
                );
              })
            ) : hasSearched ? (
              <div className="py-8 text-center text-foreground text-sm">
                条件の画像が見つかりませんでした
              </div>
            ) : (
              <div className="text-center text-foreground"></div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default ImageAssetList;
