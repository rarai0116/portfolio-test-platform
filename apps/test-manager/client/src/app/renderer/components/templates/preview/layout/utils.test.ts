import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  CalculateNodeHeighter,
  extractOrWrapParagraph,
  hasLoadableImageSource,
  IMAGE_READY_TIMEOUT_MS,
  normalizeInactiveFloatImages,
  searchFloatImage,
} from './utils';

describe('extractOrWrapParagraph の段落正規化', () => {
  it('先頭の孤立テキストだけを top-level 付き段落に包み、後続の空段落は維持する', () => {
    const block = extractOrWrapParagraph(
      '色光の加法混色では、赤(R)緑(G)、青(B)を同じ割合で混色すると、白色になる。<p></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].classList.contains('top-level')).toBe(true);
    expect(paragraphs[0].textContent).toBe(
      '色光の加法混色では、赤(R)緑(G)、青(B)を同じ割合で混色すると、白色になる。',
    );
    expect(paragraphs[1].classList.contains('top-level')).toBe(false);
    expect(paragraphs[1].innerHTML).toBe('');
  });

  it('既存の改行用空段落は落とさず、先頭段落だけに top-level を付ける', () => {
    const block = extractOrWrapParagraph('<p>本文</p><p><br></p>', document);

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].classList.contains('top-level')).toBe(true);
    expect(paragraphs[0].textContent).toBe('本文');
    expect(paragraphs[1].classList.contains('top-level')).toBe(false);
    // 改行用の空段落は落とさず保持する。現行のページ分割正規化では
    // <br> は全角空白のプレースホルダに置換される。
    expect(paragraphs[1].textContent).toBe('　');
  });

  it('先頭の text と span をまとめて段落化し、後続の既存 p には top-level を付けない', () => {
    const block = extractOrWrapParagraph(
      '前置き<span>補足</span><p>既存段落</p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].classList.contains('top-level')).toBe(true);
    expect(paragraphs[0].textContent).toBe('前置き補足');
    expect(paragraphs[0].querySelector('span')?.textContent).toBe('補足');
    expect(paragraphs[1].classList.contains('top-level')).toBe(false);
    expect(paragraphs[1].textContent).toBe('既存段落');
  });

  it('通常画像の直後に float 画像がある段落は、pagination 用に float 画像を先にする', () => {
    const block = extractOrWrapParagraph(
      '<p>本文</p><p><img alt="normal" style=""><img alt="float" style="display: inline; float: right; margin: 0 0 1em 1em;"></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0].textContent).toBe('本文');
    expect(paragraphs[1].querySelector('img')?.alt).toBe('float');
    expect(paragraphs[2].querySelector('img')?.alt).toBe('normal');
  });

  it('テキストの後に float 画像がある段落は、pagination 用に float 画像を先にする', () => {
    const block = extractOrWrapParagraph(
      '<p>説明<img alt="float" style="display: inline; float: right;"></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('img')?.alt).toBe('float');
    expect(paragraphs[1].textContent).toBe('説明');
  });

  it('テキストと float 画像の間に通常画像があっても、float 画像を先にする', () => {
    const block = extractOrWrapParagraph(
      '<p>説明<img alt="normal"><img alt="float" style="display: inline; float: left;"></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('img')?.alt).toBe('float');
    expect(paragraphs[1].textContent).toBe('説明');
    expect(paragraphs[1].querySelector('img')?.alt).toBe('normal');
  });

  it('<br> を含む段落は入れ替えず、テキストを先頭のまま保つ', () => {
    const block = extractOrWrapParagraph(
      '<p>行1<br>行2<img alt="float" style="display: inline; float: left;"></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs.map((p) => p.textContent)).toEqual(['行1', '行2', '']);
    expect(paragraphs[2].querySelector('img')?.alt).toBe('float');
  });

  it('段落をまたぐ「テキスト段落 -> float画像段落」は入れ替えない', () => {
    const block = extractOrWrapParagraph(
      '<p>本文1</p><p><img alt="float" style="display: inline; float: left;">本文2</p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0].textContent).toBe('本文1');
    expect(paragraphs[1].querySelector('img')?.alt).toBe('float');
    expect(paragraphs[2].textContent).toBe('本文2');
  });

  it('入れ替えが起きても float 画像の width、height、margin、src を変更しない', () => {
    const block = extractOrWrapParagraph(
      '<p>説明<img alt="float" width="200" height="100" src="dummy.png"' +
        ' style="display: inline; float: left; margin: 0px 0px 1em 1em;"></p>',
      document,
    );

    const img = block.querySelector('img');
    expect(img?.getAttribute('width')).toBe('200');
    expect(img?.getAttribute('height')).toBe('100');
    expect(img?.getAttribute('src')).toBe('dummy.png');
    expect(img?.style.marginLeft).toBe('1em');
    expect(img?.style.float).toBe('left');
  });

  it('選択肢で入れ替えが起きた場合、選択肢番号は先頭のfloat画像段落に付く', () => {
    // 選択肢配置は extractOrWrapParagraph の戻り値の先頭 <p> へ番号を prepend する
    const block = extractOrWrapParagraph(
      '<p>選択肢テキスト<img alt="float" style="display: inline; float: left;"></p>',
      document,
    );

    const paragraphs = Array.from(block.querySelectorAll('p'));
    const head = paragraphs[0];
    head.innerHTML = `<span class="choice-index-mark">1．</span>${head.innerHTML}`;

    expect(head.querySelector('.choice-index-mark')?.textContent).toBe('1．');
    expect(head.querySelector('img')?.alt).toBe('float');
    expect(paragraphs[1].textContent).toBe('選択肢テキスト');
  });
});

type RectInput = { top: number; left: number; width: number; height: number };

const toRect = ({ top, left, width, height }: RectInput): DOMRect =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const ZERO_RECT = toRect({ top: 0, left: 0, width: 0, height: 0 });

// jsdom はレイアウト計算をしないため、矩形は Node をキーにしたテーブルから解決する。
const rectByNode = new Map<Node, DOMRect[]>();
// 矩形取得の例外を再現する対象。
const throwingNodes = new Set<Node>();

const setRects = (node: Node, rects: RectInput[]) => {
  rectByNode.set(node, rects.map(toRect));
};

const setRect = (node: Node, rect: RectInput) => {
  setRects(node, [rect]);
};

const query = (root: ParentNode, selector: string): HTMLElement => {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`要素が見つかりません: ${selector}`);
  return element;
};

const firstTextNode = (element: Element): Text => {
  const node = element.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) {
    throw new Error('テキストノードが見つかりません');
  }
  return node as Text;
};

const mount = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

describe('normalizeInactiveFloatImages の実回り込み判定', () => {
  let originalGetClientRects: PropertyDescriptor | undefined;

  beforeAll(() => {
    // jsdom 26.1.0 では Range.prototype.getClientRects が未定義で spyOn できないため、
    // このsuite内だけダミーを定義しておく。setupTests へグローバルpolyfillは足さない。
    originalGetClientRects = Object.getOwnPropertyDescriptor(
      Range.prototype,
      'getClientRects',
    );
    if (!originalGetClientRects) {
      Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        writable: true,
        value: () => [],
      });
    }
  });

  afterAll(() => {
    if (originalGetClientRects) {
      Object.defineProperty(
        Range.prototype,
        'getClientRects',
        originalGetClientRects,
      );
      return;
    }
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
  });

  beforeEach(() => {
    rectByNode.clear();
    throwingNodes.clear();
    document.body.innerHTML = '';

    // svg は HTMLElement ではないため Element.prototype 側をスタブする。
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        if (throwingNodes.has(this)) throw new Error('rect unavailable');
        return rectByNode.get(this)?.[0] ?? ZERO_RECT;
      },
    );

    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (
      this: Range,
    ) {
      const container = this.startContainer;
      if (throwingNodes.has(container)) throw new Error('rects unavailable');
      return (rectByNode.get(container) ?? []) as unknown as DOMRectList;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('left float画像の右側に後続テキスト行がある場合、floatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">回り込む文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });

    const result = normalizeInactiveFloatImages(scope);

    expect(result).toEqual({
      changed: false,
      normalizedCount: 0,
      remainingFloatCount: 1,
      aborted: false,
    });
    expect(img.style.float).toBe('left');
  });

  it('right float画像の左側に後続テキスト行がある場合、floatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:right"></p><p id="t">回り込む文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 400, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 0,
      width: 380,
      height: 20,
    });

    const result = normalizeInactiveFloatImages(scope);

    expect(result.changed).toBe(false);
    expect(result.remainingFloatCount).toBe(1);
    expect(img.style.float).toBe('right');
  });

  it('後続テキストが画像より下にしかない場合、floatを解除する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">下の文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 210,
      left: 0,
      width: 300,
      height: 20,
    });

    const result = normalizeInactiveFloatImages(scope);

    expect(result).toEqual({
      changed: true,
      normalizedCount: 1,
      remainingFloatCount: 0,
      aborted: false,
    });
    expect(img.style.float).toBe('');
  });

  it('後続要素が存在しない場合、floatを解除する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });

    expect(normalizeInactiveFloatImages(scope).normalizedCount).toBe(1);
    expect(img.style.float).toBe('');
  });

  it('float画像の横に後続画像がある場合、先行画像のfloatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p><img id="n"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 200, height: 200 });
    setRect(query(host, '#n'), { top: 0, left: 200, width: 200, height: 200 });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(false);
    expect(img.style.float).toBe('left');
  });

  it('後続画像が下にある場合、横配置とは判定しない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p><img id="n"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 200, height: 200 });
    setRect(query(host, '#n'), { top: 210, left: 0, width: 200, height: 200 });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('画像より前の文章は回り込み要素として数えない', () => {
    const host = mount(
      `<div id="q"><p id="before">前の本文</p><p><img id="f" style="display:inline;float:left"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 100, left: 0, width: 100, height: 200 });
    // 画像と縦に重なり横にも並ぶ位置だが、DOM順で前なので対象外
    setRect(firstTextNode(query(host, '#before')), {
      top: 110,
      left: 110,
      width: 60,
      height: 20,
    });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('次の問題wrapper内の要素は対象にしない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p></div>` +
        `<div id="q2"><p id="t">次の問題の文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('画像矩形が0の場合、floatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');

    const result = normalizeInactiveFloatImages(scope);

    expect(result).toEqual({
      changed: false,
      normalizedCount: 0,
      remainingFloatCount: 1,
      aborted: false,
    });
    expect(img.style.float).toBe('left');
  });

  it('複数floatの一部解除後に再判定し、固定点へ到達する', () => {
    const host = mount(
      `<div id="q"><p><img id="a" style="display:inline;float:left"></p>` +
        `<p><img id="b" style="display:inline;float:left"></p>` +
        `<p id="t">Bの横に回り込む文章</p></div>`,
    );
    const scope = query(host, '#q');
    const imgA = query(host, '#a');
    const imgB = query(host, '#b');
    // Aの横には何も無い。Bの横にはテキストがある。
    setRect(imgA, { top: 0, left: 0, width: 100, height: 100 });
    setRect(imgB, { top: 200, left: 0, width: 100, height: 100 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 210,
      left: 110,
      width: 60,
      height: 20,
    });

    const first = normalizeInactiveFloatImages(scope);
    expect(first).toEqual({
      changed: true,
      normalizedCount: 1,
      remainingFloatCount: 1,
      aborted: false,
    });
    expect(imgA.style.float).toBe('');
    expect(imgB.style.float).toBe('left');

    const second = normalizeInactiveFloatImages(scope);
    expect(second).toEqual({
      changed: false,
      normalizedCount: 0,
      remainingFloatCount: 1,
      aborted: false,
    });
  });

  it('float解除時に width、height、margin、srcを変更しない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" width="200" height="100" src="dummy.png"` +
        ` style="display:inline;float:left;margin:0 0 1em 1em"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f') as HTMLImageElement;
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });

    normalizeInactiveFloatImages(scope);

    expect(img.style.float).toBe('');
    expect(img.getAttribute('width')).toBe('200');
    expect(img.getAttribute('height')).toBe('100');
    expect(img.getAttribute('src')).toBe('dummy.png');
    expect(img.style.marginLeft).toBe('1em');
    expect(img.style.display).toBe('inline');
  });

  it('右左判定の境界で 0.5px の許容誤差を適用する', () => {
    const build = (textLeft: number) => {
      document.body.innerHTML = '';
      rectByNode.clear();
      const host = mount(
        `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">文章</p></div>`,
      );
      const scope = query(host, '#q');
      const img = query(host, '#f');
      setRect(img, { top: 0, left: 0, width: 100, height: 100 });
      setRect(firstTextNode(query(host, '#t')), {
        top: 10,
        left: textLeft,
        width: 50,
        height: 20,
      });
      return { scope, img };
    };

    // right(100) - 0.5 = 99.5 以上なら横並び扱い
    const inside = build(99.6);
    expect(normalizeInactiveFloatImages(inside.scope).changed).toBe(false);

    const outside = build(99.4);
    expect(normalizeInactiveFloatImages(outside.scope).changed).toBe(true);
  });

  it('float解除後、searchFloatImage で当該画像が再検出されない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p></div>`,
    );
    const scope = query(host, '#q');
    setRect(query(host, '#f'), { top: 0, left: 0, width: 100, height: 200 });

    expect(searchFloatImage(scope)).not.toBeNull();
    normalizeInactiveFloatImages(scope);
    expect(searchFloatImage(scope)).toBeNull();
  });

  it('position: absolute / fixed の後続要素を回り込み断片として数えない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p>` +
        `<p><img id="abs" style="position:absolute"><img id="fix" style="position:fixed"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(query(host, '#abs'), { top: 10, left: 110, width: 50, height: 50 });
    setRect(query(host, '#fix'), { top: 10, left: 110, width: 50, height: 50 });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('scope内の absolute コンテナ配下にあるテキストと非テキスト要素を数えない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p>` +
        `<div style="position:absolute"><p id="t">絶対配置の文章</p><img id="n"></div></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });
    setRect(query(host, '#n'), { top: 10, left: 110, width: 60, height: 20 });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('scope外側が position: absolute でも、scope内の通常フロー候補を評価する', () => {
    const host = mount(
      `<div style="position:absolute;visibility:hidden">` +
        `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">回り込む文章</p></div>` +
        `</div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(false);
    expect(img.style.float).toBe('left');
  });

  it('display: none 配下の要素は矩形取得前に除外され、abortedにならない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p>` +
        `<div style="display:none"><p id="t">非表示の文章</p><img id="n"></div></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    // 矩形取得まで到達したら例外になる。除外されていれば例外は起きない。
    throwingNodes.add(firstTextNode(query(host, '#t')));
    throwingNodes.add(query(host, '#n'));

    const result = normalizeInactiveFloatImages(scope);

    expect(result.aborted).toBe(false);
    expect(result.changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('空の DOMRectList は断片0件として扱い、無効floatを解除する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRects(firstTextNode(query(host, '#t')), []);

    const result = normalizeInactiveFloatImages(scope);

    expect(result.aborted).toBe(false);
    expect(result.changed).toBe(true);
    expect(img.style.float).toBe('');
  });

  it('テキストの矩形取得が例外を送出した場合、abortedとなり全floatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">文章</p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    throwingNodes.add(firstTextNode(query(host, '#t')));

    const result = normalizeInactiveFloatImages(scope);

    expect(result).toEqual({
      changed: false,
      normalizedCount: 0,
      remainingFloatCount: 0,
      aborted: true,
    });
    expect(img.style.float).toBe('left');
  });

  it('非テキスト候補の矩形取得が例外を送出した場合も一切変更しない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p><img id="n"></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    throwingNodes.add(query(host, '#n'));

    const result = normalizeInactiveFloatImages(scope);

    expect(result.aborted).toBe(true);
    expect(result.changed).toBe(false);
    expect(img.style.float).toBe('left');
  });

  it('2回目のパスが失敗しても、1回目に解除済みのfloatは復元しない', () => {
    const host = mount(
      `<div id="q"><p><img id="a" style="display:inline;float:left"></p>` +
        `<p><img id="b" style="display:inline;float:left"></p>` +
        `<p id="t">Bの横に回り込む文章</p></div>`,
    );
    const scope = query(host, '#q');
    const imgA = query(host, '#a');
    const imgB = query(host, '#b');
    setRect(imgA, { top: 0, left: 0, width: 100, height: 100 });
    setRect(imgB, { top: 200, left: 0, width: 100, height: 100 });
    const textNode = firstTextNode(query(host, '#t'));
    setRect(textNode, { top: 210, left: 110, width: 60, height: 20 });

    expect(normalizeInactiveFloatImages(scope).normalizedCount).toBe(1);
    expect(imgA.style.float).toBe('');

    throwingNodes.add(textNode);
    const second = normalizeInactiveFloatImages(scope);

    expect(second.aborted).toBe(true);
    expect(second.changed).toBe(false);
    expect(imgA.style.float).toBe('');
    expect(imgB.style.float).toBe('left');
  });

  it('computed style の取得が例外を送出した場合、throwせず abortedとなり全floatを維持する', () => {
    const host = mount(
      `<div id="q"><p><img id="a" style="display:inline;float:left"></p>` +
        `<p id="t">文章</p>` +
        `<p><img id="b" style="display:inline;float:left"></p></div>`,
    );
    const scope = query(host, '#q');
    const failing = query(host, '#t');
    setRect(query(host, '#a'), { top: 0, left: 0, width: 100, height: 100 });
    setRect(query(host, '#b'), { top: 200, left: 0, width: 100, height: 100 });

    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element: Element, pseudoElement?: string | null) => {
        if (element === failing) throw new Error('computed style unavailable');
        return original(element, pseudoElement);
      },
    );

    const result = normalizeInactiveFloatImages(scope);

    expect(result).toEqual({
      changed: false,
      normalizedCount: 0,
      remainingFloatCount: 0,
      aborted: true,
    });
    expect(query(host, '#a').style.float).toBe('left');
    expect(query(host, '#b').style.float).toBe('left');
  });

  it('svg 候補の矩形を Element.prototype のスタブから取得して横配置を判定する', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p>` +
        `<p><svg id="s"></svg></p></div>`,
    );
    const scope = query(host, '#q');
    const img = query(host, '#f');
    const svg = scope.querySelector('svg');
    if (!svg) throw new Error('svgが見つかりません');
    setRect(img, { top: 0, left: 0, width: 100, height: 200 });
    setRect(svg, { top: 10, left: 110, width: 60, height: 60 });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(false);
    expect(img.style.float).toBe('left');
  });

  it('scopeが未接続、または defaultView が無い場合は無変更で aborted になる', () => {
    const detached = document.createElement('div');
    detached.innerHTML = `<p><img style="display:inline;float:left"></p>`;
    expect(normalizeInactiveFloatImages(detached).aborted).toBe(true);

    const otherDoc = document.implementation.createHTMLDocument();
    const scope = otherDoc.createElement('div');
    scope.innerHTML = `<p><img id="f" style="display:inline;float:left"></p>`;
    otherDoc.body.appendChild(scope);

    expect(otherDoc.defaultView).toBeNull();
    expect(scope.isConnected).toBe(true);

    const result = normalizeInactiveFloatImages(scope);

    expect(result.aborted).toBe(true);
    expect(query(scope, '#f').style.float).toBe('left');
  });

  it('computed display と position が空文字列の通常候補を誤って除外しない', () => {
    const host = mount(
      `<div id="q"><p><img id="f" style="display:inline;float:left"></p><p id="t">文章</p></div>`,
    );
    const scope = query(host, '#q');
    // 通常候補は computed display / position が空文字列になるが、除外してはならない
    expect(window.getComputedStyle(query(host, '#t')).position).toBe('');
    setRect(query(host, '#f'), { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });

    expect(normalizeInactiveFloatImages(scope).changed).toBe(false);
  });

  it('同一パスでは共有祖先のcomputed styleを1回だけ取得し、次パスで再取得する', () => {
    const host = mount(
      `<div id="q"><div id="shared"><p><img id="f" style="display:inline;float:left"></p>` +
        `<p id="t1">文章1</p><p id="t2">文章2</p></div></div>`,
    );
    const scope = query(host, '#q');
    const shared = query(host, '#shared');
    setRect(query(host, '#f'), { top: 0, left: 0, width: 100, height: 200 });
    setRect(firstTextNode(query(host, '#t1')), {
      top: 10,
      left: 110,
      width: 60,
      height: 20,
    });
    setRect(firstTextNode(query(host, '#t2')), {
      top: 40,
      left: 110,
      width: 60,
      height: 20,
    });

    const spy = vi.spyOn(window, 'getComputedStyle');

    normalizeInactiveFloatImages(scope);
    const afterFirstPass = spy.mock.calls.filter(
      ([element]) => element === shared,
    ).length;
    expect(afterFirstPass).toBe(1);

    normalizeInactiveFloatImages(scope);
    const afterSecondPass = spy.mock.calls.filter(
      ([element]) => element === shared,
    ).length;
    expect(afterSecondPass).toBe(2);
  });
});

