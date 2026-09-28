# PDF作成 抽選ロジック設計書 v2

> **ステータス**: current
> **置き場**: docs/current/
> **参照仕様**: モード固定化仕様書（業務情報を含むため非公開）

---

## 1. 設計の核心：候補の単位

### 1-1. 一問一答モードの特性

問題集モード（Workbook）の一問一答系では、元の選択肢問題1問から複数の「問題行」を生成できる。  
1問あたりの最大候補数は **1級: 4候補（ch1〜ch4）、2級: 5候補（ch1〜ch5）** である。

同じ問題 No でも選択肢が異なれば別問題として扱えるため、抽選の基本単位を「問題 No」ではなく **「(問題 No, 選択肢番号) ペア」** に変える必要がある。

### 1-2. 候補エントリ型の定義

```typescript
type CandidateEntry = {
  no: number;
  choiceIndex: number | null; // qaa系: 1始まり選択肢番号、それ以外: null。0 は null と同等に扱う
};
```

モード別の候補単位は以下の通り：

| モード | 候補エントリの単位 | 1問あたりの候補数 |
|--------|------------------|--------------------|
| 選択肢問題（multipleChoice） | (No, null) | 1 |
| 模擬試験（Exam） | (No, null) | 1 |
| 一問一答（qaa） | (No, choiceIndex) | 有効選択肢数（最大 1級:4 / 2級:5） |
| 一問一答・◯のみ（qaaAllTrue） | (No, choiceIndex) | answerBool=true の有効選択肢数 |
| 一問一答・×のみ（qaaAllFalse） | (No, choiceIndex) | answerBool=false の有効選択肢数 |

重複排除も `CandidateEntry` を文字列化したキー（`"No:choiceIndex"` または `"No:null"`）で管理する。

---

## 2. 候補インデックス

### 2-1. 構造

```typescript
type CandidateIndex = {
  // カテゴリキー "subject::big::small" → 候補エントリ配列
  bySmallCategory: ReadonlyMap<string, readonly CandidateEntry[]>;

  // カテゴリキー "subject::big" → 候補エントリ配列（small 指定なし枠の OR 解決用）
  byBigCategory: ReadonlyMap<string, readonly CandidateEntry[]>;

  // 難易度キー "subject::big::small::difficult" → 候補エントリ配列
  byDifficulty: ReadonlyMap<string, readonly CandidateEntry[]>;

  // no → TestData（抽選後のメタ参照用）
  byNo: ReadonlyMap<number, TestData>;
  // no → CandidateEntry[]（fixedChoiceIndex=null の固定行の choiceIndex 再抽選用）
  entriesByNo: ReadonlyMap<number, readonly CandidateEntry[]>;};
```

- 各 `CandidateEntry[]` は構築時点で **安定順（シャッフルなし）** とする。シャッフルは抽選エンジン内でのみ行う。
- インデックスは hook の useMemo でキャッシュし、UI 表示（件数カウント・選択肢除外判定）と抽選エンジンの両方で共有する。

### 2-2. 構築シグネチャ

```typescript
buildCandidateIndex(params: {
  testDataByNo: ReadonlyMap<number, TestData>;
  workbookMode?: WorkbookMode; // qaa系フィルタ・展開の適用判定
  grade?: 1 | 2;               // qaa系での選択肢展開に使用。qaa系かつ未指定の場合は throw Error
  options: CreatePdfCommonOptionDraftState;
}): CandidateIndex
```

### 2-3. 構築時のフィルタ

| フィルタ | 適用条件 | 処理 |
|---------|---------|------|
| status | 常時 | `status !== '準備完了'` の問題を除外 |
| 一問一答化不可 | workbookMode が qaa 系 | `isConvertibleQaa === false` の問題を除外 |
| タグ除外 | `options.excludedTagIds` が 1 件以上 | `otherTags` にいずれか一致する問題を除外 |
| 過去問除外 | `options.excludePastExam` = true | `isOriginal !== true` の問題を除外 |
| オリジナル除外 | `options.excludeOriginal` = true | `isOriginal === true` の問題を除外 |

### 2-4. qaa 系での候補エントリ展開

フィルタを通過した各問題に対して、qaa 系モードのみ以下のように選択肢分を展開する。

