# PDF作成View T01-T04 状態管理・Hooks 再設計案

> 位置づけ: docs/current 上の設計書。現行仕様の正本として扱う。  
> 現行仕様の正本は モード固定化仕様書（業務情報を含むため非公開）。  
> 既存の初期設計は PDF作成View 初期設計（非公開）（本書へ引き継いだためarchive）。  
> タスク整理は PDF作成モードv2 タスク一覧（非公開） を参照する。  
> 本書は、T01-T04 のうち renderer View の hooks / zustand 設計だけを、後続議論を反映して再定義したものである。

---

## 1. 今回の目的

T01-T04 の初期設計では、以下の前提で土台を置いていた。

- `mainPanel.tsx` が入力 UI の親になる
- 共通 store が `creationType / grade / title / selectedOutputFolder / isDirtyConditions` を持つ
- workbook 固有 state は `useWorkbookViewStore` に分ける
- exam 側は最小受け皿のみを先に置く

この構成は初回着手の土台としては妥当だったが、その後の設計議論により、以下が明確になった。

- 状態の復元単位は `exam / workbook` の 2 単位で十分である
- Step1 と Step3 は意図的に共通化したい
- Step2 はモード差分が大きく、共通化しない方がよい
- `examPanel / workbookPanel` へ分離する方向だが、今回の範囲ではそこまで変更しない
- `markDirty` のような命令ベースの未反映管理はやめ、導出ベースに寄せたい
- preview 健全性状態は描画系の一時状態であり、永続化の正本に混ぜない
- grade 変更は `useEffect` 監視ではなく、確認付きの明示コマンドとして扱いたい

本書は、この判断を前提に、T01-T04 の hooks / zustand 設計を再整理する。

---

## 2. 今回のスコープ

### 2.1 含む範囲

- `apps/client/src/app/renderer/views/createPdf` 配下の hooks / zustand 設計
- T01-T04 の責務見直し
- store の責務境界
- panel model / shared step hook / mode step hook の責務整理
- dirty 判定の設計
- grade 変更コマンドの設計
- `mainPanel.tsx` に対する暫定的な接続方針

### 2.2 含まない範囲

- `examPanel.tsx` / `workbookPanel.tsx` への切替実装
- Step2 の UI 詳細設計
- 抽選ロジック本体
- JSON スキーマの詳細
- main / preload / shared の API 設計
- preview snapshot builder / commit / IPC の詳細実装
- persist 実装そのもの

---

## 3. 再設計の結論

今回の結論は次の 5 点である。

1. 業務 state の所有者は `exam / workbook` の mode ごとに分ける
2. 共通化は state 所有ではなく、Step1 / Step3 の use case と型に寄せる
3. store には raw state と raw action だけを置き、業務コマンドは panel model に置く
4. `未反映` は `draw condition dirty` として導出し、`table dirty` は別概念で管理する
5. grade 変更は `useEffect` で監視せず、確認付きの明示コマンドとして扱う

このため、T01-T04 の修正設計では「共通 store に業務 state をまとめる」方針をやめ、次の形へ寄せる。

- 共通 store: dockview と preview runtime のみ
- mode store: `useExamDraftStore` / `useWorkbookDraftStore`
- shared hooks: `useCreatePdfStepOne` / `useCreatePdfStepThree`
- mode hooks: `useExamPanelModel` / `useWorkbookPanelModel` と `useExamStepTwo` / `useWorkbookStepTwo`

---

## 4. 設計原則

### 4.1 state 所有と use case 共通化を分ける

同じ UI パーツ、同じ JSON 規格、同じ PDF 出力命令を使うことは、同じ store を共有する理由にはならない。

今回の設計では、以下を明確に分ける。

- state 所有: mode ごと
- use case 共通化: Step1 / Step3
- 表示部品共通化: organisms / parts
- 契約共通化: 型、payload builder 入力、warning 文言

### 4.2 store は同期的で低レベルに保つ

store action は次だけを担う。

- patch / replace
- reset
- factory からの初期化

store action に次は入れない。

- ダイアログ制御
- dirty 管理
- persist 呼び出し
- preview commit 命令
- grade 変更確認

