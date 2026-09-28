/** biome-ignore-all lint/suspicious/noExplicitAny: モック時にanyで通す必要があるため */

/**
 * Vitest / Testing Library 共通セットアップ
 * - jest-dom マッチャー
 * - よく落ちるブラウザ API の簡易 Polyfill / Mock
 * - Electron preload 風オブジェクトのダミー
 * - グローバル util 追加（必要に応じて）
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: モック時にanyで通す必要があるため */
import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { beforeEach, expect, vi } from 'vitest';
import { installConsolePolicy } from './installConsolePolicy';

expect.extend(matchers);

// --- Firebase emulator/projectId をテスト開始前に強制統一 -------------------

process.env.USE_FIREBASE_EMULATOR = process.env.USE_FIREBASE_EMULATOR ?? 'true';
process.env.FIREBASE_REGION = process.env.FIREBASE_REGION ?? 'asia-northeast1';

// Web SDK 初期化に必要なダミー値（emulator 接続時は任意の非空でOK）
process.env.VITE_FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY ?? 'fake';
process.env.VITE_FIREBASE_AUTH_DOMAIN =
  process.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'localhost';

// ここを CI とローカルで統一。demo-test-manager を推奨（Emulator 用）
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-test-manager';
process.env.VITE_FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.VITE_FIREBASE_STORAGE_BUCKET =
  process.env.VITE_FIREBASE_STORAGE_BUCKET ?? `${PROJECT_ID}.appspot.com`;
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID =
  process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '1234567890';
process.env.VITE_FIREBASE_APP_ID =
  process.env.VITE_FIREBASE_APP_ID ?? '1:123:web:abc';

// Admin/Functions/CLI が参照するプロジェクトIDも合わせる
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
process.env.FIREBASE_PROJECT = PROJECT_ID;

// ResizeObserver を使うコンポーネントがある場合
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
  }
  observe() {
    /* no-op */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock;
}

// TextEncoder / TextDecoder (Node 18+ なら基本不要だが保険)
import { TextDecoder, TextEncoder } from 'node:util';

if (!globalThis.TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}
if (!globalThis.TextDecoder) {
  (globalThis as any).TextDecoder = TextDecoder;
}

// crypto.randomUUID が無い環境向け
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`,
  };
}

// --- Electron preload API の簡易モック（必要なら調整） -----------------------
/**
 * Renderer から window.electron.ipcRenderer.invoke(...) 等を呼ぶコードを
 * テストで落とさないための簡易 Mock。実際のチャネル名に合わせて追加してください。
 */
if (!(globalThis as any).electron) {
  (globalThis as any).electron = {
    ipcRenderer: {
      send: vi.fn(),
      invoke: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  };
}

const createTestCategoryMock = (): Window['testCategory'] => {
  return {
    request: vi.fn().mockResolvedValue({ ok: true, nos: [] }),
    requestOtherTagNos: vi.fn().mockResolvedValue({ ok: true, nos: [] }),
    getKey: vi.fn().mockResolvedValue({ ok: true, keys: [] }),
    getOtherTagKeys: vi.fn().mockResolvedValue({ ok: true, keys: [] }),
    onUpdated: vi.fn().mockImplementation(() => () => {}),
    onOtherTagsUpdated: vi.fn().mockImplementation(() => () => {}),
  };
};

// --- テスト毎に自動でリセットされる項目を追加したい場合 --------------------
beforeEach(() => {
  // localStorage を毎回クリア
  window.localStorage.clear();
  // window.electron のモックをリセット
  delete (window as any).assets;
  vi.restoreAllMocks();

  (window as any).testCategory = createTestCategoryMock();
});

// installConsolePolicy の beforeEach は vi.restoreAllMocks() の後に登録する必要がある。
// beforeEach は登録順に実行されるため、この順序により spy が restoreAllMocks で
// 解除された後に改めてセットアップされ、テスト本体実行中に console.error 検知が有効になる。
installConsolePolicy();

// --- 追加マッチャーや util のグローバル拡張 -------------------------------
// 例: expect.extend({}); // カスタムマッチャーを定義したい場合ここで。

// 任意: console.error を失敗扱いにしたい場合
// beforeEach(() => {
//   vi.spyOn(console, "error").mockImplementation((...args) => {
//     const msg = args.join(" ");
//     throw new Error("Unexpected console.error: " + msg);
//   });
// });
// afterEach(() => {
//   (console.error as any).mockRestore?.();
// });