```
各問題 d に対して:
  indices = grade === 1 ? [1,2,3,4] : [1,2,3,4,5]
  有効な choiceIndex i の条件:
    - hasChoiceHtml(d, i) が true（ch(i) に HTML が存在する）
    - qaaAllTrue の場合: calcQaaAnswerBool(d, i) === true
    - qaaAllFalse の場合: calcQaaAnswerBool(d, i) === false
    - qaa の場合: 追加制限なし

  有効な i ごとに CandidateEntry { no: d.no, choiceIndex: i } をインデックスに追加
  ※ 有効な i が 0 件の問題はインデックスに登録しない
```

- multipleChoice / Exam の場合: `CandidateEntry { no: d.no, choiceIndex: null }` を1件追加

### 2-5. キャッシュ戦略（hook 側）

```typescript
// useWorkbookStepTwo
// biome-ignore lint/correctness/useExhaustiveDependencies: isShuffleChoices / shuffleSeed は候補フィルタに無関係なため意図的に除外
const candidateIndex = useMemo(
  () => buildCandidateIndex({
    testDataByNo,
    workbookMode: stepTwo.workbookMode,
    grade: basic.grade,
    options: stepTwo.options,
  }),
  [
    testDataByNo,
    basic.grade,
    stepTwo.workbookMode,
    stepTwo.options.excludedTagIds,
    stepTwo.options.excludePastExam,
    stepTwo.options.excludeOriginal,
  ],
);

// useExamStepTwo
// biome-ignore lint/correctness/useExhaustiveDependencies: isShuffleChoices / shuffleSeed は候補フィルタに無関係なため意図的に除外
const candidateIndex = useMemo(
  () => buildCandidateIndex({
    testDataByNo,
    // grade は省略（Exam は qaa展開を行わないため）
    options: stepTwo.options,
  }),
  [
    testDataByNo,
    stepTwo.options.excludedTagIds,
    stepTwo.options.excludePastExam,
    stepTwo.options.excludeOriginal,
  ],
);
```

### 2-6. UI 表示への反映

- `maxCountBySmallKey`（Workbook count スピナー上限）: `bySmallCategory.get(key)?.length ?? 0` がそのまま正確な候補数になる
  - qaa 系では `(No, choiceIndex)` ペア数、multipleChoice では No 数
- `exhaustedCategoryKeysBySubject`（Exam カテゴリ無効化）: `bySmallCategory.get(key)?.length ?? 0` で supply カウントを取得（options フィルタ適用済み）

---

## 3. 抽選フロー

### 3-1. 全体フロー

```
[ステップ1] 枠スロット展開
  Workbook: categoryTable の各条件行を count 分だけスロットに展開
  Exam:     categoryTable の各問題枠をそのまま 1 スロットに変換
      ↓
[ステップ2] 問題番号＋選択肢番号抽選（統合）
  MRV 順で各スロットを処理し、CandidateEntry を選出
  重複排除: "No:choiceIndex" または "No:null" キーで管理
  selectedNo と qaaChoiceIndex を同時確定
      ↓
出力: TestTableRow[]（section 1 つ分）
```

> **旧設計との変更点**: 旧設計書の「フェーズ3 qaa派生生成」ステップは廃止。  
> 選択肢番号の決定は問題番号抽選と同時に行う（ステップ2に統合）。

---

## 4. ステップ1: 枠スロット展開

### 4-1. DrawSlot 型

```typescript
type DrawSlot = {
  id: string;
  sourceConditionId: string | null; // TestTableRow.sourceConditionId に書き込む値
  subject: string;                  // 候補解決に使用（孤立固定行の場合は ''）
  conditions: CategoryCondition[];  // 1件=exact match、複数件=OR条件、空=学科全体
  fixedNo: string | null;           // 固定行のみ非 null
  fixedChoiceIndex: number | null;  // v1 から追加。詳細は下記
};
```

`fixedChoiceIndex` の値と挙動：

| `fixedNo` | `fixedChoiceIndex` | 挙動 |
|-----------|-------------------|------|
| null | null | 非固定スロット（通常の抽選対象） |
| 非 null | 非 null | No + choiceIndex の両方を固定して確定 |
| 非 null | null | No のみ固定、choiceIndex は再抽選で確定 |

`fixedChoiceIndex = null` かつ `fixedNo` が非 null のケースは、qaa 系に変更する前の固定行が残っている場合（`row.qaaChoiceIndex === null`）に発生する。この場合、No は絶対に変わらないが、実行のたびに異なる choiceIndex が選ばれる。

### 4-2. Workbook の展開

条件行（subject / bigCategoryTag / smallCategoryTag / count）を `count` 分のスロットに展開する。

