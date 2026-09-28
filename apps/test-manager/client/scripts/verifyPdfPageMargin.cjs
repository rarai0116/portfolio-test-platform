// PDF出力の余白縮小バグ（@page に margin 指定が無いと shrink-to-fit が発生する問題）の
// 回帰確認用スクリプト。手動実行専用。ビルド・CI には含めない。
//
// 実行方法は apps/client/scripts/README.md を参照。
//
// 経緯: docs/.ai-works/PDF出力_余白縮小バグ_設計ドラフト.md
//
// 実テンプレート (viewer.html / viewer-exam.html) を直接読み込み、ensurePdf.ts の
// 'patch' モードと同内容のCSSを注入し、createPdfExport.ts と同じ printToPDF オプションで
// 出力したPDFの content stream を解析して、コンテンツが縮小されていないかを検証する。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const PT_PER_MM = 72 / 25.4;
const PX_PER_MM = 96 / 25.4; // CSS px (96dpi) per mm

// apps/client/src/app/renderer/api/ensurePdf.ts の ensureDisplayModeStyle('patch') と同内容。
// ensurePdf.ts を変更した場合はここも追従させること。
const PATCH_STYLE = `
  html { background-color: transparent !important; }
  body { background: transparent !important; }
  .print-page, .print-firstpage {
    box-shadow: none !important;
    background: transparent !important;
  }
  .test-section-div { overflow: visible !important; }
  [data-create-pdf-preview-toolbar] { display: none !important; }
  [data-create-pdf-preview-host] { padding-top: 0 !important; }
  body { padding: 0 !important; }
  .print-page, .print-firstpage { margin: 0 !important; }
`;

// apps/client/src/app/main/ipc/createPdfExport.ts の exportPdf ハンドラと同じオプション。
// createPdfExport.ts を変更した場合はここも追従させること。
const PRINT_OPTIONS = {
  printBackground: true,
  preferCSSPageSize: true,
  margins: { marginType: 'none' },
};

const TEMPLATES = [
  {
    key: 'workbook-b5',
    label: 'viewer.html (B5)',
    file: 'apps/client/src/app/renderer/components/templates/preview/viewer.html',
    expectedWidthMm: 176,
    expectedHeightMm: 250,
  },
  {
    key: 'exam-a4',
    label: 'viewer-exam.html (A4)',
    file: 'apps/client/src/app/renderer/components/templates/preview/viewer-exam.html',
    expectedWidthMm: 210,
    expectedHeightMm: 297,
  },
];

const MARK_SIZE_MM = 50;
const MM_TOLERANCE = 0.5;

function buildHtml(originalHtml, pageCount) {
  const markPage = (n) => `
    <div class="print-page">
      <div style="position:absolute;top:0;left:0;width:${MARK_SIZE_MM}mm;height:${MARK_SIZE_MM}mm;border:4px solid red;box-sizing:border-box;background:rgba(255,0,0,.15);"></div>
      <div style="position:absolute;top:${MARK_SIZE_MM + 5}mm;left:0;font:16pt sans-serif;">verify page ${n}</div>
    </div>`;
  const marks = Array.from({ length: pageCount }, (_, i) => markPage(i + 1)).join('');
  const injectedStyle = `<style id="preview-mode-style">${PATCH_STYLE}</style>`;
  return originalHtml
    .replace('<body>', `<body>${marks}`)
    .replace('</head>', `${injectedStyle}</head>`);
}

function decodeContentStreams(pdfText) {
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const streams = [];
  let m;
  while ((m = streamRe.exec(pdfText))) {
    try {
      streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
    } catch {
      // フォント等の非圧縮/非対象ストリームはスキップ
    }
  }
  return streams;
}

