/** biome-ignore-all lint/suspicious/noExplicitAny:  型が不明なパラメータが多すぎるため */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

// react-router は1回だけモックして navigateMock を返す
vi.mock('react-router', async (orig) => {
  const actual = (await orig()) as any;
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/login' }),
    useParams: () => ({}),
    MemoryRouter: actual.MemoryRouter, // 透過
  };
});

import Login from './index';

// 各テスト前にリセット
beforeEach(() => {
  navigateMock.mockReset();
  window.appInfo = {
    get: vi.fn(async () => ({
      ok: true,
      isPackaged: false,
      version: 'test-version',
    })),
  } as any;
  // デフォルトは「未ログイン・クレームなし」
  // Electron の IpcRenderer 型には多数のメソッドがあるため、テスト用に最低限のメソッドをスタブ化して any にキャストします。
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'auth:hasRequiredClaims') {
          return { ok: true, signedIn: false, hasClaims: false };
        }
        if (channel === 'auth:signInWithGoogle') {
          return { ok: false, error: 'popup-closed-by-user' };
        }
        return { ok: true };
      }),
      on: vi.fn(),
      once: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
      sendSync: vi.fn(),
    },
  } as any;
});

afterEach(() => {
  vi.useRealTimers();
});

// 既存セッション＋クレームOKなら即遷移
it('既存セッション＋クレームOKならサブウィンドウ無しで遷移', async () => {
  (window.electron.ipcRenderer.invoke as any).mockImplementation(
    async (channel: string) => {
      if (channel === 'auth:hasRequiredClaims') {
        return {
          ok: true,
          signedIn: true,
          hasClaims: true,
          claims: { atpAllowRead: true },
        };
      }
      return { ok: true };
    },
  );

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  // クリックが必要（コンポーネント実装がクリックでチェック＆遷移）
  await userEvent.click(
    screen.getByRole('button', { name: /sign in with google/i }),
  );

  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith('/testDataList');
  });
});

// 未ログイン -> signIn 成功で遷移
it('未ログイン -> signIn 成功で遷移', async () => {
  (window.electron.ipcRenderer.invoke as any).mockImplementation(
    async (channel: string) => {
      if (channel === 'auth:hasRequiredClaims') {
        return { ok: true, signedIn: false, hasClaims: false };
      }
      if (channel === 'auth:signInWithGoogle') {
        return {
          ok: true,
          signedIn: true,
          hasClaims: true,
          claims: { atpAllowWrite: true },
        };
      }
      return { ok: true };
    },
  );

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /sign in with google/i }),
  );

  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith('/testDataList'); // or '/questionEditorContainer'
  });
});

// signIn 後も未付与 -> ensure で付与できたら遷移
it('signIn 後もカスタムクレーム未付与 -> ensure で付与できたら遷移', async () => {
  const invoke = window.electron.ipcRenderer.invoke as any;
  invoke
    // 1. 初回: 未サインイン
    .mockResolvedValueOnce({ ok: true, signedIn: false, hasClaims: false })
    // 2. signIn: まだクレーム無し
    .mockResolvedValueOnce({ ok: true, signedIn: true, hasClaims: false })
    // 3. ensure: 付与される
    .mockResolvedValueOnce({ ok: true, signedIn: true, hasClaims: true });

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /sign in with google/i }),
  );

  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith('/testDataList'); // or '/questionEditorContainer'
  });

  // 呼び順の検証（任意）
  expect(invoke).toHaveBeenNthCalledWith(1, 'auth:hasRequiredClaims', {
    refresh: true,
  });
  expect(invoke).toHaveBeenNthCalledWith(2, 'auth:signInWithGoogle');
  expect(invoke).toHaveBeenNthCalledWith(3, 'auth:hasRequiredClaims', {
    refresh: true,
    ensure: true,
  });
});

// 最終的にクレーム未付与 -> エラーメッセージ表示
it('最終的にカスタムクレーム未付与ならエラーメッセージを表示', async () => {
  const invoke = window.electron.ipcRenderer.invoke as any;
  invoke
    .mockResolvedValueOnce({ ok: true, signedIn: false, hasClaims: false })
    .mockResolvedValueOnce({ ok: true, signedIn: true, hasClaims: false })
    .mockResolvedValueOnce({ ok: true, signedIn: true, hasClaims: false });

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /sign in with google/i }),
  );

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toMatch('権限がありません');
});

it('認可失敗後にサインアウト済みでも権限エラーを表示できる', async () => {
  const invoke = window.electron.ipcRenderer.invoke as any;
  invoke
    .mockResolvedValueOnce({ ok: true, signedIn: false, hasClaims: false })
    .mockResolvedValueOnce({
      ok: false,
      errorCode: 'claims-missing',
      error: '権限がありません（カスタムクレーム未付与）',
    })
    .mockResolvedValueOnce({ ok: true, signedIn: false, hasClaims: false });

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  await userEvent.click(
    screen.getByRole('button', { name: /sign in with google/i }),
  );

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toMatch('権限がありません');
  expect(invoke).toHaveBeenNthCalledWith(3, 'auth:hasRequiredClaims', {
    refresh: true,
    ensure: true,
  });
});

it('ログイン処理中でも5秒後に再度ボタンを押せる', async () => {
  vi.useFakeTimers();

  (window.electron.ipcRenderer.invoke as any).mockImplementation(
    async (channel: string) => {
      if (channel === 'auth:hasRequiredClaims') {
        return { ok: true, signedIn: false, hasClaims: false };
      }
      if (channel === 'auth:signInWithGoogle') {
        return new Promise(() => {});
      }
      return { ok: true };
    },
  );

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login),
    ),
  );

  const button = screen.getByRole('button', { name: /sign in with google/i });
  fireEvent.click(button);

  expect(button).toHaveAttribute('disabled');

  await act(async () => {
    vi.advanceTimersByTime(5000);
  });

  expect(button).not.toHaveAttribute('disabled');
});
