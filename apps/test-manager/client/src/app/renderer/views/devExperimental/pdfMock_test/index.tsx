import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radioGroup';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { Separator } from '@ui/separator';
import Switch from '@ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/table';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

// ---- 型定義 ----

type OutputFormat = 'mockExam' | 'workbook';
type Grade = '1' | '2';
type TestType = 'qa' | 'qaCircle' | 'qaCross' | 'selection';

type SubjectInfo = {
  id: string;
  label: string;
  count: number;
};

type QuestionSlot = {
  id: string;
  subjectId: string;
  slotNo: number;
  selectedNo: string;
  choiceNo: string;
  isFixed: boolean;
  isPageBreak: boolean;
};

type CategoryGroup = {
  id: string;
  subject: string;
  largeCat: string;
  smallCat: string;
  count: number;
};

type TagExclusion = {
  id: string;
  label: string;
};

type DifficultyValues = {
  easy: number;
  medium: number;
  hard: number;
};

// ---- 定数 ----

const SUBJECTS_1: SubjectInfo[] = [
  { id: 'S1', label: '学科Ⅰ（計画）', count: 20 },
  { id: 'S2', label: '学科Ⅱ（環境・設備）', count: 20 },
  { id: 'S3', label: '学科Ⅲ（法規）', count: 30 },
  { id: 'S4', label: '学科Ⅳ（構造）', count: 30 },
  { id: 'S5', label: '学科Ⅴ（施工）', count: 25 },
];

const SUBJECTS_2: SubjectInfo[] = [
  { id: 'S1', label: '学科Ⅰ（建築計画）', count: 25 },
  { id: 'S2', label: '学科Ⅱ（建築法規）', count: 25 },
  { id: 'S3', label: '学科Ⅲ（建築構造）', count: 25 },
  { id: 'S4', label: '学科Ⅳ（建築施工）', count: 25 },
];

const PROBLEM_TYPE_OPTIONS: { value: TestType; label: string }[] = [
  { value: 'qa', label: '一問一答' },
  { value: 'qaCircle', label: '一問一答（回答が全て◯）' },
  { value: 'qaCross', label: '一問一答（回答が全て×）' },
  { value: 'selection', label: '選択問題' },
];

// ---- ユーティリティ ----

const createInitialSlots = (subjects: SubjectInfo[]): QuestionSlot[] => {
  const slots: QuestionSlot[] = [];
  for (const subject of subjects) {
    for (let i = 1; i <= subject.count; i++) {
      slots.push({
        id: `${subject.id}-${i}`,
        subjectId: subject.id,
        slotNo: i,
        selectedNo: '',
        choiceNo: '',
        isFixed: false,
        isPageBreak: false,
      });
    }
  }
  return slots;
};

// ---- サブコンポーネント ----

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
    {children}
  </p>
);

const UnreflectedBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text bg-warning-bg rounded px-2 py-0.5">
    <AlertTriangle className="size-3" />
    出題条件 未反映
  </span>
);

// ---- OptionsSection ----

type OptionsSectionProps = {
  shuffleEnabled: boolean;
  setShuffleEnabled: (v: boolean) => void;
  difficultyEnabled: boolean;
  setDifficultyEnabled: (v: boolean) => void;
  difficultyValues: DifficultyValues;
  setDifficultyValues: (v: DifficultyValues) => void;
  showShuffle?: boolean;
};

