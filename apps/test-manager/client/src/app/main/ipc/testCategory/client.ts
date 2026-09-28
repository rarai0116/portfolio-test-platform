import type { FirestoreCacheManager } from '@main/ipc/firestore/cacheManager';
import type {
  GradeId as GradeIdShared,
  TestData,
  TestSubject,
  Version,
} from '@shared/types/contracts';
import type {
  TestCategoryChangedCategory,
  TestCategoryChangedOtherTag,
} from '@shared/types/testCategory';
import type { GradeId, SnapshotRow, TestCategoryDB } from './db';

/*
type DocsCache = {
  upsertDoc(doc: Doc): Promise<boolean>;
  deleteDoc(path: string): Promise<boolean>;
  listByPathPrefix(prefix: string): Promise<Array<Doc & { data: unknown }>>;
};
*/

type EligibleInput = {
  bigCategoryTag?: string;
  smallCategoryTag?: string;
};

type CategoryKey = string;
type OtherTagKey = string;
const makeKey = (c: {
  grade: string;
  big: string;
  small: string;
}): CategoryKey => `${c.grade}\u0000${c.big}\u0000${c.small}`;

const makeOtherTagKey = (c: { grade: string; tag: string }): OtherTagKey =>
  `${c.grade}\u0000${c.tag}`;

const isNonEmpty = (s: unknown): s is string =>
  typeof s === 'string' && s.trim().length > 0;

const normalizeKey = (value: string): string => value.trim();

const normalizeOtherTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];

  const set = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const normalized = normalizeKey(tag);
    if (!normalized) continue;
    set.add(normalized);
  }

  return [...set].sort((left, right) => left.localeCompare(right, 'ja'));
};

const parseSnapshotOtherTags = (snapshot?: SnapshotRow): string[] => {
  if (!snapshot?.other_tags_json) return [];

  try {
    const parsed: unknown = JSON.parse(snapshot.other_tags_json);
    return normalizeOtherTags(parsed);
  } catch {
    return [];
  }
};

const isEligible = (d: EligibleInput): boolean => {
  return isNonEmpty(d.bigCategoryTag) && isNonEmpty(d.smallCategoryTag);
};

const wasEligible = (s: SnapshotRow | undefined): boolean => {
  if (!s) return false;
  return isNonEmpty(s.big) && isNonEmpty(s.small);
};

const hasCategoryIndexChanged = (
  previous: SnapshotRow,
  next: {
    no: number;
    subject: string | null;
    big: string | null;
    small: string | null;
  },
): boolean => {
  return (
    previous.no !== next.no ||
    previous.subject !== next.subject ||
    previous.big !== next.big ||
    previous.small !== next.small
  );
};

const gradeFromPath = (path: string): GradeId | null => {
  if (path.startsWith('firstGrade/')) return 'firstGrade';
  if (path.startsWith('secondGrade/')) return 'secondGrade';
  return null;
};

const pickTestDataFields = (
  data: unknown,
): {
  no: number;
  subject: string | null;
  big: string | null;
  small: string | null;
  otherTags: string[];
  autoCheck: boolean;
  calibrationCheck: boolean;
  status: string | null;
} | null => {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<TestData>;

  if (typeof d.no !== 'number') return null;

  return {
    no: d.no,
    subject: typeof d.subject === 'string' ? d.subject : null,
    big: typeof d.bigCategoryTag === 'string' ? d.bigCategoryTag : null,
    small: typeof d.smallCategoryTag === 'string' ? d.smallCategoryTag : null,
    otherTags: normalizeOtherTags(d.otherTags),
    autoCheck: d.autoCheck === true,
    calibrationCheck: d.calibrationCheck === true,
    status: typeof d.status === 'string' ? d.status : null,
  };
};

export class TestCategoryClient {
  private initPromise: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private stopListeners: Array<() => void> = [];
  private updatedHandlers = new Set<
    (changes: TestCategoryChangedCategory[]) => void
  >();
  private otherTagUpdatedHandlers = new Set<
    (changes: TestCategoryChangedOtherTag[]) => void
  >();