### 4.3 hooks は 2 層に分ける

- shared step hook
  - Step1 / Step3 の共通 use case を扱う
- panel model / mode step hook
  - store 読み書きと mode 固有ロジックを扱う

### 4.4 `未反映` は導出値にする

仕様書でいう `未反映状態` は、単に何かを編集したかどうかではない。  
`抽選条件の変更内容がまだ抽選によって問題テーブルへ反映されていない状態` を指す。

したがって、`markDirty()` のような命令ではなく、比較で導出する。

### 4.5 grade 変更は業務コマンドとして扱う

grade 変更は単なる state 更新ではなく、以下を伴う業務操作である。

- 確認ダイアログ
- 保持対象と初期化対象の分離
- mode ごとの reset policy

このため `useEffect` 監視ではなく、`onChange -> requestGradeChange()` で扱う。

---

## 5. T01-T04 の修正方針

### 5.1 T01 ルート追加

T01 自体の責務は大きく変わらない。

- `/createPdf/exam`
- `/createPdf/workbook`

の 2 ルートを持ち、グローバルナビゲーションから遷移できる状態を維持する。

### 5.2 T02 モード切替と初回読み込み

T02 では、`creationType` を共通 store の業務 state として持つのではなく、route を正本とする。

#### 修正方針

- mode の正本は route
- `index.tsx` が route mode を解決する
- route mode ごとに `exam / workbook` の draft snapshot を切り替える
- JSON 復元 > 保存済み状態復元 > 初期状態 の優先順位は維持する
- `mainPanel.tsx` は暫定的に route mode を見て example UI を出し分けるだけに留める

#### 補足

移行コストの都合で `creationType` の mirror を一時的に持つことは許容できるが、ユーザー編集 UI から変更させないこと、業務判断の正本を route に置くことを必須とする。

### 5.3 T03 View 共通 store

T03 の `共通業務 store` は見直す。  
修正後の T03 は、`mode をまたいで共有が必要な runtime state` のみに責務を絞る。

対象は次の 2 つ。

- dockview runtime
- preview runtime

逆に、以下は共通 store から外す。

- `grade`
- `title`
- `selectedOutputFolder`
- `isDirtyConditions`
- Step2 条件
- table 正本

これらは mode draft store 側へ寄せる。

### 5.4 T04 workbook store

T04 の workbook store は `mode owned draft store` へ昇格させる。  
同時に、exam 側も同じ設計原則で持つ。

つまり、修正後の T04 は次を意味する。

- workbook の state 境界を独立させる
- exam 側も同じ ownership 原則で設計する
- 共通化は store ではなく型と hooks に寄せる

---

## 6. 推奨ファイル構成

```text
apps/client/src/app/renderer/views/createPdf/
  api/
    createPdfDirtyKeys.ts
    gradeChangePolicy.ts
    createPdfDraftFactory.ts
  hooks/
    useCreatePdfMainPanelModel.ts
    useCreatePdfStepOne.ts
    useCreatePdfStepThree.ts
    useExamPanelModel.ts
    useWorkbookPanelModel.ts
    useExamStepTwo.ts
    useWorkbookStepTwo.ts
  store/
    useCreatePdfDockviewStore.ts
    useExamDraftStore.ts
    useWorkbookDraftStore.ts
  templates/
    mainPanel.tsx
    previewPanel.tsx
  types/
    draftState.ts
    panelModel.ts
    testTable.ts
```

### 6.1 既存ファイルとの対応

| 既存 | 修正後の位置づけ |
|---|---|
| `useCreatePdfViewStore.ts` | route 共通 state と preview 健全性の公開正本として維持 |
| `useExamViewStore.ts` | `useExamDraftStore.ts` として責務拡張 |
| `useWorkbookViewStore.ts` | `useWorkbookDraftStore.ts` として責務拡張 |
| `useWorkbookConditions.ts` | 廃止。`useWorkbookStepTwo.ts` / `useWorkbookPanelModel.ts` へ統合 |
| `useWorkbookViewModel.ts` | `useWorkbookPanelModel.ts` へ再編 |
| `mainPanel.tsx` | 暫定 adapter UI。最終的には `examPanel/workbookPanel` へ置換予定 |

