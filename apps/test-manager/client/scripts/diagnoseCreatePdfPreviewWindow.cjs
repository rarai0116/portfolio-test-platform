// CreatePdf PreviewWindow の実表示を Chrome DevTools Protocol 経由で検査する手動診断スクリプト。
// 実行方法は apps/client/scripts/README.md を参照。
//
// 既に開いている Electron の PreviewWindow に接続し、ページ境界からはみ出した画像や item 要素を
// DOM の getBoundingClientRect() で検出する。アプリ側の状態は変更しない。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_ENDPOINT = 'http://127.0.0.1:9222';
const DEFAULT_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = {
    endpoint: DEFAULT_ENDPOINT,
    page: null,
    no: null,
    displayPage: null,
    actualPageOffset: 2,
    screenshot: false,
    outDir: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    tolerancePx: 0.5,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      i += 1;
      return next;
    };

    if (arg === '--endpoint') args.endpoint = readValue();
    else if (arg === '--port') args.endpoint = `http://127.0.0.1:${readValue()}`;
    else if (arg === '--page') args.page = Number(readValue());
    else if (arg === '--display-page') args.displayPage = Number(readValue());
    else if (arg === '--actual-page-offset') args.actualPageOffset = Number(readValue());
    else if (arg === '--no') args.no = readValue();
    else if (arg === '--screenshot') args.screenshot = true;
    else if (arg === '--out') args.outDir = readValue();
    else if (arg === '--timeout-ms') args.timeoutMs = Number(readValue());
    else if (arg === '--tolerance-px') args.tolerancePx = Number(readValue());
    else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.page !== null && (!Number.isInteger(args.page) || args.page < 1)) {
    throw new Error('--page must be a positive integer.');
  }
  if (
    args.displayPage !== null &&
    (!Number.isInteger(args.displayPage) || args.displayPage < 1)
  ) {
    throw new Error('--display-page must be a positive integer.');
  }
  if (
    !Number.isInteger(args.actualPageOffset) ||
    args.actualPageOffset < 0
  ) {
    throw new Error('--actual-page-offset must be a non-negative integer.');
  }
  if (args.page !== null && args.displayPage !== null) {
    throw new Error('--page and --display-page cannot be used together.');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number.');
  }
  if (!Number.isFinite(args.tolerancePx) || args.tolerancePx < 0) {
    throw new Error('--tolerance-px must be a non-negative number.');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/diagnoseCreatePdfPreviewWindow.cjs [options]

Options:
  --port <port>          CDP port. Default: 9222
  --endpoint <url>       CDP endpoint. Default: ${DEFAULT_ENDPOINT}
  --page <number>        Inspect an actual PDF page number including covers/TOC
  --display-page <num>   Inspect the printed/displayed page number, e.g. 38
  --actual-page-offset <n>
                         Convert actual page to rendered page by subtracting n. Default: 2
  --no <value>           Narrow context to a displayed question number, e.g. 68
  --screenshot           Save a screenshot of the PreviewWindow
  --out <dir>            Output directory for screenshot and JSON report
  --timeout-ms <ms>      Wait timeout for PreviewWindow readiness
  --tolerance-px <px>    Overflow tolerance. Default: 0.5
  --json                 Print raw JSON only
`);
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    try {
      return await import('@playwright/test');
    } catch (fallbackError) {
      throw new Error(
        [
          'playwright を読み込めませんでした。apps/client で依存関係が利用できる状態か確認してください。',
          `playwright: ${error.message}`,
          `@playwright/test: ${fallbackError.message}`,
        ].join('\n'),
      );
    }
  }
}

function ensureOutDir(outDir) {
  const resolved =
    outDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'demo-preview-diagnose-'));
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

async function findPreviewPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const byUrl = pages.find((page) =>
    page.url().includes('createPdfPreviewWindow'),
  );
  if (byUrl) return byUrl;

  for (const page of pages) {
    const hasBridge = await page
      .evaluate(() => Boolean(globalThis.__CREATE_PDF_PREVIEW_WINDOW__))
      .catch(() => false);
    if (hasBridge) return page;
  }

  const urls = pages.map((page) => page.url());
  throw new Error(
    [
      'CreatePdf PreviewWindow が見つかりませんでした。',
      'PreviewWindow を開いた状態で実行してください。',
      `検出したページ: ${urls.length ? urls.join(', ') : '(none)'}`,
    ].join('\n'),
  );
}

function buildOutputName(args, ext) {
  const page = args.page
    ? `actual-p${args.page}`
    : args.displayPage
      ? `display-p${args.displayPage}`
      : 'all-pages';
  const no = args.no ? `no${String(args.no).replace(/[^\w.-]+/g, '_')}` : 'all-nos';
  return `create-pdf-preview-${page}-${no}.${ext}`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const { chromium } = await importPlaywright();
  const browser = await chromium.connectOverCDP(args.endpoint);
  let report;
  let targetRenderedPage = args.page
    ? Math.max(1, args.page - args.actualPageOffset)
    : null;

  try {
    const page = await findPreviewPage(browser);
    await page.waitForFunction(
      () => {
        const bridge = globalThis.__CREATE_PDF_PREVIEW_WINDOW__;
        if (!bridge || typeof bridge.getStatus !== 'function') return false;
        const status = bridge.getStatus();
        return Boolean(status?.isOpen && status?.isReady && !status?.isRendering);
      },
      { timeout: args.timeoutMs },
    );

    if (args.displayPage !== null) {
      targetRenderedPage = args.displayPage + args.actualPageOffset;
    }

    report = await page.evaluate(
      ({ actualPage, displayPage, targetRenderedPage, targetNo, tolerancePx }) => {
        const round = (value) => Math.round(value * 100) / 100;
        const rectToJson = (rect) => ({
          x: round(rect.x),
          y: round(rect.y),
          width: round(rect.width),
          height: round(rect.height),
          top: round(rect.top),
          right: round(rect.right),
          bottom: round(rect.bottom),
          left: round(rect.left),
        });
        const getStatus = () => {
          const bridge = globalThis.__CREATE_PDF_PREVIEW_WINDOW__;
          return bridge?.getStatus?.() ?? null;
        };
        const pages = Array.from(
          document.querySelectorAll('.print-firstpage, .print-page'),
        )
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map((element, index) => ({
            element,
            pageNumber: index + 1,
            className: element.className,
            rect: element.getBoundingClientRect(),
          }));

        const area = (rect) => Math.max(0, rect.width) * Math.max(0, rect.height);
        const overlapArea = (a, b) => {
          const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return width * height;
        };
        const findPageForRect = (rect) => {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const containing = pages.find(
            (page) =>
              centerX >= page.rect.left &&
              centerX <= page.rect.right &&
              centerY >= page.rect.top &&
              centerY <= page.rect.bottom,
          );
          if (containing) return containing;
          return pages
            .map((page) => ({ page, overlap: overlapArea(rect, page.rect) }))
            .sort((a, b) => b.overlap - a.overlap)[0]?.page;
        };
        const describeElement = (element) => {
          const parts = [element.tagName.toLowerCase()];
          if (element.id) parts.push(`#${element.id}`);
          if (element.className && typeof element.className === 'string') {
            parts.push(
              ...element.className
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 4)
                .map((name) => `.${name}`),
            );
          }
          return parts.join('');
        };
        const normalizeNo = (value) => String(value ?? '').replace(/[^\dA-Za-z]/g, '');
        const targetNoNormalized = targetNo ? normalizeNo(targetNo) : null;
        const markerNodes = Array.from(
          document.querySelectorAll('[data-item-id] .no, .no[data-item-id], .question-num[data-item-id], .question-meta[data-item-id]'),
        );
        const noMatches = markerNodes
          .map((element) => {
            const owner = element.closest('[data-item-id]');
            const rect = element.getBoundingClientRect();
            const page = findPageForRect(rect);
            const text = element.textContent?.trim() ?? '';
            return {
              itemId: owner?.getAttribute('data-item-id') ?? element.getAttribute('data-item-id'),
              text,
              pageNumber: page?.pageNumber ?? null,
              selector: describeElement(element),
            };
          })
          .filter((entry) => {
            if (!targetNoNormalized) return true;
            return normalizeNo(entry.text).endsWith(targetNoNormalized);
          });
        const targetItemIds = new Set(
          noMatches.map((entry) => entry.itemId).filter(Boolean),
        );

        const targetPageInfo = targetRenderedPage
          ? pages.find((page) => page.pageNumber === targetRenderedPage)
          : null;
        const candidateSelector = [
          'img',
          '[data-item-id]',
          '.question-wrapper',
          '.answer-wrapper',
          '.float-image-run',
          '.test-section-div',
        ].join(', ');
        const seen = new Set();
        const candidates = Array.from(document.querySelectorAll(candidateSelector)).filter(
          (element) => {
            if (seen.has(element)) return false;
            seen.add(element);
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const page = findPageForRect(rect);
            if (targetRenderedPage && page?.pageNumber !== targetRenderedPage) return false;
            if (targetItemIds.size > 0) {
              const itemId =
                element.getAttribute('data-item-id') ??
                element.closest('[data-item-id]')?.getAttribute('data-item-id');
              if (!itemId || !targetItemIds.has(itemId)) return false;
            }
            return true;
          },
        );

        const findings = candidates
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const page = findPageForRect(rect);
            if (!page) return null;
            const overflow = {
              top: round(Math.max(0, page.rect.top - rect.top)),
              right: round(Math.max(0, rect.right - page.rect.right)),
              bottom: round(Math.max(0, rect.bottom - page.rect.bottom)),
              left: round(Math.max(0, page.rect.left - rect.left)),
            };
            const maxOverflow = Math.max(
              overflow.top,
              overflow.right,
              overflow.bottom,
              overflow.left,
            );
            if (maxOverflow <= tolerancePx) return null;
            const itemOwner = element.closest('[data-item-id]');
            return {
              pageNumber: page.pageNumber,
              selector: describeElement(element),
              tagName: element.tagName.toLowerCase(),
              itemId:
                element.getAttribute('data-item-id') ??
                itemOwner?.getAttribute('data-item-id') ??
                null,
              imageKey:
                element.getAttribute('data-asset-key') ??
                element.getAttribute('data-key') ??
                element.getAttribute('alt') ??
                null,
              text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120),
              rect: rectToJson(rect),
              pageRect: rectToJson(page.rect),
              overflow,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.overflow.bottom + b.overflow.right - (a.overflow.bottom + a.overflow.right));

        return {
          url: location.href,
          title: document.title,
          status: getStatus(),
          pageCount: pages.length,
          target: {
            actualPage,
            displayPage,
            renderedPage: targetRenderedPage,
            no: targetNo,
            matchedItems: Array.from(targetItemIds),
            noMatches: noMatches.slice(0, 20),
          },
          targetPageRect: targetPageInfo ? rectToJson(targetPageInfo.rect) : null,
          findings,
        };
      },
      {
        actualPage: args.page,
        displayPage: args.displayPage,
        targetRenderedPage,
        targetNo: args.no,
        tolerancePx: args.tolerancePx,
      },
    );

    const outDir = args.screenshot || args.outDir ? ensureOutDir(args.outDir) : null;
    if (outDir) {
      const reportPath = path.join(outDir, buildOutputName(args, 'json'));
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      report.reportPath = reportPath;
    }
    if (args.screenshot) {
      const screenshotPath = path.join(outDir, buildOutputName(args, 'png'));
      if (targetRenderedPage) {
        await page
          .locator('.print-firstpage, .print-page')
          .nth(targetRenderedPage - 1)
          .screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
      report.screenshotPath = screenshotPath;
    }
  } finally {
    await browser.close();
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`PreviewWindow: ${report.title}`);
  console.log(`URL: ${report.url}`);
  console.log(`status: ${JSON.stringify(report.status)}`);
  console.log(`pages: ${report.pageCount}`);
  if (report.target.actualPage || report.target.displayPage || report.target.no) {
    console.log(
      [
        `target: actualPage=${report.target.actualPage ?? '(all)'}`,
        `displayPage=${report.target.displayPage ?? '(none)'}`,
        `renderedPage=${report.target.renderedPage ?? '(all)'}`,
        `no=${report.target.no ?? '(all)'}`,
      ].join(' '),
    );
    console.log(`matched itemIds: ${report.target.matchedItems.join(', ') || '(none)'}`);
  }
  if (report.reportPath) console.log(`report: ${report.reportPath}`);
  if (report.screenshotPath) console.log(`screenshot: ${report.screenshotPath}`);
  console.log('');
  if (report.findings.length === 0) {
    console.log('result: PASS (ページ境界からのはみ出しは検出されませんでした)');
  } else {
    console.log(`result: FAIL (${report.findings.length} 件のはみ出し候補)`);
    for (const finding of report.findings.slice(0, 20)) {
      console.log(
        [
          `- page ${finding.pageNumber}`,
          finding.selector,
          finding.itemId ? `item=${finding.itemId}` : null,
          finding.imageKey ? `image=${finding.imageKey}` : null,
          `overflow=${JSON.stringify(finding.overflow)}`,
        ]
          .filter(Boolean)
          .join(' | '),
      );
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
