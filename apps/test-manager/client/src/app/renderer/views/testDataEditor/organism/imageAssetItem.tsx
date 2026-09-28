import EditIcon from '@components/icons/editIcon';
import DeleteIcon from '@parts/deleteIcon';
import { Button } from '@ui/button';
import type { ImageItem } from '@views/testDataEditor/hooks/useImageAssetList';
import useShrinkImageObserver from '@views/testDataEditor/hooks/useShrinkImageObserver';
import ImageAssetItemEditor from '@views/testDataEditor/organism/imageAssetItemEditor';
import ImageAsset from '@views/testDataEditor/parts/imageAsset';
import type { MetaDataUpdate } from '@views/testDataEditor/templates/imageAssetPanel';
import React, { useRef, useState } from 'react';

type Props = {
  id: string;
  item: ImageItem;
  listRef: React.RefObject<HTMLDivElement | null>;
  onInsert?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateMetaData?: (id: string, metadata: MetaDataUpdate) => void;
  usedIdLabel?: string;
};

const ImageAssetItem = React.memo(
  (props: Props) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const { width, height } = useShrinkImageObserver({
      width: props.item.width,
      height: props.item.height,
      listRef: props.listRef,
    });

    return (
      <div
        id={props.id}
        ref={itemRef}
        className="w-full flex flex-col py-6 gap-4 border-b"
      >
        <ImageAsset
          id={props.id}
          itemRef={itemRef}
          listRef={props.listRef}
          width={width}
          height={height}
        />
        {isEditing ? (
          <ImageAssetItemEditor
            id={props.id}
            item={props.item}
            usedIdLabel={props.usedIdLabel}
            selectedGrade={props.item.grade}
            onUpdateMetaData={(id, metadata) => {
              props.onUpdateMetaData?.(id, metadata);
              setIsEditing(false);
            }}
            onCancelEdit={() => {
              setIsEditing(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="">
              <div className="flex h-11 w-full items-center bg-secondary">
                <div className="w-25 ml-2">タイトル</div>
                <div>{props.item.title ? props.item.title : '未設定'}</div>
              </div>
              <div className="flex h-11 w-full items-center ">
                <div className="w-25 ml-2">級</div>
                <div>{props.item.grade === 'firstGrade' ? '1級' : '2級'}</div>
              </div>
              <div className="flex h-11 w-full items-center bg-secondary">
                <div className="w-25 ml-2">学科</div>
                <div>{props.item.subject ? props.item.subject : '未設定'}</div>
              </div>
              <div className="flex h-11 w-full items-center">
                <div className="w-25 ml-2">大分類</div>
                <div>
                  {props.item.bigCategoryTag
                    ? props.item.bigCategoryTag
                    : '未設定'}
                </div>
              </div>
              <div className="flex h-11 w-full items-center bg-secondary">
                <div className="w-25 ml-2">小分類</div>
                <div>
                  {props.item.smallCategoryTag
                    ? props.item.smallCategoryTag
                    : '未設定'}
                </div>
              </div>
              <div className="flex min-h-11 w-full items-center ">
                <div className="w-25 ml-2">使用箇所</div>
                <div>{props.usedIdLabel ? props.usedIdLabel : '未使用'}</div>
              </div>
              <div className="flex min-h-11 w-full items-center bg-secondary">
                <div className="flex w-25 ml-2">追加日</div>
                <div>
                  {props.item.createdAt
                    ? new Date(
                        props.item.createdAt.seconds * 1000,
                      ).toLocaleString()
                    : 'ー'}
                </div>
              </div>
              <div className="flex min-h-10 w-full items-center">
                <div className="flex w-25 ml-2">最終更新日</div>
                <div>
                  {props.item.updatedAt
                    ? new Date(
                        props.item.updatedAt.seconds * 1000,
                      ).toLocaleString()
                    : 'ー'}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  console.log('挿入');
                  props.onInsert?.(props.id);
                }}
              >
                挿入
              </Button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="w-8 h-full"
                  onClick={() => {
                    console.log('編集');
                    setIsEditing(true);
                  }}
                >
                  <EditIcon
                    fill="var(--color-icon)"
                    hoverFill="var(--color-icon-hover)"
                    size={30}
                  />
                </button>
                <button
                  type="button"
                  className="w-8 h-full"
                  onClick={() => {
                    console.log('削除');
                    props.onDelete?.(props.id);
                  }}
                >
                  <DeleteIcon
                    fill="var(--color-icon)"
                    hoverFill="var(--color-icon-hover)"
                    size={30}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.item === next.item &&
    prev.onInsert === next.onInsert &&
    prev.onDelete === next.onDelete &&
    prev.onUpdateMetaData === next.onUpdateMetaData &&
    prev.usedIdLabel === next.usedIdLabel,
);

export default ImageAssetItem;