- 固定行: `fixedNo = row.selectedNo`, `fixedChoiceIndex = row.qaaChoiceIndex`（null の場合は No のみ固定・choiceIndex は再抽選）
- 非固定: `fixedNo = null`, `fixedChoiceIndex = null`

孤立固定行（`sourceConditionId` が削除済み条件行を指す場合）は `sourceConditionId = null` で末尾に追加し、`fixedNo` / `fixedChoiceIndex` を維持する。

### 4-3. Exam の展開

各 `ExamCategoryTableRow` を1スロットに変換する（1:1）。  
Exam では `qaaChoiceIndex` は常に null のため、`fixedChoiceIndex = null` で固定。

### 4-4. シグネチャ

```typescript
buildWorkbookDrawSlots(
  conditions: readonly WorkbookCategoryTableRow[],
  fixedRows: readonly TestTableRow[],
): DrawSlot[]

buildExamDrawSlots(
  categoryTable: readonly ExamCategoryTableRow[],
  fixedRows: readonly TestTableRow[],
  _grade: 1 | 2,
): DrawSlot[]
```

---

## 5. ステップ2: 問題番号＋選択肢番号抽選

### 5-1. シグネチャ

```typescript
runDrawEngine(params: {
  slots: readonly DrawSlot[];
  index: CandidateIndex;
  difficulty: CreatePdfDifficultyDraftState;
}): DrawResult

type DrawResult = {
  rows: TestTableRow[];
  hasError: boolean;
  errorRows: { slotId: string; message: string }[];
};
```

### 5-2. 重複排除キーの定義

```typescript
// candidateIndex.ts 内部定義（export する）
const toCandidateKey = (no: number, choiceIndex: number | null): string =>
  choiceIndex !== null ? `${no}:${choiceIndex}` : `${no}:null`;
```

選出済みセット: `selectedKeys: Set<string>`  
`toCandidateKey` は `candidateIndex.ts` に定義して export する。`drawEngine.ts` からもインポートして使用する（両ファイルで同じロジックを重複定義しない）。

### 5-3. 処理アルゴリズム

```
1. 固定スロット（fixedNo != null）を 2 パスで処理する
   （1パス目の確定キーを 2 パス目の候補フィルタに反映するため）

   《パス 1》fixedChoiceIndex が非 null の固定スロットのみ確定（No + choiceIndex 両方固定）:
      - row.selectedNo = fixedNo
      - row.qaaChoiceIndex = fixedChoiceIndex
      - row.isFixed = true
      - toCandidateKey(no, fixedChoiceIndex) を selectedKeys に追加

   《パス 2》fixedChoiceIndex が null の固定スロットを処理（No のみ固定、choiceIndex は再抽選）:
      - row.selectedNo = fixedNo（No は確定）
      - row.isFixed = true
      - `index.entriesByNo.get(Number(fixedNo)) ?? []` で O(1) 取得
      - selectedKeys でフィルタ後、Fisher-Yates シャッフルで choiceIndex を選出
      - 選出成功: row.qaaChoiceIndex = entry.choiceIndex
                  toCandidateKey(no, entry.choiceIndex) を selectedKeys に追加
      - 選出失敗（候補 0 件）: row.hasError = true
                  ※ No 固定のため errorMessage には「指定問題の有効選択肢がありません」を記録

2. 非固定スロットを MRV 順にソート（候補数昇順）
   - 候補数: インデックスから CandidateEntry[] を取得 → selectedKeys でフィルタした残り件数
   - 同数の場合はランダム順（shuffleArray 後に安定ソート）
   - conditions が空のスロット（学科全体枠）は末尾に配置

3. 各スロットを順番に処理
   a. インデックスから CandidateEntry[] を取得（OR 条件は union）
   b. selectedKeys でフィルタ（既選出ペアを除外）
   c. TODO: T21 難易度調整はここで候補フィルタを追加（現時点では無視）
   d. Fisher-Yates シャッフル後に先頭の CandidateEntry を選出
   e. 選出成功: row.selectedNo = String(entry.no), row.qaaChoiceIndex = entry.choiceIndex
      toCandidateKey(entry.no, entry.choiceIndex) を selectedKeys に追加
   f. 選出失敗（候補 0 件）: row.hasError = true, row.errorMessage に詳細を記録
```

### 5-4. 候補解決のインターフェース

```typescript
// resolveCandidates の戻り値を CandidateEntry[] に変更
resolveCandidates(index, subject, conditions): CandidateEntry[]

// getCandidates の戻り値を CandidateEntry[] に変更
getCandidates(index, subject, big, small): CandidateEntry[]
```

