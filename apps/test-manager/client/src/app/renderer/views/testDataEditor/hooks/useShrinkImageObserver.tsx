import { useEffect, useState } from 'react';

type ShrinkImageObserver = {
  width: number | string;
  height: number | string;
};

type Props = {
  width?: number;
  height?: number;
  listRef: React.RefObject<HTMLDivElement | null>;
};

const useShrinkImageObserver = (props: Props): ShrinkImageObserver => {
  const [listWidth, setListWidth] = useState(0);
  const [size, setSize] = useState<ShrinkImageObserver>({
    width: 0,
    height: 0,
  });

  // パネル幅の監視
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListWidth(entry.contentRect.width);
      }
    });
    if (props.listRef.current) {
      observer.observe(props.listRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // パネル幅 or 画像サイズが変わったら表示サイズを再計算
  useEffect(() => {
    const scaledWidth = props.width ? props.width * 0.2 : 0;
    const scaledHeight = props.height ? props.height * 0.2 : 0;

    if (scaledWidth > listWidth && props.width && props.height) {
      const aspectRatio = props.width / props.height;
      setSize({ width: '100%', height: `${listWidth / aspectRatio}px` });
    } else {
      setSize({ width: `${scaledWidth}px`, height: `${scaledHeight}px` });
    }
  }, [props.width, props.height, listWidth]);

  return size;
};

export default useShrinkImageObserver;
