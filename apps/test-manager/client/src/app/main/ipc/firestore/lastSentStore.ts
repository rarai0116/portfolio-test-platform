import { isNewer, type Version } from '@shared/types/contracts';

/* 各ウィンドウごとに、最後に送信したドキュメントのバージョンを記録する
 *
 * - ウィンドウごとに Map<docPath, Version> を持つ
 * - shouldSend() で、引数のバージョンが前回より新しければ true を返し、記録を更新する
 * - clearWindow() でウィンドウの記録を削除する
 */
export class LastSentStore {
  private map = new Map<number, Map<string /*docPath*/, Version>>();

  shouldSend(windowId: number, docPath: string, v: Version): boolean {
    const sub = this.map.get(windowId) ?? new Map();
    const last = sub.get(docPath);
    if (isNewer(last, v)) {
      sub.set(docPath, v);
      this.map.set(windowId, sub);
      return true;
    }
    return false;
  }

  clearWindow(windowId: number) {
    this.map.delete(windowId);
  }
  forgetDoc(windowId: number, docPath: string) {
    const sub = this.map.get(windowId);
    if (!sub) return;
    sub.delete(docPath);
    if (sub.size === 0) {
      this.map.delete(windowId);
    } else {
      this.map.set(windowId, sub);
    }
  }
}