describe('画像待機の解決保証', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('src を持たない img は待機対象にならない', () => {
    const img = document.createElement('img');
    img.setAttribute('alt', 'firstGrade/NOT_READY_KEY');

    expect(hasLoadableImageSource(img)).toBe(false);
  });

  it('src が空白だけの img も待機対象にならない', () => {
    const img = document.createElement('img');
    img.setAttribute('src', '   ');

    expect(hasLoadableImageSource(img)).toBe(false);
  });

  it('src を持つ img は待機対象になる', () => {
    const img = document.createElement('img');
    img.setAttribute('src', 'demo-asset://images/firstGrade/key.png?v=1');

    expect(hasLoadableImageSource(img)).toBe(true);
  });

  it('未接続ノード上の src 無し img があっても高さ計測が完了する', async () => {
    // 選択肢は choiceGroup へ append する前に計測されるため、未接続かつ 0x0 になる。
    // 画像アセットが未 ready の間は src が付かず、load も error も発火しない。
    const node = document.createElement('div');
    node.innerHTML = '<p><img alt="firstGrade/NOT_READY_KEY"></p>';

    await CalculateNodeHeighter(node, 0, { force: true });

    expect(node.getAttribute('heighter')).not.toBeNull();
  }, 3000);

  it('load も error も発火しない img は待機上限で打ち切る', async () => {
    vi.useFakeTimers();
    try {
      const node = document.createElement('div');
      node.innerHTML =
        '<p><img src="demo-asset://images/firstGrade/never-loads.png"></p>';

      const measuring = CalculateNodeHeighter(node, 0, { force: true });
      await vi.runAllTimersAsync();

      await expect(measuring).resolves.toBeUndefined();
      expect(IMAGE_READY_TIMEOUT_MS).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