---

## 7. store 設計

## 7.1 共通 runtime store

### 7.1.1 `useCreatePdfDockviewStore`

責務は従来どおり dockview API だけに限定する。

```ts
export type CreatePdfDockviewState = {
  dockviewApi: DockviewApi | null;
  actions: {
    setDockviewApi: (value: DockviewApi | null) => void;
  };
};
```

### 7.1.2 `useCreatePdfPreviewRuntimeStore`（不採用）

preview 健全性状態を別 store へ分離する案は不採用。  
現在表示中 preview の公開正本は `useCreatePdfViewStore.currentPreviewState` に一本化する。

#### 理由

- route snapshot 保存時に `currentPreviewState` は除外できるため、別 store に切り出す必要がない
- Step3 warning 判定は full state ではなく `getCreatePdfPreviewHealth(...)` の導出値で足りる
- preview 健全性の公開正本を 1 つに絞ることで、previewPanel / panel model / alert 判定の参照先を統一できる

## 7.2 共通 draft 型

共通化するのは store ではなく、mode ごとに持つ slice の型である。

```ts
export type CreatePdfBasicDraftState = {
  grade: 1 | 2;
  title: string;
};

export type CreatePdfOutputDraftState = {
  selectedOutputFolder: string | null;
  includeCover: boolean;
  saveConditionJson: boolean;
};

export type CreatePdfCommonOptionDraftState = {
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
};

export type CreatePdfDifficultyDraftState = {
  isEnabled: boolean;
  isCalculated: boolean;
  ratios: [number, number];
};

export type CreatePdfDerivedMetaState = {
  lastAppliedDrawConditionKey: string | null;
  lastSavedOrRestoredTableKey: string | null;
};
```

## 7.3 `useWorkbookDraftStore`

```ts
export type WorkbookState = {
  basic: CreatePdfBasicDraftState;
  stepTwo: {
    workbookMode: WorkbookMode;
    options: CreatePdfCommonOptionDraftState;
    difficulty: CreatePdfDifficultyDraftState;
    categoryTable: WorkbookCategoryTableRow [];
  };
  table: {
    rows: TestTableRow[];
  };
  stepThree: CreatePdfOutputDraftState;
  meta: CreatePdfDerivedMetaState;
};

export type WorkbookDraftStore = WorkbookState & {
  actions: {
    setBasic: (patch: Partial<CreatePdfBasicDraftState>) => void;
    setOptions: (patch: Partial<CreatePdfCommonOptionDraftState>) => void;
    setDifficulty: (patch: Partial<CreatePdfDifficultyDraftState>) => void;
    setWorkbookMode: (value: WorkbookMode) => void;
    replaceCategoryConditions: (value: WorkbookCategoryTableRow[]) => void;
    replaceRows: (value: TestTableRow[]) => void;
    setStepThree: (patch: Partial<CreatePdfOutputDraftState>) => void;
    setMeta: (patch: Partial<CreatePdfDerivedMetaState>) => void;
    replaceDraft: (next: WorkbookState) => void;
    reset: () => void;
  };
};
```

#### 責務

- workbook mode の業務 state 正本
- Step1 / Step2 / Step3 / table / meta を 1 つの draft として保持
- persist 対象の基本単位になる

#### 持たないもの

- preview 健全性
- ダイアログ開閉
- `currentStep`
- draw / export command の進行状態

## 7.4 `useExamDraftStore`

```ts
export type ExamState = {
  basic: CreatePdfBasicDraftState;
  stepTwo: {
    options: CreatePdfCommonOptionDraftState;
    difficulty: CreatePdfDifficultyDraftState;
    categoryTable: ExamCategoryTableRow[];
  };
  table: {
    sections: TestTableSection[];
  };
  stepThree: CreatePdfOutputDraftState;
  meta: CreatePdfDerivedMetaState;
};

export type ExamDraftStore = ExamState & {
  actions: {
    setBasic: (patch: Partial<CreatePdfBasicDraftState>) => void;
    setOptions: (patch: Partial<CreatePdfCommonOptionDraftState>) => void;
    setDifficulty: (patch: Partial<CreatePdfDifficultyDraftState>) => void;
    replaceCategoryTableRows: (value: ExamCategoryTableRow[]) => void;
    replaceSections: (value: TestTableSection[]) => void;
    setStepThree: (patch: Partial<CreatePdfOutputDraftState>) => void;
    setMeta: (patch: Partial<CreatePdfDerivedMetaState>) => void;
    replaceDraft: (next: ExamState) => void;
    reset: () => void;
  };
};
```

