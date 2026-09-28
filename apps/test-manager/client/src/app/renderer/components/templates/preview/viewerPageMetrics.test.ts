import { describe, expect, it } from 'vitest';
import viewerHtml from './viewer.html?raw';
import viewerExamHtml from './viewer-exam.html?raw';

/**
 * tmp計測領域と本番ページで本文幅が一致していないと、本番では画像横へ回り込むテキストが
 * tmpでは下へ落ち、無効float判定と高さ計測が実際のページと食い違う。
 * 幅は両方とも --page-width-mm 基準で box-sizing: border-box なので、
 * 幅式と左右paddingが一致していればページサイズによらず本文幅も一致する。
 */
const extractRuleBody = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 他セレクタの一部（.print-page::after 等）に一致しないよう、直後は , か { に限る
  const pattern = new RegExp(
    `(?:^|[};])\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`,
  );
  const matched = css.match(pattern);
  if (!matched) throw new Error(`ルールが見つかりません: ${selector}`);
  // コメントは宣言の区切り判定を邪魔するため落とす
  return matched[1].replace(/\/\*[\s\S]*?\*\//g, '');
};

const declarationOf = (ruleBody: string, property: string): string => {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`);
  const matched = ruleBody.match(pattern);
  if (!matched) throw new Error(`宣言が見つかりません: ${property}`);
  return matched[1].trim();
};

const horizontalPaddingOf = (ruleBody: string): [string, string] => {
  const parts = declarationOf(ruleBody, 'padding').split(/\s+/);
  if (parts.length !== 4) {
    throw new Error(`padding は4値指定を前提にしています: ${parts.join(' ')}`);
  }
  return [parts[1], parts[3]];
};

describe.each([
  ['viewer.html（問題集モード）', viewerHtml],
  ['viewer-exam.html（模擬試験モード）', viewerExamHtml],
])('%s のtmp計測幅と本番ページ幅', (_name, html) => {
  const printPage = extractRuleBody(html, '.print-page');
  const measureShell = extractRuleBody(html, '.measure-page-shell');

  it('ページ幅の指定が一致する', () => {
    expect(declarationOf(measureShell, 'width')).toBe(
      declarationOf(printPage, 'width'),
    );
    expect(declarationOf(printPage, 'width')).toContain('--page-width-mm');
  });

  it('左右paddingが一致する', () => {
    expect(horizontalPaddingOf(measureShell)).toEqual(
      horizontalPaddingOf(printPage),
    );
  });

  it('幅計算の前提として box-sizing: border-box が全体へ適用されている', () => {
    expect(html).toMatch(/html\s*\{[^}]*box-sizing:\s*border-box/);
    expect(html).toMatch(/\*,[\s\S]*?\{[^}]*box-sizing:\s*inherit/);
  });
});
