import React from 'react';

type Props = {
  tags: string[];
};

const MAX_VISIBLE_TAGS = 2;

const OtherTagsCell = React.memo(({ tags }: Props) => {
  if (tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div
      className="flex h-full items-center gap-1 overflow-hidden"
      title={tags.join(', ')}
    >
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-21 shrink-0 items-center rounded-md bg-demoblue-50 px-2 py-0.5 text-xs text-foreground"
        >
          <span className="truncate">{tag}</span>
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
});

OtherTagsCell.displayName = 'OtherTagsCell';

export default OtherTagsCell;