  constructor(
    private readonly db: TestCategoryDB,
    private readonly cacheManager: FirestoreCacheManager,
  ) {}

  onUpdated(
    handler: (changes: TestCategoryChangedCategory[]) => void,
  ): () => void {
    this.updatedHandlers.add(handler);
    return () => this.updatedHandlers.delete(handler);
  }

  onOtherTagsUpdated(
    handler: (changes: TestCategoryChangedOtherTag[]) => void,
  ): () => void {
    this.otherTagUpdatedHandlers.add(handler);
    return () => this.otherTagUpdatedHandlers.delete(handler);
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.cacheManager.ensureStarted();
        await this.buildFromCacheOnce();
        this.startCacheManagerListeners();
      })();
    }
    return this.initPromise;
  }

  // IPC向け問い合わせ（DB直）
  async requestNos(args: {
    grade: GradeIdShared;
    bigCategoryTag?: string;
    smallCategoryTag?: string;
  }): Promise<number[]> {
    await this.ensureInitialized();
    return this.db.selectNos({
      grade: args.grade as GradeId,
      big: args.bigCategoryTag,
      small: args.smallCategoryTag,
    });
  }

  async getKeys(args: {
    grade: GradeIdShared;
    subject?: TestSubject;
    bigCategoryTag?: string;
  }): Promise<string[]> {
    await this.ensureInitialized();
    const grade = args.grade as GradeId;
    if (!args.subject) {
      return [];
    }
    if (!args.bigCategoryTag) {
      // 学科と学年から大分類を取得
      return this.db.selectBigKeys(grade, args.subject);
    }
    return this.db.selectSmallKeys(grade, args.subject, args.bigCategoryTag);
  }

  async requestOtherTagNos(args: {
    grade: GradeIdShared;
    tag: string;
  }): Promise<number[]> {
    await this.ensureInitialized();
    return this.db.selectOtherTagNos({
      grade: args.grade as GradeId,
      tag: normalizeKey(args.tag),
    });
  }

  async getOtherTagKeys(args: { grade: GradeIdShared }): Promise<string[]> {
    await this.ensureInitialized();
    return this.db.selectOtherTagKeys(args.grade as GradeId);
  }

  dispose(): void {
    for (const stop of this.stopListeners) stop();
    this.stopListeners = [];
  }

  private emitUpdated(changes: TestCategoryChangedCategory[]) {
    if (changes.length === 0) return;
    for (const h of this.updatedHandlers) h(changes);
  }

  private emitOtherTagsUpdated(changes: TestCategoryChangedOtherTag[]) {
    if (changes.length === 0) return;
    for (const handler of this.otherTagUpdatedHandlers) handler(changes);
  }

  private enqueueWrite(fn: () => void | Promise<void>): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await fn();
    });
    return this.writeChain;
  }

  private async buildFromCacheOnce(): Promise<void> {
    const collections: GradeId[] = ['firstGrade', 'secondGrade'];

    for (const grade of collections) {
      const docs = await this.cacheManager.getOnce({
        collectionPath: grade,
      });

      await this.enqueueWrite(() => {
        this.db.transaction(() => {
          for (const doc of docs) {
            const parsed = pickTestDataFields(doc.data);
            if (!parsed) continue;

            const eligible = isEligible({
              bigCategoryTag: parsed.big ?? undefined,
              smallCategoryTag: parsed.small ?? undefined,
            });

            const snap: SnapshotRow = {
              path: doc.path,
              grade,
              no: parsed.no,
              subject: parsed.subject,
              big: parsed.big,
              small: parsed.small,
              other_tags_json: JSON.stringify(parsed.otherTags),
              auto_check: parsed.autoCheck ? 1 : 0,
              calibration_check: parsed.calibrationCheck ? 1 : 0,
              status: parsed.status,
              updated_at_ms: Date.now(),
            };
            this.db.upsertSnapshot(snap);

            if (eligible && snap.big && snap.small) {
              this.db.insertNo(
                grade,
                snap.subject ?? null,
                snap.big,
                snap.small,
                snap.no,
              );
              /*
              console.log(
                '[insertNo] subject=',
                snap.subject,
                'big=',
                snap.big,
                'small=',
                snap.small,
              );
              */
            }

            for (const tag of parsed.otherTags) {
              this.db.insertOtherTagNo(grade, tag, snap.no);
            }
          }
        });
      });
    }
  }

  private startCacheManagerListeners(): void {
    const listen = (collectionPath: GradeId) => {
      const stop = this.cacheManager.onCollectionChanged(
        collectionPath,
        (docs) => {
          for (const doc of docs) {
            const isRemoved =
              !!doc.data &&
              typeof doc.data === 'object' &&
              !Array.isArray(doc.data) &&
              (doc.data as { deleted?: unknown }).deleted === true;

            void this.onRemoteChange({
              type: isRemoved ? 'removed' : 'modified',
              path: doc.path,
              data: doc.data,
              updateTime: doc.updateTime,
            });
          }
        },
      );

      this.stopListeners.push(stop);
    };

    listen('firstGrade');
    listen('secondGrade');
  }

  private async onRemoteChange(args: {
    type: 'added' | 'modified' | 'removed';
    path: string;
    data?: unknown;
    updateTime: Version;
  }): Promise<void> {
    const grade = gradeFromPath(args.path);
    if (!grade) return; // 想定外のコレクションは無視

    // カテゴリDBを差分更新（DBトランザクション）
    await this.enqueueWrite(() => {
      const changed = new Map<
        CategoryKey,
        { grade: GradeId; big: string; small: string }
      >();
      const changedOtherTags = new Map<
        OtherTagKey,
        { grade: GradeId; tag: string }
      >();

      this.db.transaction(() => {
        const oldSnap = this.db.getSnapshotByPath(args.path);
        const oldTags = parseSnapshotOtherTags(oldSnap);

        if (args.type === 'removed') {
          if (wasEligible(oldSnap) && oldSnap?.big && oldSnap.small) {
            this.db.deleteNo(
              oldSnap.grade,
              oldSnap.subject ?? null,
              oldSnap.big,
              oldSnap.small,
              oldSnap.no,
            );
            changed.set(
              makeKey({
                grade: oldSnap.grade,
                big: oldSnap.big,
                small: oldSnap.small,
              }),
              {
                grade: oldSnap.grade,
                big: oldSnap.big,
                small: oldSnap.small,
              },
            );
          }

          for (const tag of oldTags) {
            if (!oldSnap) continue;
            this.db.deleteOtherTagNo(oldSnap.grade, tag, oldSnap.no);
            changedOtherTags.set(
              makeOtherTagKey({ grade: oldSnap.grade, tag }),
              {
                grade: oldSnap.grade,
                tag,
              },
            );
          }

          this.db.deleteSnapshot(args.path);
          return;
        }

        const parsed = pickTestDataFields(args.data);
        if (!parsed) return;

        const eligibleNew = isEligible({
          bigCategoryTag: parsed.big ?? undefined,
          smallCategoryTag: parsed.small ?? undefined,
        });
        const eligibleOld = wasEligible(oldSnap);

        if (!eligibleOld && eligibleNew && parsed.big && parsed.small) {
          this.db.insertNo(
            grade,
            parsed.subject ?? null,
            parsed.big,
            parsed.small,
            parsed.no,
          );
          changed.set(
            makeKey({ grade, big: parsed.big, small: parsed.small }),
            {
              grade,
              big: parsed.big,
              small: parsed.small,
            },
          );
        }

        // 移動
        if (
          eligibleOld &&
          eligibleNew &&
          oldSnap &&
          parsed.big &&
          parsed.small &&
          hasCategoryIndexChanged(oldSnap, parsed)
        ) {
          if (oldSnap.big && oldSnap.small) {
            this.db.deleteNo(
              oldSnap.grade,
              oldSnap.subject ?? null,
              oldSnap.big,
              oldSnap.small,
              oldSnap.no,
            );
            changed.set(
              makeKey({
                grade: oldSnap.grade,
                big: oldSnap.big,
                small: oldSnap.small,
              }),
              {
                grade: oldSnap.grade,
                big: oldSnap.big,
                small: oldSnap.small,
              },
            );
          }

          this.db.insertNo(
            grade,
            parsed.subject ?? null,
            parsed.big,
            parsed.small,
            parsed.no,
          );
          changed.set(
            makeKey({ grade, big: parsed.big, small: parsed.small }),
            {
              grade,
              big: parsed.big,
              small: parsed.small,
            },
          );
        }

        if (eligibleOld && !eligibleNew && oldSnap?.big && oldSnap.small) {
          this.db.deleteNo(
            oldSnap.grade,
            oldSnap.subject ?? null,
            oldSnap.big,
            oldSnap.small,
            oldSnap.no,
          );
          changed.set(
            makeKey({
              grade: oldSnap.grade,
              big: oldSnap.big,
              small: oldSnap.small,
            }),
            {
              grade: oldSnap.grade,
              big: oldSnap.big,
              small: oldSnap.small,
            },
          );
        }

        const newTags = parsed.otherTags;

        if (oldSnap && oldSnap.no !== parsed.no) {
          for (const tag of oldTags) {
            this.db.deleteOtherTagNo(oldSnap.grade, tag, oldSnap.no);
            changedOtherTags.set(
              makeOtherTagKey({ grade: oldSnap.grade, tag }),
              {
                grade: oldSnap.grade,
                tag,
              },
            );
          }

          for (const tag of newTags) {
            this.db.insertOtherTagNo(grade, tag, parsed.no);
            changedOtherTags.set(makeOtherTagKey({ grade, tag }), {
              grade,
              tag,
            });
          }
        } else {
          const oldTagSet = new Set(oldTags);
          const newTagSet = new Set(newTags);

          for (const tag of oldTags) {
            if (newTagSet.has(tag)) continue;
            if (!oldSnap) continue;
            this.db.deleteOtherTagNo(oldSnap.grade, tag, oldSnap.no);
            changedOtherTags.set(
              makeOtherTagKey({ grade: oldSnap.grade, tag }),
              {
                grade: oldSnap.grade,
                tag,
              },
            );
          }

          for (const tag of newTags) {
            if (oldTagSet.has(tag)) continue;
            this.db.insertOtherTagNo(grade, tag, parsed.no);
            changedOtherTags.set(makeOtherTagKey({ grade, tag }), {
              grade,
              tag,
            });
          }
        }

        // snapshotは常に最新化
        const nextSnap: SnapshotRow = {
          path: args.path,
          grade,
          no: parsed.no,
          subject: parsed.subject,
          big: parsed.big,
          small: parsed.small,
          other_tags_json: JSON.stringify(parsed.otherTags),
          auto_check: parsed.autoCheck ? 1 : 0,
          calibration_check: parsed.calibrationCheck ? 1 : 0,
          status: parsed.status,
          updated_at_ms: Date.now(),
        };
        this.db.upsertSnapshot(nextSnap);
      });

      // commit後に “いまの所属nos” をDBから引いて通知（メモリキャッシュしない）
      const changes: TestCategoryChangedCategory[] = [];
      for (const c of changed.values()) {
        const nos = this.db.selectNos({
          grade: c.grade,
          big: c.big,
          small: c.small,
        });
        changes.push({
          grade: c.grade,
          bigCategoryTag: c.big,
          smallCategoryTag: c.small,
          nos,
        });
      }
      this.emitUpdated(changes);

      const otherTagChanges: TestCategoryChangedOtherTag[] = [];
      for (const item of changedOtherTags.values()) {
        const nos = this.db.selectOtherTagNos({
          grade: item.grade,
          tag: item.tag,
        });
        otherTagChanges.push({
          grade: item.grade,
          tag: item.tag,
          nos,
        });
      }
      this.emitOtherTagsUpdated(otherTagChanges);
    });
  }
}