---

## 6. 入出力仕様

### 6-1. 共通入力

| 入力値 | 型 |
|--------|----|
| `testDataByNo` | `ReadonlyMap<number, TestData>` |
| `options` | `CreatePdfCommonOptionDraftState` |
| `difficulty` | `CreatePdfDifficultyDraftState` |
| 固定行 | `TestTableRow[]`（`isFixed=true` の行） |

### 6-2. Workbook 固有入力

| 入力値 | 型 |
|--------|----|
| `categoryTable` | `WorkbookCategoryTableRow[]` |
| `workbookMode` | `'qaa' \| 'qaaAllTrue' \| 'qaaAllFalse' \| 'multipleChoice'` |
| `grade` | `1 \| 2`（qaa系でのみ展開に使用） |

### 6-3. Exam 固有入力

| 入力値 | 型 |
|--------|----||
| `categoryTable` | `ExamCategoryTableRow[]` |
| `grade` | 不要（qaa展開を行わないため、`buildCandidateIndex` には渡さない） |

### 6-4. 出力（各 TestTableRow フィールド）

| フィールド | 型 | 内容 |
|-----------|----|----|
| `selectedNo` | `string \| null` | 選出できなかった場合 null |
| `qaaChoiceIndex` | `number \| null` | qaa系: 1始まり選択肢番号、それ以外 null。0 は null と同等に扱う |
| `sourceConditionId` | `string \| null` | 元の条件行 / 問題枠 ID |
| `isFixed` | `boolean` | 固定行は true |
| `hasError` | `boolean` | 候補不足などのエラー |
| `errorMessage` | `string \| null` | 不足情報（学科・大分類・小分類を含む） |

---

## 7. Workbook / Exam の差異まとめ

| 観点 | Workbook | Exam |
|------|---------|------|
| セクション構造 | 1セクション | 学科ごとに1セクション |
| qaa 候補展開 | あり（grade に応じて展開） | なし（常に (No, null)） |
| qaaChoiceIndex 出力 | qaa系のみ非 null | 常に null |
| 固定行の fixedChoiceIndex | qaa系は `row.qaaChoiceIndex`（null の場合は choiceIndex のみ再抽選） | 常に null |
| OR 条件 | なし（single カテゴリ） | あり（categoryConditions[] の OR） |
| 空枠（conditions=[]） | 該当なし | 学科全体候補・末尾処理 |
| 重複排除範囲 | 全体 | 全体（学科をまたいでも重複しない） |

---

## 8. 修正が必要なファイルと概要

### 8-1. `api/candidateIndex.ts`（変更規模: 大）

| 変更点 | 内容 |
|--------|------|
| `CandidateEntry` 型を追加 | `{ no: number, choiceIndex: number \| null }` |
| `CandidateIndex` の値型変更 | `number[]` → `CandidateEntry[]`（全マップ） |
| `CandidateIndex` に `entriesByNo` 追加 | `ReadonlyMap<number, readonly CandidateEntry[]>`（fixedChoiceIndex=null 用） |
| `buildCandidateIndex` の引数変更 | `grade?: 1 \| 2` をオプション追加 |
| qaa 系の展開ロジックを追加 | 各問題を有効選択肢数分 CandidateEntry に展開 |
| `toCandidateKey` を追加・ export | 重複排除キー生成関数（`drawEngine.ts` からも import） |
| `hasChoiceHtml` を移動・ export | `drawEngine.ts` から移動。TestData の選択肢 HTML 存在判定 |
| `calcQaaAnswerBool` を移動・ export | `drawEngine.ts` から移動。answerBool 算出（isNegativeAnswer 考慮） |
| `getChoiceIndices` を移動・ export | `drawEngine.ts` から移動。grade に応じた選択肢インデックス一覧 |
| `resolveCandidates` の戻り値変更 | `number[]` → `CandidateEntry[]` |
| `getCandidates` の戻り値変更 | `number[]` → `CandidateEntry[]` |

### 8-2. `api/drawEngine.ts`（変更規模: 大）

