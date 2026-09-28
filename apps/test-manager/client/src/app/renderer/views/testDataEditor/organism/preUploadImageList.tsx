import RemovableListItem from '@parts/removableListItem';
import type { UploadImageFile } from '@views/testDataEditor/store/useImageDropzoneStore';
import React, { useEffect } from 'react';

export type PreUploadImageListProps = {
  imageFileList: UploadImageFile[];
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const PreUploadImageList = React.memo(
  (props: PreUploadImageListProps) => {
    useEffect(() => {
      console.log('imageFileList changed:', props.imageFileList);
    }, [props.imageFileList]);
    return (
      <div className="flex flex-col gap-2 h-full">
        {props.imageFileList.length > 0 ? (
          props.imageFileList.map(({ id, file }) => {
            return (
              <RemovableListItem
                key={id}
                id={id}
                text={file.name}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  props.onClick(event);
                }}
              />
            );
          })
        ) : (
          <div className="flex pt-12 items-center justify-center">
            選択した画像が表示されます
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.imageFileList === next.imageFileList && prev.onClick === next.onClick,
);

export default PreUploadImageList;