#### 補足

`ExamCategoryTableRow` の詳細は T35 / T36 で詰める。  
今回の修正設計で重要なのは、exam も workbook と同じ ownership 原則で持つことだけである。

---

## 8. dirty 判定設計

## 8.1 dirty を 2 系統に分ける

### A. `hasUnappliedDrawConditions`

仕様書上の `未反映状態` に対応する導出値。  
現在の抽選条件と、最後に抽選へ反映した条件が違うかどうかを表す。

### B. `hasUnsavedTableChanges`

現在の問題テーブルと、最後に保存または復元したテーブルが違うかどうかを表す。  
こちらは保存確認や復元確認に使う。

## 8.2 dirty 比較用 key の考え方

`markDirty` は使わず、比較用の正規化 key を作る。

### workbook の draw condition key 対象

- `basic.grade`
- `stepTwo.workbookMode`
- `stepTwo.options`
- `stepTwo.difficulty`
- `stepTwo.categoryTable`

### exam の draw condition key 対象

- `basic.grade`
- `stepTwo.options`
- `stepTwo.difficulty`
- `stepTwo.categoryTable`

### table key 対象

- workbook: `table.rows`
- exam: `table.sections`

## 8.3 key の作り方

最初は hash である必要はない。  
安定した JSON 文字列で十分である。

```ts
export const createWorkbookDrawConditionKey = (
  draft: WorkbookState,
): string =>
  stableStringify({
    grade: draft.basic.grade,
    workbookMode: draft.stepTwo.workbookMode,
    options: normalizeCommonOptions(draft.stepTwo.options),
    difficulty: normalizeDifficulty(draft.stepTwo.difficulty),
    categoryTable: normalizeWorkbookCategoryTableRows(
      draft.stepTwo.categoryTable,
    ),
  });
```

## 8.4 derived selector

```ts
hasUnappliedDrawConditions =
  createWorkbookDrawConditionKey(draft) !== draft.meta.lastAppliedDrawConditionKey;

hasUnsavedTableChanges =
  createWorkbookTableKey(draft.table.rows) !== draft.meta.lastSavedOrRestoredTableKey;
```

---

## 9. hooks 設計

## 9.1 panel model を唯一の入口にする

画面ロジックの入口は panel model に集約する。

- `useExamPanelModel`
- `useWorkbookPanelModel`

`mainPanel.tsx` は今回の範囲では temporary adapter としてこれを読むだけにする。

## 9.2 `useCreatePdfStepOne`

Step1 の共通 use case を扱う shared hook。

```ts
export type CreatePdfStepOneAdapter = {
  basic: CreatePdfBasicDraftState;
  output: CreatePdfOutputDraftState;
  onTitleChange: (value: string) => void;
  onRequestGradeChange: (value: 1 | 2) => void;
  onRequestJsonLoad: () => void;
  onRequestReset: () => void;
};
```

#### 責務

- `BasicCondition` 用 props 組立
- `JsonLoadResetButtons` 用 props 組立
- Step1 共通 UI 契約の統一

#### 持たないもの

- ダイアログ state
- grade 変更 policy
- store selector

## 9.3 `useCreatePdfStepThree`

Step3 の共通 use case を扱う shared hook。

```ts
export type CreatePdfStepThreeAdapter<TPayload> = {
  output: CreatePdfOutputDraftState;
  previewHealth: CreatePdfPreviewHealth;
  hasUnappliedDrawConditions: boolean;
  hasUnsavedTableChanges: boolean;
  canExport: boolean;
  buildExportPayload: () => TPayload;
  executeExport: (payload: TPayload) => Promise<void>;
  onOutputChange: (patch: Partial<CreatePdfOutputDraftState>) => void;
};
```

