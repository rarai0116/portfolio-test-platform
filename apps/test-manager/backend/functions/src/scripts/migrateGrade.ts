/* 目的:
 * storageList/{firstGrade|secondGrade}/images/{doc} の grade を
 * '一級'/'1級'/1 → 'firstGrade'
 * '二級'/'2級'/2 → 'secondGrade'
 * に正規化する。
 * Admin SDK なので Firestore ルールはバイパスします（安全に再実行可能）。
 */
/** 使用方法:
 * ローカル環境の場合
 *  1. Firestore Emulator を起動
 *  2. ターミナルで以下を実行
 * # 別ターミナルでエミュレータ起動中でも OK（Firestore につながれば実行可能）
 * cd apps/backend/functions
 *
 * # Firestore Emulator に向ける
 * export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *
 * # 影響だけ見たいとき
 * npm run migrate:grades:dry
 *
 * # 実行
 * npm run migrate:grades
 *
 * プロダクション環境の場合
 * 1. Firebase CLI でログイン・プロジェクト選択
 * 2. 以下をターミナルで実行
 * # サービスアカウントJSONの絶対パスを指定（機密。リポジトリに含めない）
 * export APPLICATION_CREDENTIALS="/absolute/path/to/service_account.json"
 *
 * # 念のため、エミュ関連の環境変数をクリア
 * unset FIRESTORE_EMULATOR_HOST
 * unset FIREBASE_STORAGE_EMULATOR_HOST
 * unset STORAGE_EMULATOR_HOST
 * unset FUNCTIONS_EMULATOR
 * unset USE_FIREBASE_EMULATORS
 *
 * cd apps/backend/functions
 * # 乾燥実行（ログのみ）
 * npm run migrate:grades:dry
 *
 * # 本実行
 * npm run migrate:grades
 */
import { FieldPath, type WriteBatch } from 'firebase-admin/firestore';
import { firestore, initializeApp } from '../admin';

type GradeId = 'firstGrade' | 'secondGrade';

function toNormalizedGrade(input: unknown, gradeIdFromPath: GradeId): GradeId {
  // 入力が既に 'firstGrade' | 'secondGrade' ならそのまま
  if (input === 'firstGrade' || input === 'secondGrade') return input;

  // 代表表記と数字を許容
  const text = typeof input === 'string' ? input.trim() : input;
  const candidatesFirst = new Set<unknown>(['一級', '１級', '1級', 1, '1']);
  const candidatesSecond = new Set<unknown>(['二級', '２級', '2級', 2, '2']);

  if (candidatesFirst.has(text)) return 'firstGrade';
  if (candidatesSecond.has(text)) return 'secondGrade';

  // 不明な場合はパスの gradeId を真実とみなし合わせる
  return gradeIdFromPath;
}

async function migrateGradeCollection(gradeId: GradeId): Promise<{
  total: number;
  changed: number;
  skipped: number;
}> {
  if (!firestore) throw new Error('firestore not initialized');
  const colRef = firestore
    .collection('storageList')
    .doc(gradeId)
    .collection('images');

  const orderByDocId = new FieldPath('__name__');
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let total = 0;
  let changed = 0;
  let skipped = 0;

  while (true) {
    let q = colRef.orderBy(orderByDocId).limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    let batch: WriteBatch | null = firestore.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      total += 1;
      const data = doc.data() ?? {};
      const current = data.grade as unknown;
      const normalized = toNormalizedGrade(current, gradeId);

      if (current === normalized) {
        skipped += 1;
        continue;
      }

      // ログだけ見たい場合は DRY_RUN=1
      if (process.env.DRY_RUN === '1') {
        console.info(
          `[DRY_RUN] ${gradeId}/images/${doc.id}:`,
          'grade:',
          current,
          '->',
          normalized,
        );
        changed += 1;
        continue;
      }

      batch.update(doc.ref, { grade: normalized });
      pending += 1;
      changed += 1;

      // バッチは 500 件まで。余裕をもって 400 でコミット
      if (pending >= 400) {
        await batch.commit();
        batch = firestore.batch();
        pending = 0;
      }
    }

    if (pending > 0 && batch) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { total, changed, skipped };
}

async function main() {
  initializeApp();

  const res1 = await migrateGradeCollection('firstGrade');
  const res2 = await migrateGradeCollection('secondGrade');

  console.log('[migrateGrades] firstGrade:', res1);
  console.log('[migrateGrades] secondGrade:', res2);
  console.log('[migrateGrades] done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
