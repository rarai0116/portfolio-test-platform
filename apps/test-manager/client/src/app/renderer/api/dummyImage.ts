export const DUMMY_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAFUlEQVQImWNctWrVfwYoYGJAAigcAG0vAwOxuwZnAAAAAElFTkSuQmCC';

// 問題エディタで未取得画像の位置を保つ既存のダミー画像。
export const EDITOR_DUMMY_IMG =
  'data:image/gif;base64,R0lGODlhEAAQAPAAAAAAAP///yH5BAEAAAAALAAAAAAQABAAAAIhjI+py+0Po5y02ouz3pwXADs=';

export const isKnownDummyImageUrl = (value: string): boolean =>
  value === DUMMY_IMG || value === EDITOR_DUMMY_IMG;