#### 責務

- warning 判定
- warning 文言の共通化
- `ExportPdf` 用 props 組立
- 共通 export command 実行

#### 持たないもの

- persist 更新
- mode 別 payload 生成の詳細

#### 補足

`pdf view` への出力命令自体は共通でよい。  
ただし `buildExportPayload` は mode ごとに panel model 側で持つ。

## 9.4 `useWorkbookPanelModel`

```ts
return {
  stepOne,
  stepTwo,
  stepThree,
  derived: {
    hasUnappliedDrawConditions,
    hasUnsavedTableChanges,
  },
  dialogs: {
    gradeChange,
    reset,
    jsonLoad,
  },
  commands: {
    requestGradeChange,
    confirmGradeChange,
    cancelGradeChange,
    draw,
    redraw,
  },
};
```

#### 責務

- store selector の集約
- Step1 / Step2 / Step3 hooks の接続
- dialog と command の調停
- grade 変更 command
- workbook 用 payload builder 接続

## 9.5 `useExamPanelModel`

責務は `useWorkbookPanelModel` と同じ。  
差分は `stepTwo` と `buildExportPayload` のみ。

## 9.6 `useWorkbookStepTwo` / `useExamStepTwo`

Step2 の mode 固有ロジックを扱う。

#### `useWorkbookStepTwo` の責務

- `workbookMode` 更新
- category conditions 更新
- option / difficulty 更新
- table 更新
- draw / redraw 実行後の `lastAppliedDrawConditionKey` 更新

#### `useExamStepTwo` の責務

- exam frame conditions 更新
- option / difficulty 更新
- section table 更新
- draw / redraw 実行後の `lastAppliedDrawConditionKey` 更新

---

## 10. grade 変更 command の設計

## 10.1 なぜ `useEffect` ではなく command か

grade 変更は次を伴う。

- 確認ダイアログ
- 何を保持するか、何を初期化するかの切り分け
- JSON 復元や初回読み込みとの区別

`useEffect(() => reset(), [grade])` にすると、grade が変わった理由を区別できない。  
そのため、grade 変更は明示コマンドにする。

## 10.2 policy は純粋関数で表す

```ts
export const resetWorkbookForGradeChange = (
  current: WorkbookState,
  nextGrade: 1 | 2,
): WorkbookState => {
  const next: WorkbookState = {
    ...current,
    basic: {
      ...current.basic,
      grade: nextGrade,
    },
    stepTwo: {
      ...createInitialWorkbookStepTwoState(nextGrade),
      workbookMode: current.stepTwo.workbookMode,
    },
    table: {
      rows: [],
    },
    stepThree: current.stepThree,
    meta: {
      lastAppliedDrawConditionKey: null,
      lastSavedOrRestoredTableKey: null,
    },
  };

  return {
    ...next,
    meta: {
      lastAppliedDrawConditionKey: createWorkbookDrawConditionKey(next),
      lastSavedOrRestoredTableKey: createWorkbookTableKey(next.table.rows),
    },
  };
};
```

## 10.3 panel model からの呼び出し

```ts
const requestGradeChange = useCallback(
  (nextGrade: 1 | 2) => {
    if (nextGrade === draft.basic.grade) return;

    if (!hasChangesFromInitial) {
      replaceDraft(resetWorkbookForGradeChange(draft, nextGrade));
      return;
    }

    setPendingGrade(nextGrade);
    setGradeDialogOpen(true);
  },
  [draft, hasChangesFromInitial, replaceDraft],
);

const confirmGradeChange = useCallback(() => {
  if (pendingGrade == null) return;
  replaceDraft(
    resetWorkbookForGradeChange(
      useWorkbookDraftStore.getState(),
      pendingGrade,
    ),
  );
  setPendingGrade(null);
  setGradeDialogOpen(false);
}, [pendingGrade, replaceDraft]);
```

#### 保持するもの

- タイトル
- 出力先フォルダ
- workbook の問題形式

#### 初期化するもの

- 出題条件
- 難易度設定
- 問題テーブル
- 選出結果
- 行エラー表示
- preview 表示
- `未反映状態`