function findMarkRectIndex(decoded) {
  // ページ境界の丸め誤差で width/height が厳密に一致しないことがあるため、
  // 50mm相当(設計px換算で約189)に近いサイズの矩形を許容誤差付きで探す。
  const designPx = MARK_SIZE_MM * PX_PER_MM;
  const reOpRe = /([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+re/g;
  let match;
  while ((match = reOpRe.exec(decoded))) {
    const w = Number(match[3]);
    const h = Number(match[4]);
    if (Math.abs(w - designPx) <= 3 && Math.abs(h - designPx) <= 3) {
      return match.index;
    }
  }
  return -1;
}

function measureMarkSizeMm(decoded) {
  const markIndex = findMarkRectIndex(decoded);
  if (markIndex === -1) return null;

  const cmRe = /([+-]?[\d.]+)\s+0\s+0\s+([+-]?[\d.]+)\s+[+-]?[\d.]+\s+[+-]?[\d.]+\s+cm/g;
  let match;
  let scaleX = 1;
  let scaleY = 1;
  while ((match = cmRe.exec(decoded)) && cmRe.lastIndex <= markIndex) {
    scaleX *= Math.abs(Number(match[1]));
    scaleY *= Math.abs(Number(match[2]));
  }

  const markDesignPx = MARK_SIZE_MM * PX_PER_MM;
  const widthMm = (markDesignPx * scaleX) / PT_PER_MM;
  const heightMm = (markDesignPx * scaleY) / PT_PER_MM;
  return { widthMm, heightMm };
}

function getMediaBoxMm(pdfText) {
  const mb = /\/MediaBox\s*\[\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*\]/.exec(pdfText);
  if (!mb) return null;
  return {
    widthMm: Number(mb[3]) / PT_PER_MM,
    heightMm: Number(mb[4]) / PT_PER_MM,
  };
}

function within(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

async function runCase(template, pageCount, pageRanges, workDir) {
  const label = `${template.label} pages=${pageCount}${pageRanges ? ` pageRanges=${pageRanges}` : ''}`;
  const originalHtml = fs.readFileSync(path.join(REPO_ROOT, template.file), 'utf8');
  const html = buildHtml(originalHtml, pageCount);
  const htmlPath = path.join(workDir, `${template.key}-${pageCount}p.html`);
  fs.writeFileSync(htmlPath, html);

  const win = new BrowserWindow({ show: false, width: 940, height: 960 });
  await new Promise((resolve, reject) => {
    win.webContents.once('did-finish-load', resolve);
    win.webContents.once('did-fail-load', (_e, c, d) => reject(new Error(`${c} ${d}`)));
    win.loadFile(htmlPath);
  });

  const buf = await win.webContents.printToPDF({
    ...PRINT_OPTIONS,
    ...(pageRanges ? { pageRanges } : {}),
  });
  win.destroy();
  fs.writeFileSync(path.join(workDir, `${template.key}-${pageCount}p.pdf`), buf);

  const pdfText = buf.toString('latin1');
  const mediaBox = getMediaBoxMm(pdfText);
  const streams = decodeContentStreams(pdfText).filter((s) => s.includes(' cm'));

  const results = [];
  streams.forEach((decoded, i) => {
    const size = measureMarkSizeMm(decoded);
    if (!size) return;
    results.push({ page: i + 1, ...size });
  });

  const checks = [];
  checks.push({
    name: 'MediaBox width',
    ok: mediaBox && within(mediaBox.widthMm, template.expectedWidthMm, MM_TOLERANCE),
    detail: mediaBox ? `${mediaBox.widthMm.toFixed(3)}mm (expected ${template.expectedWidthMm}mm)` : 'not found',
  });
  checks.push({
    name: 'MediaBox height',
    ok: mediaBox && within(mediaBox.heightMm, template.expectedHeightMm, MM_TOLERANCE),
    detail: mediaBox ? `${mediaBox.heightMm.toFixed(3)}mm (expected ${template.expectedHeightMm}mm)` : 'not found',
  });
  results.forEach((r) => {
    checks.push({
      name: `page ${r.page} mark width`,
      ok: within(r.widthMm, MARK_SIZE_MM, MM_TOLERANCE),
      detail: `${r.widthMm.toFixed(2)}mm (expected ${MARK_SIZE_MM}mm)`,
    });
    checks.push({
      name: `page ${r.page} mark height`,
      ok: within(r.heightMm, MARK_SIZE_MM, MM_TOLERANCE),
      detail: `${r.heightMm.toFixed(2)}mm (expected ${MARK_SIZE_MM}mm)`,
    });
  });
  if (results.length === 0) {
    checks.push({ name: 'mark detection', ok: false, detail: '0 0 189 189 re 相当のマークが見つからない' });
  }

  return { label, checks };
}

// ケース間でウィンドウを破棄した瞬間に「全ウィンドウが閉じた」と判定され、
// アプリが自動終了してしまうのを防ぐ（終了は最後に app.exit() で明示的に行う）。
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-pdf-page-margin-verify-'));
  let hasFailure = false;
  const lines = [];
  const print = (line) => {
    lines.push(line);
    console.log(line);
  };

  for (const template of TEMPLATES) {
    const cases = [
      await runCase(template, 1, undefined, workDir),
      await runCase(template, 3, undefined, workDir),
      await runCase(template, 3, '2-3', workDir),
    ];
    for (const c of cases) {
      print(`\n=== ${c.label} ===`);
      for (const check of c.checks) {
        const mark = check.ok ? 'PASS' : 'FAIL';
        if (!check.ok) hasFailure = true;
        print(`  [${mark}] ${check.name}: ${check.detail}`);
      }
    }
  }

  print(`\n出力ファイル一時保存先: ${workDir}`);
  print(hasFailure ? '\n結果: FAIL（縮小バグが疑われます）' : '\n結果: PASS');

  // console.log は app.exit() の即時終了によりバッファが flush されないことがあるため、
  // 結果はファイルにも書き出す（実行後に確認できるようにする）。
  fs.writeFileSync(path.join(workDir, 'summary.txt'), lines.join('\n') + '\n');
  console.log(`\nsummary: ${path.join(workDir, 'summary.txt')}`);

  setTimeout(() => app.exit(hasFailure ? 1 : 0), 50);
}).catch((e) => {
  console.error(e);
  app.exit(1);
});