| 変更点 | 内容 |
|--------|------|
| `DrawSlot` に `fixedChoiceIndex` を追加 | `number \| null` |
| `runDrawEngine` の重複排除セット変更 | `Set<number>` → `Set<string>`（`toCandidateKey` キー） |
| 抽選結果に qaaChoiceIndex を確定 | `entry.choiceIndex` を row にセット |
| `resolveQaaChoiceIndex` を削除 | ステップ2に統合されるため不要 |
| `applyQaaChoiceIndex` を削除 | ステップ2に統合されるため不要 |
| `hasChoiceHtml` / `calcQaaAnswerBool` / `getChoiceIndices` を削除 | `candidateIndex.ts` に移動・ import に変更 |
| `buildWorkbookDrawSlots` の修正 | `fixedChoiceIndex` の取得・設定を追加 |
| 候補解決の型変更対応 | `resolveCandidates` の戻り値が `CandidateEntry[]` になるため内部ロジック更新 |

### 8-3. `hooks/useWorkbookStepTwo.ts`（変更規模: 小）

| 変更点 | 内容 |
|--------|------|
| `candidateIndex` useMemo に `grade` を追加 | `basic.grade` を依存配列に追加 |
| `executeDraw` から `applyQaaChoiceIndex` 呼び出しを削除 | ステップ2で確定済みのため不要 |

### 8-4. `hooks/useExamStepTwo.ts`（変更規模: なし）

変更不要。`buildCandidateIndex` の `grade` がオプション引数になるため、Exam 側は `grade` を渡さなくてよい。

### 8-5. テスト（変更規模: 中）

| ファイル | 変更内容 |
|---------|---------|
| `api/candidateIndex.test.ts` | 戻り値が `CandidateEntry[]` になるためテストを全面更新 |
| `api/drawEngine.test.ts` | 重複排除・選択肢確定のテストを更新。`resolveQaaChoiceIndex` / `applyQaaChoiceIndex` のテストケースを削除 |

---

## 9. 設計上の決定事項と注意点

### 9-1. `byDifficulty` の型変更と T21 マージ時の注意（確定）

**決定**: `byDifficulty` の型変更（`number[]` → `CandidateEntry[]`）を T21 より先行して実施する。  
難易度ロジックの実装（T21）は型変更後に追加する。

> **T21 実装時のマージ注意点**:  
> `byDifficulty` の値型がすでに `CandidateEntry[]` になっているため、T21 の難易度フィルタは  
> `CandidateEntry.no` を使って `byNo` から TestData を取得し、難易度条件で絞り込む形にする。  
> `CandidateEntry.choiceIndex` は難易度フィルタ対象外（No 単位でフィルタする）。

### 9-2. `grade` のオプション引数化（確定）

**決定**: `grade?: 1 | 2` のオプション引数として実装する。  
- qaa 系（`workbookMode` が qaa / qaaAllTrue / qaaAllFalse）: `grade` が未指定の場合は `throw new Error(...)` で早期検出する。
- Exam / multipleChoice: `grade` を渡さない（省略）。

### 9-3. 固定行の `qaaChoiceIndex = null` の扱い（確定）

**決定**: `qaaChoiceIndex = null` の固定行は **No のみ固定し、choiceIndex は毎回再抽選** する。  
`DrawSlot.fixedChoiceIndex = null` のスロットは、§5.3 アルゴリズム「1-b」の処理を適用する。

- `fixedChoiceIndex = null` は「qaa 系モード変更前に固定された行」または「multipleChoice の固定行」で発生する。
- No が固定されているため、同一 No の有効選択肢の中からランダムに1つが選ばれる（§5.3《パス 2》を適用）。
- 選択肢候補が 0 件の場合は `hasError = true`（No 固定なので「指定問題の有効選択肢がありません」と記録）。

### 9-4. テストの一括書き直し（確定）

**決定**: 実装とテストは **2セッション** に分けて実施する。  
既存テストは型変更後にコンパイルエラーとなるため、以下の順で一括更新する：

```
【セッション1: 実装】
1. candidateIndex.ts の型・関数を変更
2. drawEngine.ts の変更（型変更への追従 + resolveQaaChoiceIndex/applyQaaChoiceIndex 削除）
3. hook 側の変更（小規模）

【セッション2: テスト】
4. candidateIndex.test.ts を全面更新してグリーン確認
   - 正常系: CandidateEntry[] 展開、toCandidateKey、各 WorkbookMode 別の挙動
   - 異常系: grade 未指定 + qaa 系で throw Error することを確認
5. drawEngine.test.ts を更新してグリーン確認
   - resolveQaaChoiceIndex / applyQaaChoiceIndex のテストケースを削除
   - 重複排除・選択肢確定（CandidateEntry 単位）のテストを追加
6. hooks/useWorkbookStepTwo テストで grade 未指定の異常系を可能な限り確認
```
