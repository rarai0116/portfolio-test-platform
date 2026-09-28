/**
 * 書き込み側優先の非同期 read/write gate（設計7.1）。
 * 新規パッケージを使わず、公開AssetManagerメソッド（共有側）と
 * clearCache（排他側）の直列化だけに使う。
 *
 * 排他要求が待機している間は新しい共有要求を通さないため、
 * 連続する共有操作によって clearCache が待たされ続けることがない。
 * 再入はしない前提で、公開メソッドの最外周だけが取得する。
 */
export class ReadWriteGate {
  private activeShared = 0;
  private exclusiveActive = false;
  private waitingExclusive: Array<() => void> = [];
  private waitingShared: Array<() => void> = [];

  async runShared<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquireShared();
    try {
      return await fn();
    } finally {
      this.releaseShared();
    }
  }

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquireExclusive();
    try {
      return await fn();
    } finally {
      this.releaseExclusive();
    }
  }

  private async acquireShared(): Promise<void> {
    if (!this.exclusiveActive && this.waitingExclusive.length === 0) {
      this.activeShared += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitingShared.push(resolve);
    });
  }

  private releaseShared(): void {
    this.activeShared -= 1;
    this.dispatch();
  }

  private async acquireExclusive(): Promise<void> {
    if (
      !this.exclusiveActive &&
      this.activeShared === 0 &&
      this.waitingExclusive.length === 0
    ) {
      this.exclusiveActive = true;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitingExclusive.push(resolve);
    });
  }

  private releaseExclusive(): void {
    this.exclusiveActive = false;
    this.dispatch();
  }

  private dispatch(): void {
    if (this.exclusiveActive) {
      return;
    }

    if (this.activeShared === 0 && this.waitingExclusive.length > 0) {
      const next = this.waitingExclusive.shift();
      if (next) {
        this.exclusiveActive = true;
        next();
      }
      return;
    }

    if (this.waitingExclusive.length === 0) {
      // 排他待ちがない間だけ、待機中の共有要求をまとめて通す。
      while (this.waitingShared.length > 0) {
        const next = this.waitingShared.shift();
        if (!next) break;
        this.activeShared += 1;
        next();
      }
    }
  }
}