これは モード固定化仕様書（業務情報を含むため非公開） の `級変更時の挙動` に合わせる。

---

## 11. `mainPanel.tsx` の暫定接続方針

今回の範囲では `examPanel.tsx` / `workbookPanel.tsx` へ切り替えない。  
その代わり、`mainPanel.tsx` は temporary adapter として使う。

### 11.1 役割

- route mode を受け取る
- `useCreatePdfMainPanelModel` を呼ぶ
- 内部で `useExamPanelModel` / `useWorkbookPanelModel` を選ぶ
- 既存の最小 UI へ props を流す

### 11.2 重要な制約

- `mainPanel.tsx` 自身が業務 state を持たない
- `mainPanel.tsx` 自身が dirty 判定を持たない
- `mainPanel.tsx` 自身が grade 変更 reset を行わない
- ここで作る props 契約を、そのまま将来の `examPanel.tsx` / `workbookPanel.tsx` へ移せる形にする

---

## 12. store / hook ごとの責務一覧

| 名前 | 種別 | 責務 | 持たないもの |
|---|---|---|---|
| `useCreatePdfDockviewStore` | store | dockview API 保持 | 業務 state |
| `useCreatePdfViewStore` | store | route 共通 state と preview 健全性の公開正本 | preview snapshot 本体 |
| `useWorkbookDraftStore` | store | workbook の draft 正本 | dialog / command |
| `useExamDraftStore` | store | exam の draft 正本 | dialog / command |
| `useCreatePdfStepOne` | shared hook | Step1 共通 props / use case | store selector / dialog |
| `useCreatePdfStepThree` | shared hook | Step3 共通 warning / export command | persist 更新 |
| `useWorkbookStepTwo` | mode hook | workbook Step2 固有ロジック | preview runtime |
| `useExamStepTwo` | mode hook | exam Step2 固有ロジック | preview runtime |
| `useWorkbookPanelModel` | panel model | workbook panel の唯一の入口 | 直接 DOM 制御 |
| `useExamPanelModel` | panel model | exam panel の唯一の入口 | 直接 DOM 制御 |
| `useCreatePdfMainPanelModel` | temporary adapter | 現行 `mainPanel.tsx` 接続 | mode 固有ロジック本体 |

---

## 13. この設計での利点

### 13.1 復元単位と state 所有が一致する

`exam / workbook` それぞれが自分の draft を持つため、T29 の前回状態復元と整合しやすい。

### 13.2 Step1 / Step3 を意図的に共通化できる

共通 hook に寄せることで、保守の重複を減らせる。  
一方で state 所有は分かれているため、mode 混線は起きにくい。

### 13.3 Step2 の差分を無理に潰さない

Step2 を mode hook に閉じるため、exam と workbook の差分が自然に置ける。

### 13.4 `markDirty` を廃止できる

導出値で `未反映` を判定できるため、setter ごとの副作用注入を避けられる。

### 13.5 grade 変更の事故が減る

`useEffect` ではなく command にすることで、JSON 復元や初回読み込みとの競合を避けやすい。

---

## 14. 今回の範囲で触らないもの

- `examPanel.tsx` / `workbookPanel.tsx` への差し替え
- Step2 UI のコンポーネント詳細
- preview snapshot builder
- export payload builder の中身
- persist 実装

これらは後続タスクの責務として残す。

---

## 15. 実装時の注意

1. route mode を業務判断の正本にすること
2. store action に dialog や command を入れないこと
3. `hasUnappliedDrawConditions` と `hasUnsavedTableChanges` を混ぜないこと
4. grade 変更 reset を `useEffect` で書かないこと
5. `mainPanel.tsx` は temporary adapter と割り切ること

---

## 16. T01-T04 に対する最終整理

### T01

- route は現状どおり維持

### T02

- mode の正本は route
- `index.tsx` が snapshot 切替を統括

### T03

- 共通 store は runtime 専用に縮退
- dockview と preview のみ共有

### T04

- workbook を mode owned draft store として再定義
- exam も同じ原則で設計

以上により、T01-T04 の修正設計は、`共通 store 中心` から `mode owned draft + shared use case hook` 中心へ切り替える。
