import { DUMMY_IMG } from '@api/dummyImage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSET_LOAD_FAILED_ATTRIBUTE,
  installImageErrorRecovery,
  REACT_MANAGED_ASSET_ATTRIBUTE,
} from './imageErrorRecovery';

const reportLoadFailure = vi.fn();
const reportLoadSuccess = vi.fn();

const ASSET_URL = 'demo-asset://images/firstGrade/key1.png?v=md5AAA';
const RECOVERY_URL =
  'demo-asset://images/firstGrade/key1.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA';

/** capture listener を直接叩くため、img を生成して target にする */
const dispatchOnImage = (src: string, type: 'error' | 'load') => {
  const img = document.createElement('img');
  img.setAttribute('src', src);
  document.body.append(img);
  img.dispatchEvent(new Event(type));
  return img;
};

beforeEach(() => {
  document.body.innerHTML = '';
  reportLoadFailure.mockReset().mockResolvedValue({
    ok: true,
    status: 'recovery-started',
  });
  reportLoadSuccess
    .mockReset()
    .mockResolvedValue({ ok: true, confirmed: true });
  (globalThis as { assets?: unknown }).assets = {
    reportLoadFailure,
    reportLoadSuccess,
  };
  installImageErrorRecovery(document);
});

describe('installImageErrorRecovery', () => {
  it('demo-asset URL の表示失敗でダミーへ戻し、失敗マーカーを付けて報告する', () => {
    const img = dispatchOnImage(ASSET_URL, 'error');

    expect(img.getAttribute(ASSET_LOAD_FAILED_ATTRIBUTE)).toBe('1');
    expect(img.getAttribute('src')).toBe(DUMMY_IMG);
    expect(reportLoadFailure).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'key1',
      version: 'md5AAA',
      recoveryToken: undefined,
    });
  });

  it('demo-asset 以外の画像の失敗では何もしない', () => {
    const img = dispatchOnImage(DUMMY_IMG, 'error');

    expect(img.hasAttribute(ASSET_LOAD_FAILED_ATTRIBUTE)).toBe(false);
    expect(reportLoadFailure).not.toHaveBeenCalled();
  });

  it('r なしの通常 load では成功報告を送らない', () => {
    dispatchOnImage(ASSET_URL, 'load');
    expect(reportLoadSuccess).not.toHaveBeenCalled();
  });

  it('r 付きURLの load 成功だけ報告し、confirmed なら失敗マーカーを解除する', async () => {
    const img = dispatchOnImage(RECOVERY_URL, 'load');
    img.setAttribute(ASSET_LOAD_FAILED_ATTRIBUTE, '1');

    expect(reportLoadSuccess).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'key1',
      version: 'md5AAA',
      recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    });

    await vi.waitFor(() => {
      expect(img.hasAttribute(ASSET_LOAD_FAILED_ATTRIBUTE)).toBe(false);
    });
  });

  it('confirmed=false では失敗マーカーを解除しない', async () => {
    reportLoadSuccess.mockResolvedValue({ ok: true, confirmed: false });
    const img = dispatchOnImage(RECOVERY_URL, 'load');
    img.setAttribute(ASSET_LOAD_FAILED_ATTRIBUTE, '1');

    await Promise.resolve();
    await Promise.resolve();

    expect(img.getAttribute(ASSET_LOAD_FAILED_ATTRIBUTE)).toBe('1');
    // 表示中画像をダミーへ戻さない
    expect(img.getAttribute('src')).toBe(RECOVERY_URL);
  });

  it('同じ document へ二重登録しない', () => {
    installImageErrorRecovery(document);
    installImageErrorRecovery(document);

    dispatchOnImage(ASSET_URL, 'error');

    expect(reportLoadFailure).toHaveBeenCalledTimes(1);
  });
});

describe('React が管理する img の扱い（設計10.5）', () => {
  it('React管理の目印がある img は共通listenerが処理しない', () => {
    const img = document.createElement('img');
    img.setAttribute('src', ASSET_URL);
    img.setAttribute(REACT_MANAGED_ASSET_ATTRIBUTE, '1');
    document.body.append(img);

    img.dispatchEvent(new Event('error'));
    img.dispatchEvent(new Event('load'));

    expect(reportLoadFailure).not.toHaveBeenCalled();
    expect(reportLoadSuccess).not.toHaveBeenCalled();
    // 表示も書き換えない
    expect(img.getAttribute('src')).toBe(ASSET_URL);
  });
});