const OptionsSection = ({
  shuffleEnabled,
  setShuffleEnabled,
  difficultyEnabled,
  setDifficultyEnabled,
  difficultyValues,
  setDifficultyValues,
  showShuffle = true,
}: OptionsSectionProps) => {
  const baseId = useId();
  const shuffleId = `${baseId}-shuffle`;
  const difficultyId = `${baseId}-difficulty`;
  const total =
    difficultyValues.easy + difficultyValues.medium + difficultyValues.hard;
  return (
    <div className="space-y-3">
      <SectionLabel>オプション</SectionLabel>

      {showShuffle && (
        <div className="flex items-center gap-2">
          <Switch
            checked={shuffleEnabled}
            onCheckedChange={setShuffleEnabled}
            id={shuffleId}
          />
          <Label htmlFor={shuffleId} className="text-sm cursor-pointer">
            選択肢シャッフル
          </Label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          checked={difficultyEnabled}
          onCheckedChange={setDifficultyEnabled}
          id={difficultyId}
        />
        <Label htmlFor={difficultyId} className="text-sm cursor-pointer">
          難易度調整
        </Label>
      </div>

      {difficultyEnabled && (
        <div className="pl-4 space-y-2 border-l-2 border-border">
          {(
            [
              { key: 'easy', label: 'やさしい' },
              { key: 'medium', label: 'ふつう' },
              { key: 'hard', label: 'むずかしい' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground shrink-0">
                {label}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={difficultyValues[key]}
                onChange={(e) =>
                  setDifficultyValues({
                    ...difficultyValues,
                    [key]: Number(e.target.value),
                  })
                }
                className="flex-1 accent-primary"
              />
              <span className="w-8 text-right text-xs text-muted-foreground shrink-0">
                {difficultyValues[key]}%
              </span>
            </div>
          ))}
          <p
            className={`text-xs ${total === 100 ? 'text-muted-foreground' : 'text-error-text'}`}
          >
            合計: {total}%
            {total !== 100 && '（合計が100%になるよう調整してください）'}
          </p>
        </div>
      )}
    </div>
  );
};

// ---- MockExamCondition ----

type MockExamConditionProps = OptionsSectionProps & {
  subjects: SubjectInfo[];
};

const MockExamCondition = ({
  subjects,
  shuffleEnabled,
  setShuffleEnabled,
  difficultyEnabled,
  setDifficultyEnabled,
  difficultyValues,
  setDifficultyValues,
}: MockExamConditionProps) => (
  <div className="space-y-4">
    <div>
      <SectionLabel>出題数（学科別）</SectionLabel>
      <p className="text-xs text-muted-foreground mb-3">
        各問題枠のカテゴリ条件は、下の問題テーブルで直接設定します。
      </p>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead className="text-xs">学科</TableHead>
              <TableHead className="text-xs text-right">問数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm">{s.label}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {s.count} 問
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>

    <Separator />

    <OptionsSection
      shuffleEnabled={shuffleEnabled}
      setShuffleEnabled={setShuffleEnabled}
      difficultyEnabled={difficultyEnabled}
      setDifficultyEnabled={setDifficultyEnabled}
      difficultyValues={difficultyValues}
      setDifficultyValues={setDifficultyValues}
    />
  </div>
);

// ---- WorkbookCondition ----

type WorkbookConditionProps = OptionsSectionProps & {
  testType: TestType;
  setTestType: (v: TestType) => void;
  tagExclusions: TagExclusion[];
  newTagInput: string;
  setNewTagInput: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (id: string) => void;
  categoryGroups: CategoryGroup[];
  onAddCategoryGroup: () => void;
  onRemoveCategoryGroup: (id: string) => void;
  onCategoryGroupChange: (
    id: string,
    field: keyof CategoryGroup,
    value: string | number,
  ) => void;
};

const WorkbookCondition = ({
  testType,
  setTestType,
  tagExclusions,
  newTagInput,
  setNewTagInput,
  onAddTag,
  onRemoveTag,
  categoryGroups,
  onAddCategoryGroup,
  onRemoveCategoryGroup,
  onCategoryGroupChange,
  shuffleEnabled,
  setShuffleEnabled,
  difficultyEnabled,
  setDifficultyEnabled,
  difficultyValues,
  setDifficultyValues,
}: WorkbookConditionProps) => (
  <div className="space-y-4">
    {/* 問題形式 */}
    <div>
      <SectionLabel>問題種別</SectionLabel>
      <RadioGroup
        value={testType}
        onValueChange={(v) => setTestType(v as TestType)}
        className="space-y-1.5"
      >
        {PROBLEM_TYPE_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <RadioGroupItem value={opt.value} id={`type-${opt.value}`} />
            <Label
              htmlFor={`type-${opt.value}`}
              className="text-sm cursor-pointer"
            >
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>

    <Separator />

    {/* タグ除外条件 */}
    <div>
      <SectionLabel>タグ除外条件</SectionLabel>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
        {tagExclusions.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            （除外タグなし）
          </span>
        ) : (
          tagExclusions.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-full px-2.5 py-1"
            >
              {tag.label}
              <button
                type="button"
                onClick={() => onRemoveTag(tag.id)}
                className="text-muted-foreground hover:text-error-text transition-colors"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          placeholder="タグ名を入力して追加"
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === 'Enter' && onAddTag()}
        />
        <Button variant="outline" size="sm" onClick={onAddTag}>
          追加
        </Button>
      </div>
    </div>

    <Separator />

    {/* カテゴリグループ選択 */}
    <div>
      <SectionLabel>カテゴリグループ選択</SectionLabel>
      {categoryGroups.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          出題するカテゴリと問題数を追加してください
        </p>
      )}
      <div className="space-y-2">
        {categoryGroups.map((group, idx) => (
          <div
            key={group.id}
            className="flex items-center gap-2 rounded-md border border-border p-2 bg-background"
          >
            <span className="text-xs text-muted-foreground w-4 shrink-0 text-center">
              {idx + 1}
            </span>
            <Select
              value={group.subject}
              onValueChange={(v) =>
                onCategoryGroupChange(group.id, 'subject', v)
              }
            >
              <SelectTrigger className="h-8 text-xs w-28 shrink-0">
                <SelectValue placeholder="学科" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="S1">学科Ⅰ</SelectItem>
                  <SelectItem value="S2">学科Ⅱ</SelectItem>
                  <SelectItem value="S3">学科Ⅲ</SelectItem>
                  <SelectItem value="S4">学科Ⅳ</SelectItem>
                  <SelectItem value="S5">学科Ⅴ</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              value={group.largeCat}
              onChange={(e) =>
                onCategoryGroupChange(group.id, 'largeCat', e.target.value)
              }
              placeholder="大分類"
              className="h-8 text-xs w-24 shrink-0"
            />
            <Input
              value={group.smallCat}
              onChange={(e) =>
                onCategoryGroupChange(group.id, 'smallCat', e.target.value)
              }
              placeholder="小分類"
              className="h-8 text-xs w-24 shrink-0"
            />
            <Input
              value={String(group.count)}
              onChange={(e) =>
                onCategoryGroupChange(
                  group.id,
                  'count',
                  Number(e.target.value) || 0,
                )
              }
              placeholder="問数"
              className="h-8 text-xs w-16 shrink-0"
              type="number"
              min={1}
            />
            <button
              type="button"
              onClick={() => onRemoveCategoryGroup(group.id)}
              className="text-muted-foreground hover:text-error-text transition-colors ml-auto shrink-0"
              aria-label="削除"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onAddCategoryGroup}
        className="mt-2 flex items-center gap-1"
      >
        <Plus className="size-3.5" />
        カテゴリを追加
      </Button>
    </div>

    <Separator />

    <OptionsSection
      shuffleEnabled={shuffleEnabled}
      setShuffleEnabled={setShuffleEnabled}
      difficultyEnabled={difficultyEnabled}
      setDifficultyEnabled={setDifficultyEnabled}
      difficultyValues={difficultyValues}
      setDifficultyValues={setDifficultyValues}
      showShuffle={testType === 'selection'}
    />
  </div>
);

// ---- TestTable ----

type TestTableProps = {
  subjects: SubjectInfo[];
  outputFormat: OutputFormat;
  testType: TestType;
  slotsBySubject: (subjectId: string) => QuestionSlot[];
  expandedSubjects: Set<string>;
  onToggleExpand: (subjectId: string) => void;
  onSlotChange: (
    id: string,
    field: keyof QuestionSlot,
    value: string | boolean,
  ) => void;
};

const TestTable = ({
  subjects,
  outputFormat,
  testType,
  slotsBySubject,
  expandedSubjects,
  onToggleExpand,
  onSlotChange,
}: TestTableProps) => {
  const showChoiceNo = outputFormat === 'workbook' && testType !== 'selection';
  return (
    <div className="space-y-2">
      {subjects.map((subject) => {
        const slots = slotsBySubject(subject.id);
        const isExpanded = expandedSubjects.has(subject.id);
        const filledCount = slots.filter((s) => s.selectedNo !== '').length;
        return (
          <div
            key={subject.id}
            className="border border-border rounded-md overflow-hidden"
          >
            {/* 学科ヘッダー */}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-secondary/50 hover:bg-secondary transition-colors text-left"
              onClick={() => onToggleExpand(subject.id)}
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium flex-1">
                {subject.label}
              </span>
              <span
                className={`text-xs ${filledCount === subject.count ? 'text-success-text' : 'text-muted-foreground'}`}
              >
                {filledCount} / {subject.count} 問選出済み
              </span>
            </button>

            {/* 問題行テーブル */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background">
                      <TableHead className="text-xs w-12">問</TableHead>
                      <TableHead className="text-xs">選択番号</TableHead>
                      {showChoiceNo && (
                        <TableHead className="text-xs">選択肢番号</TableHead>
                      )}
                      <TableHead className="text-xs text-center w-16">
                        固定
                      </TableHead>
                      <TableHead className="text-xs text-center w-20">
                        強制改ページ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          問{slot.slotNo}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={slot.selectedNo}
                            onChange={(e) =>
                              onSlotChange(
                                slot.id,
                                'selectedNo',
                                e.target.value,
                              )
                            }
                            placeholder="---"
                            className="h-7 w-20 text-xs"
                          />
                        </TableCell>
                        {showChoiceNo && (
                          <TableCell>
                            <Input
                              value={slot.choiceNo}
                              onChange={(e) =>
                                onSlotChange(
                                  slot.id,
                                  'choiceNo',
                                  e.target.value,
                                )
                              }
                              placeholder="---"
                              className="h-7 w-20 text-xs"
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Checkbox
                            checked={slot.isFixed}
                            onCheckedChange={(v) =>
                              onSlotChange(slot.id, 'isFixed', Boolean(v))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={slot.isPageBreak}
                            onCheckedChange={(v) =>
                              onSlotChange(slot.id, 'isPageBreak', Boolean(v))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---- メインコンポーネント ----

const PdfMockTest = () => {
  // 基本条件
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mockExam');
  const [grade, setGrade] = useState<Grade>('1');
  const [title, setTitle] = useState('');
  const [isUnreflected, setIsUnreflected] = useState(false);

  // オプション（両モード共通）
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [difficultyEnabled, setDifficultyEnabled] = useState(false);
  const [difficultyValues, setDifficultyValues] = useState<DifficultyValues>({
    easy: 33,
    medium: 34,
    hard: 33,
  });

  // 問題集作成モード固有
  const [testType, setTestType] = useState<TestType>('qa');
  const [tagExclusions, setTagExclusions] = useState<TagExclusion[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // 問題テーブル
  const subjects = grade === '1' ? SUBJECTS_1 : SUBJECTS_2;
  const [slots, setSlots] = useState<QuestionSlot[]>(() =>
    createInitialSlots(subjects),
  );
  const [tableGenerated, setTableGenerated] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(['S1']),
  );

  // 出力先フォルダ（モック固定値）
  const outputFolder = 'C:\\Users\\user\\Documents';

  const handleGradeChange = (v: Grade) => {
    setGrade(v);
    const newSubjects = v === '1' ? SUBJECTS_1 : SUBJECTS_2;
    setSlots(createInitialSlots(newSubjects));
    setTableGenerated(false);
  };

  const handleOutputFormatChange = (format: OutputFormat) => {
    setOutputFormat(format);
    setTableGenerated(false);
    setIsUnreflected(false);
  };

  const handleLottery = () => {
    setSlots((prev) =>
      prev.map((slot) => ({
        ...slot,
        selectedNo:
          slot.isFixed && slot.selectedNo !== ''
            ? slot.selectedNo
            : String(Math.floor(Math.random() * 500) + 1),
        choiceNo:
          slot.isFixed && slot.choiceNo !== ''
            ? slot.choiceNo
            : String(Math.floor(Math.random() * 4) + 1),
      })),
    );
    setTableGenerated(true);
    setIsUnreflected(false);
  };

  const handleSlotChange = (
    id: string,
    field: keyof QuestionSlot,
    value: string | boolean,
  ) => {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== id) return slot;
        if (
          (field === 'selectedNo' || field === 'choiceNo') &&
          typeof value === 'string'
        ) {
          return {
            ...slot,
            [field]: value,
            isFixed: value !== '' ? true : slot.isFixed,
          };
        }
        return { ...slot, [field]: value };
      }),
    );
  };

  const toggleSubjectExpand = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleAddCategoryGroup = () => {
    setCategoryGroups((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        subject: '',
        largeCat: '',
        smallCat: '',
        count: 10,
      },
    ]);
    setIsUnreflected(true);
  };

  const handleRemoveCategoryGroup = (id: string) => {
    setCategoryGroups((prev) => prev.filter((g) => g.id !== id));
    setIsUnreflected(true);
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    setTagExclusions((prev) => [
      ...prev,
      { id: String(Date.now()), label: trimmed },
    ]);
    setNewTagInput('');
    setIsUnreflected(true);
  };

  const handleRemoveTag = (id: string) => {
    setTagExclusions((prev) => prev.filter((t) => t.id !== id));
    setIsUnreflected(true);
  };

  const slotsBySubject = (subjectId: string) =>
    slots.filter((s) => s.subjectId === subjectId);

  const canOutputPdf =
    tableGenerated && slots.every((s) => s.selectedNo !== '');

  const lotteryDisabled =
    outputFormat === 'workbook' && categoryGroups.length === 0;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* ① 基本条件選択 */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          ① 基本条件
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {/* 出力形式トグル */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                outputFormat === 'mockExam'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-foreground hover:bg-secondary'
              }`}
              onClick={() => handleOutputFormatChange('mockExam')}
            >
              模擬試験作成
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                outputFormat === 'workbook'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-foreground hover:bg-secondary'
              }`}
              onClick={() => handleOutputFormatChange('workbook')}
            >
              問題集作成
            </button>
          </div>

          {/* 級 */}
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-sm font-medium whitespace-nowrap">級</Label>
            <Select
              value={grade}
              onValueChange={(v) => handleGradeChange(v as Grade)}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">1級</SelectItem>
                  <SelectItem value="2">2級</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* タイトル */}
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Label className="text-sm font-medium whitespace-nowrap">
              タイトル
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 令和8年度 模擬試験"
              className="h-9"
            />
          </div>

          {/* JSON操作 */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Button variant="outline" size="sm">
              JSON保存
            </Button>
            <Button variant="outline" size="sm">
              JSON読込
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* ② 出題条件 */}
        <div className="flex-1 border border-border rounded-lg p-4 bg-card min-w-0 overflow-y-auto max-h-[70vh]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            ② 出題条件
          </p>
          {outputFormat === 'mockExam' ? (
            <MockExamCondition
              subjects={subjects}
              shuffleEnabled={shuffleEnabled}
              setShuffleEnabled={setShuffleEnabled}
              difficultyEnabled={difficultyEnabled}
              setDifficultyEnabled={setDifficultyEnabled}
              difficultyValues={difficultyValues}
              setDifficultyValues={setDifficultyValues}
            />
          ) : (
            <WorkbookCondition
              testType={testType}
              setTestType={(v) => {
                setTestType(v);
                setIsUnreflected(true);
              }}
              tagExclusions={tagExclusions}
              newTagInput={newTagInput}
              setNewTagInput={setNewTagInput}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              categoryGroups={categoryGroups}
              onAddCategoryGroup={handleAddCategoryGroup}
              onRemoveCategoryGroup={handleRemoveCategoryGroup}
              onCategoryGroupChange={(id, field, value) => {
                setCategoryGroups((prev) =>
                  prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)),
                );
                setIsUnreflected(true);
              }}
              shuffleEnabled={shuffleEnabled}
              setShuffleEnabled={setShuffleEnabled}
              difficultyEnabled={difficultyEnabled}
              setDifficultyEnabled={setDifficultyEnabled}
              difficultyValues={difficultyValues}
              setDifficultyValues={setDifficultyValues}
            />
          )}
        </div>

        {/* プレビューパネル */}
        <div className="w-64 border border-border rounded-lg p-4 bg-card shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              プレビュー
            </p>
            <Button variant="ghost" size="sm" disabled={!tableGenerated}>
              更新
            </Button>
          </div>
          <div className="bg-secondary rounded-lg flex flex-col items-center justify-center h-80 text-muted-foreground text-xs text-center gap-2 px-4">
            {tableGenerated ? (
              <>
                <span className="text-3xl">📄</span>
                <p className="leading-relaxed">
                  「更新」ボタンを押すと
                  <br />
                  プレビューが表示されます
                </p>
              </>
            ) : (
              <>
                <span className="text-3xl">📋</span>
                <p className="leading-relaxed">
                  抽選を実行すると
                  <br />
                  プレビューが利用可能になります
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ③ 問題テーブル */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              ③ 問題テーブル
            </p>
            {isUnreflected && <UnreflectedBadge />}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLottery}
            disabled={lotteryDisabled}
            className="flex items-center gap-1"
          >
            <RefreshCw className="size-3.5" />
            {tableGenerated ? '再抽選' : '抽選'}
          </Button>
        </div>

        {!tableGenerated && outputFormat === 'workbook' ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            カテゴリグループを設定して「抽選」を実行すると、問題テーブルが生成されます
          </div>
        ) : (
          <TestTable
            subjects={subjects}
            outputFormat={outputFormat}
            testType={testType}
            slotsBySubject={slotsBySubject}
            expandedSubjects={expandedSubjects}
            onToggleExpand={toggleSubjectExpand}
            onSlotChange={handleSlotChange}
          />
        )}
      </div>

      {/* ④ PDF出力 */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          ④ PDF出力
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Label className="text-sm font-medium whitespace-nowrap shrink-0">
              出力先フォルダ
            </Label>
            <span className="text-sm text-muted-foreground truncate flex-1">
              {outputFolder}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 flex items-center gap-1"
            >
              <FolderOpen className="size-3.5" />
              変更
            </Button>
          </div>
          <Separator orientation="vertical" className="h-8 shrink-0" />
          <Button variant="primary" size="md" disabled={!canOutputPdf}>
            PDF出力
          </Button>
        </div>
        {!tableGenerated && (
          <p className="text-xs text-muted-foreground mt-2">
            ※ 抽選を実行し、全ての問題枠が確定するとPDF出力が有効になります
          </p>
        )}
      </div>
    </div>
  );
};

export default PdfMockTest;
