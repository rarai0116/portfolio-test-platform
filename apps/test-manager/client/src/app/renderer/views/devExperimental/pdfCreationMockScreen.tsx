import BasicCreatableSelect from '@components/organism/basicCreatableSelect';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/accordion';
import { Button } from '@ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ui/card';
import { Checkbox } from '@ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog';
import { Input } from '@ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import Switch from '@ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { FolderOpen, Layers3, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import './pdfCreationMock.css';

type CreationType = 'mockExam' | 'workbook';
type Grade = 'firstGrade' | 'secondGrade';
type WorkbookMode = 'qaa' | 'allCircle' | 'allCross' | 'choice';

type TestTableRow = {
  id: string;
  rowLabel: string;
  categoryLabel: string;
  selectedNo: string;
  qaaChoiceIndex?: string;
  isFixed?: boolean;
  forcePageBreakBefore?: boolean;
};

type TestTableGroup = {
  id: string;
  label: string;
  helper: string;
  remainingCount: number;
  rows: TestTableRow[];
};

type MockExamTemplateRow = {
  id: string;
  rowLabel: string;
  categories: string[];
};

type MockExamTemplateGroup = {
  id: string;
  label: string;
  totalCount: number;
  remainingCount: number;
  rows: MockExamTemplateRow[];
};

type GroupPickerDraft = {
  checked: boolean;
  count: string;
};

type GroupPickerItem = {
  id: string;
  bigCategory: string;
  smallCategory: string;
  defaultCount: number;
};

type GroupPickerSection = {
  id: string;
  label: string;
  items: GroupPickerItem[];
};

const gradeLabels: Record<Grade, string> = {
  firstGrade: '1級',
  secondGrade: '2級',
};

const workbookModeLabels: Record<WorkbookMode, string> = {
  qaa: '一問一答',
  allCircle: '一問一答（回答が全て◯）',
  allCross: '一問一答（回答が全て×）',
  choice: '選択問題',
};

/*
const workbookHints: Record<WorkbookMode, string> = {
  qaa: '一問一答化可能な問題だけを候補にし、選択肢番号も手動で調整する前提です。',
  allCircle: '表示上の解答がすべて◯になる一問一答のみを候補にする前提です。',
  allCross: '表示上の解答がすべて×になる一問一答のみを候補にする前提です。',
  choice: '元の選択問題をそのまま出力するモードとして扱います。',
};
*/

const excludeTagOptions = [
  { value: 'オリジナル限定', label: 'オリジナル限定' },
  { value: '頻出', label: '頻出' },
  { value: '要復習', label: '要復習' },
  { value: '図表多め', label: '図表多め' },
];

const workbookGroupPickerSections: GroupPickerSection[] = [
  {
    id: 'picker-plan',
    label: '建築計画',
    items: [
      {
        id: 'picker-plan-city',
        bigCategory: '建築計画',
        smallCategory: '都市計画',
        defaultCount: 6,
      },
      {
        id: 'picker-plan-estimate',
        bigCategory: '建築計画',
        smallCategory: '建築積算',
        defaultCount: 4,
      },
    ],
  },
  {
    id: 'picker-environment',
    label: '環境・設備',
    items: [
      {
        id: 'picker-environment-heat',
        bigCategory: '環境・設備',
        smallCategory: '熱環境',
        defaultCount: 5,
      },
      {
        id: 'picker-environment-ventilation',
        bigCategory: '環境・設備',
        smallCategory: '換気設備',
        defaultCount: 6,
      },
    ],
  },
  {
    id: 'picker-law',
    label: '法規',
    items: [
      {
        id: 'picker-law-evacuation',
        bigCategory: '法規',
        smallCategory: '防火避難',
        defaultCount: 5,
      },
      {
        id: 'picker-law-collective',
        bigCategory: '法規',
        smallCategory: '集団規定',
        defaultCount: 4,
      },
    ],
  },
  {
    id: 'picker-construction',
    label: '建築施工',
    items: [
      {
        id: 'picker-construction-quality',
        bigCategory: '建築施工',
        smallCategory: '品質管理',
        defaultCount: 6,
      },
      {
        id: 'picker-construction-safety',
        bigCategory: '建築施工',
        smallCategory: '安全管理',
        defaultCount: 5,
      },
    ],
  },
];

const createDefaultGroupPickerDrafts = (): Record<string, GroupPickerDraft> => {
  return Object.fromEntries(
    workbookGroupPickerSections.flatMap((section) =>
      section.items.map((item) => [
        item.id,
        {
          checked: false,
          count: `${item.defaultCount}`,
        },
      ]),
    ),
  );
};

const parseQuestionCountFromHelper = (helper: string) => {
  const matched = helper.match(/(\d+)問/);
  return matched ? Number(matched[1]) : 0;
};

const toDisplayNo = (
  selectedNo: string,
  groupIndex: number,
  rowIndex: number,
) => {
  if (/^\d+$/.test(selectedNo)) return selectedNo;
  return String((groupIndex + 1) * 10 + rowIndex);
};

const createWorkbookCustomGroups = (
  drafts: Record<string, GroupPickerDraft>,
  workbookMode: WorkbookMode,
) => {
  const showChoiceIndex = workbookMode !== 'choice';

  return workbookGroupPickerSections.flatMap((section, sectionIndex) =>
    section.items.flatMap((item, itemIndex) => {
      const draft = drafts[item.id];
      if (!draft?.checked) return [];

      const requestedCount = Math.max(Number(draft.count) || 0, 1);
      const visibleRowCount = Math.min(requestedCount, 4);
      const rows: TestTableRow[] = Array.from(
        { length: visibleRowCount },
        (_, rowIndex) => ({
          id: `${item.id}-${rowIndex + 1}`,
          rowLabel: `問${String(rowIndex + 1).padStart(2, '0')}`,
          categoryLabel: `${item.bigCategory} / ${item.smallCategory}`,
          selectedNo: `${(sectionIndex + 6) * 10 + itemIndex * 4 + rowIndex}`,
          qaaChoiceIndex: showChoiceIndex ? `${(rowIndex % 4) + 1}` : undefined,
          isFixed: rowIndex === 0,
          forcePageBreakBefore:
            rowIndex === visibleRowCount - 1 && visibleRowCount > 2,
        }),
      );

      return [
        {
          id: item.id,
          label: `${item.bigCategory} / ${item.smallCategory}`,
          helper: `指定${requestedCount}問 / ${workbookModeLabels[workbookMode]}`,
          remainingCount: Math.max(requestedCount - visibleRowCount, 0),
          rows,
        },
      ];
    }),
  );
};

const mockExamGroupsByGrade: Record<Grade, TestTableGroup[]> = {
  firstGrade: [
    {
      id: 'first-plan',
      label: '学科Ⅰ（計画）',
      helper: '既定20問 / カテゴリ複数指定',
      remainingCount: 16,
      rows: [
        {
          id: 'first-plan-01',
          rowLabel: '問01',
          categoryLabel: '計画 / 建築計画',
          selectedNo: '1-014',
          isFixed: true,
        },
        {
          id: 'first-plan-02',
          rowLabel: '問02',
          categoryLabel: '計画 / 建築史',
          selectedNo: '1-021',
        },
        {
          id: 'first-plan-03',
          rowLabel: '問03',
          categoryLabel: '計画 / 都市計画',
          selectedNo: '1-033',
        },
        {
          id: 'first-plan-04',
          rowLabel: '問04',
          categoryLabel: '計画 / 建築積算',
          selectedNo: '1-041',
          forcePageBreakBefore: true,
        },
      ],
    },
    {
      id: 'first-environment',
      label: '学科Ⅱ（環境・設備）',
      helper: '既定20問 / カテゴリ複数指定',
      remainingCount: 16,
      rows: [
        {
          id: 'first-environment-01',
          rowLabel: '問01',
          categoryLabel: '環境・設備 / 日照・採光',
          selectedNo: '1-105',
        },
        {
          id: 'first-environment-02',
          rowLabel: '問02',
          categoryLabel: '環境・設備 / 空気調和',
          selectedNo: '1-112',
          forcePageBreakBefore: true,
        },
        {
          id: 'first-environment-03',
          rowLabel: '問03',
          categoryLabel: '環境・設備 / 給排水衛生',
          selectedNo: '1-118',
          isFixed: true,
        },
        {
          id: 'first-environment-04',
          rowLabel: '問04',
          categoryLabel: '環境・設備 / 電気設備',
          selectedNo: '1-124',
        },
      ],
    },
    {
      id: 'first-law',
      label: '学科Ⅲ（法規）',
      helper: '既定30問 / カテゴリ複数指定',
      remainingCount: 26,
      rows: [
        {
          id: 'first-law-01',
          rowLabel: '問01',
          categoryLabel: '法規 / 建築基準法',
          selectedNo: '1-201',
          isFixed: true,
        },
        {
          id: 'first-law-02',
          rowLabel: '問02',
          categoryLabel: '法規 / 関係法令',
          selectedNo: '1-208',
        },
        {
          id: 'first-law-03',
          rowLabel: '問03',
          categoryLabel: '法規 / 防火区画',
          selectedNo: '1-214',
        },
        {
          id: 'first-law-04',
          rowLabel: '問04',
          categoryLabel: '法規 / 建築協定',
          selectedNo: '1-223',
        },
      ],
    },
    {
      id: 'first-structure',
      label: '学科Ⅳ（構造）',
      helper: '既定30問 / カテゴリ複数指定',
      remainingCount: 26,
      rows: [
        {
          id: 'first-structure-01',
          rowLabel: '問01',
          categoryLabel: '構造 / 構造力学',
          selectedNo: '1-302',
        },
        {
          id: 'first-structure-02',
          rowLabel: '問02',
          categoryLabel: '構造 / 各種構造',
          selectedNo: '1-317',
          forcePageBreakBefore: true,
        },
        {
          id: 'first-structure-03',
          rowLabel: '問03',
          categoryLabel: '構造 / 建築材料',
          selectedNo: '1-324',
          isFixed: true,
        },
        {
          id: 'first-structure-04',
          rowLabel: '問04',
          categoryLabel: '構造 / 基礎構造',
          selectedNo: '1-331',
        },
      ],
    },
    {
      id: 'first-construction',
      label: '学科Ⅴ（施工）',
      helper: '既定25問 / カテゴリ複数指定',
      remainingCount: 21,
      rows: [
        {
          id: 'first-construction-01',
          rowLabel: '問01',
          categoryLabel: '施工 / 仮設・工程',
          selectedNo: '1-401',
        },
        {
          id: 'first-construction-02',
          rowLabel: '問02',
          categoryLabel: '施工 / 施工管理',
          selectedNo: '1-419',
          isFixed: true,
        },
        {
          id: 'first-construction-03',
          rowLabel: '問03',
          categoryLabel: '施工 / 品質管理',
          selectedNo: '1-424',
        },
        {
          id: 'first-construction-04',
          rowLabel: '問04',
          categoryLabel: '施工 / 安全管理',
          selectedNo: '1-431',
        },
      ],
    },
  ],
  secondGrade: [
    {
      id: 'second-plan',
      label: '学科Ⅰ（建築計画）',
      helper: '既定25問 / カテゴリ複数指定',
      remainingCount: 21,
      rows: [
        {
          id: 'second-plan-01',
          rowLabel: '問01',
          categoryLabel: '建築計画 / 計画原論',
          selectedNo: '2-011',
          isFixed: true,
        },
        {
          id: 'second-plan-02',
          rowLabel: '問02',
          categoryLabel: '建築計画 / 各種建築物',
          selectedNo: '2-016',
        },
        {
          id: 'second-plan-03',
          rowLabel: '問03',
          categoryLabel: '建築計画 / 建築史',
          selectedNo: '2-021',
        },
        {
          id: 'second-plan-04',
          rowLabel: '問04',
          categoryLabel: '建築計画 / 都市計画',
          selectedNo: '2-028',
        },
      ],
    },
    {
      id: 'second-law',
      label: '学科Ⅱ（建築法規）',
      helper: '既定25問 / カテゴリ複数指定',
      remainingCount: 21,
      rows: [
        {
          id: 'second-law-01',
          rowLabel: '問01',
          categoryLabel: '建築法規 / 建築基準法',
          selectedNo: '2-101',
        },
        {
          id: 'second-law-02',
          rowLabel: '問02',
          categoryLabel: '建築法規 / 関係法令',
          selectedNo: '2-115',
        },
        {
          id: 'second-law-03',
          rowLabel: '問03',
          categoryLabel: '建築法規 / 集団規定',
          selectedNo: '2-121',
          isFixed: true,
        },
        {
          id: 'second-law-04',
          rowLabel: '問04',
          categoryLabel: '建築法規 / 防火避難',
          selectedNo: '2-127',
        },
      ],
    },
    {
      id: 'second-structure',
      label: '学科Ⅲ（建築構造）',
      helper: '既定25問 / カテゴリ複数指定',
      remainingCount: 21,
      rows: [
        {
          id: 'second-structure-01',
          rowLabel: '問01',
          categoryLabel: '建築構造 / 構造力学',
          selectedNo: '2-205',
          forcePageBreakBefore: true,
        },
        {
          id: 'second-structure-02',
          rowLabel: '問02',
          categoryLabel: '建築構造 / 鉄筋コンクリート',
          selectedNo: '2-214',
        },
        {
          id: 'second-structure-03',
          rowLabel: '問03',
          categoryLabel: '建築構造 / 木構造',
          selectedNo: '2-221',
          isFixed: true,
        },
        {
          id: 'second-structure-04',
          rowLabel: '問04',
          categoryLabel: '建築構造 / 地盤基礎',
          selectedNo: '2-228',
        },
      ],
    },
    {
      id: 'second-construction',
      label: '学科Ⅳ（建築施工）',
      helper: '既定25問 / カテゴリ複数指定',
      remainingCount: 21,
      rows: [
        {
          id: 'second-construction-01',
          rowLabel: '問01',
          categoryLabel: '建築施工 / 躯体工事',
          selectedNo: '2-304',
        },
        {
          id: 'second-construction-02',
          rowLabel: '問02',
          categoryLabel: '建築施工 / 施工管理',
          selectedNo: '2-321',
          isFixed: true,
        },
        {
          id: 'second-construction-03',
          rowLabel: '問03',
          categoryLabel: '建築施工 / 仕上工事',
          selectedNo: '2-326',
        },
        {
          id: 'second-construction-04',
          rowLabel: '問04',
          categoryLabel: '建築施工 / 安全管理',
          selectedNo: '2-333',
        },
      ],
    },
  ],
};

const mockExamTemplateGroupsByGrade: Record<Grade, MockExamTemplateGroup[]> = {
  firstGrade: [
    {
      id: 'first-template-plan',
      label: '学科Ⅰ（計画）',
      totalCount: 20,
      remainingCount: 16,
      rows: [
        {
          id: 'first-template-plan-01',
          rowLabel: '問01',
          categories: ['計画 / 建築計画', '計画 / 建築史'],
        },
        {
          id: 'first-template-plan-02',
          rowLabel: '問02',
          categories: ['計画 / 都市計画'],
        },
        {
          id: 'first-template-plan-03',
          rowLabel: '問03',
          categories: ['計画 / 建築積算', '計画 / 建築計画'],
        },
        {
          id: 'first-template-plan-04',
          rowLabel: '問04',
          categories: ['計画 / 建築史'],
        },
      ],
    },
    {
      id: 'first-template-environment',
      label: '学科Ⅱ（環境・設備）',
      totalCount: 20,
      remainingCount: 16,
      rows: [
        {
          id: 'first-template-environment-01',
          rowLabel: '問01',
          categories: ['環境・設備 / 日照・採光'],
        },
        {
          id: 'first-template-environment-02',
          rowLabel: '問02',
          categories: ['環境・設備 / 空気調和', '環境・設備 / 給排水衛生'],
        },
        {
          id: 'first-template-environment-03',
          rowLabel: '問03',
          categories: ['環境・設備 / 電気設備'],
        },
        {
          id: 'first-template-environment-04',
          rowLabel: '問04',
          categories: ['環境・設備 / 日照・採光', '環境・設備 / 空気調和'],
        },
      ],
    },
    {
      id: 'first-template-law',
      label: '学科Ⅲ（法規）',
      totalCount: 30,
      remainingCount: 26,
      rows: [
        {
          id: 'first-template-law-01',
          rowLabel: '問01',
          categories: ['法規 / 建築基準法'],
        },
        {
          id: 'first-template-law-02',
          rowLabel: '問02',
          categories: ['法規 / 関係法令', '法規 / 集団規定'],
        },
        {
          id: 'first-template-law-03',
          rowLabel: '問03',
          categories: ['法規 / 防火区画'],
        },
        {
          id: 'first-template-law-04',
          rowLabel: '問04',
          categories: ['法規 / 建築協定'],
        },
      ],
    },
    {
      id: 'first-template-structure',
      label: '学科Ⅳ（構造）',
      totalCount: 30,
      remainingCount: 26,
      rows: [
        {
          id: 'first-template-structure-01',
          rowLabel: '問01',
          categories: ['構造 / 構造力学'],
        },
        {
          id: 'first-template-structure-02',
          rowLabel: '問02',
          categories: ['構造 / 各種構造', '構造 / 建築材料'],
        },
        {
          id: 'first-template-structure-03',
          rowLabel: '問03',
          categories: ['構造 / 基礎構造'],
        },
        {
          id: 'first-template-structure-04',
          rowLabel: '問04',
          categories: ['構造 / 構造力学', '構造 / 各種構造'],
        },
      ],
    },
    {
      id: 'first-template-construction',
      label: '学科Ⅴ（施工）',
      totalCount: 25,
      remainingCount: 21,
      rows: [
        {
          id: 'first-template-construction-01',
          rowLabel: '問01',
          categories: ['施工 / 仮設・工程'],
        },
        {
          id: 'first-template-construction-02',
          rowLabel: '問02',
          categories: ['施工 / 施工管理', '施工 / 品質管理'],
        },
        {
          id: 'first-template-construction-03',
          rowLabel: '問03',
          categories: ['施工 / 安全管理'],
        },
        {
          id: 'first-template-construction-04',
          rowLabel: '問04',
          categories: ['施工 / 品質管理'],
        },
      ],
    },
  ],
  secondGrade: [
    {
      id: 'second-template-plan',
      label: '学科Ⅰ（建築計画）',
      totalCount: 25,
      remainingCount: 21,
      rows: [
        {
          id: 'second-template-plan-01',
          rowLabel: '問01',
          categories: ['建築計画 / 計画原論'],
        },
        {
          id: 'second-template-plan-02',
          rowLabel: '問02',
          categories: ['建築計画 / 各種建築物', '建築計画 / 建築史'],
        },
        {
          id: 'second-template-plan-03',
          rowLabel: '問03',
          categories: ['建築計画 / 都市計画'],
        },
        {
          id: 'second-template-plan-04',
          rowLabel: '問04',
          categories: ['建築計画 / 計画原論', '建築計画 / 各種建築物'],
        },
      ],
    },
    {
      id: 'second-template-law',
      label: '学科Ⅱ（建築法規）',
      totalCount: 25,
      remainingCount: 21,
      rows: [
        {
          id: 'second-template-law-01',
          rowLabel: '問01',
          categories: ['建築法規 / 建築基準法'],
        },
        {
          id: 'second-template-law-02',
          rowLabel: '問02',
          categories: ['建築法規 / 関係法令'],
        },
        {
          id: 'second-template-law-03',
          rowLabel: '問03',
          categories: ['建築法規 / 集団規定', '建築法規 / 防火避難'],
        },
        {
          id: 'second-template-law-04',
          rowLabel: '問04',
          categories: ['建築法規 / 防火避難'],
        },
      ],
    },
    {
      id: 'second-template-structure',
      label: '学科Ⅲ（建築構造）',
      totalCount: 25,
      remainingCount: 21,
      rows: [
        {
          id: 'second-template-structure-01',
          rowLabel: '問01',
          categories: ['建築構造 / 構造力学'],
        },
        {
          id: 'second-template-structure-02',
          rowLabel: '問02',
          categories: ['建築構造 / 鉄筋コンクリート'],
        },
        {
          id: 'second-template-structure-03',
          rowLabel: '問03',
          categories: ['建築構造 / 木構造', '建築構造 / 地盤基礎'],
        },
        {
          id: 'second-template-structure-04',
          rowLabel: '問04',
          categories: ['建築構造 / 鉄筋コンクリート'],
        },
      ],
    },
    {
      id: 'second-template-construction',
      label: '学科Ⅳ（建築施工）',
      totalCount: 25,
      remainingCount: 21,
      rows: [
        {
          id: 'second-template-construction-01',
          rowLabel: '問01',
          categories: ['建築施工 / 躯体工事'],
        },
        {
          id: 'second-template-construction-02',
          rowLabel: '問02',
          categories: ['建築施工 / 施工管理', '建築施工 / 安全管理'],
        },
        {
          id: 'second-template-construction-03',
          rowLabel: '問03',
          categories: ['建築施工 / 仕上工事'],
        },
        {
          id: 'second-template-construction-04',
          rowLabel: '問04',
          categories: ['建築施工 / 安全管理'],
        },
      ],
    },
  ],
};

const workbookGroupsByMode: Record<WorkbookMode, TestTableGroup[]> = {
  qaa: [
    {
      id: 'qaa-history',
      label: '建築計画 / 建築史',
      helper: '指定12問 / 一問一答',
      remainingCount: 8,
      rows: [
        {
          id: 'qaa-history-01',
          rowLabel: '問01',
          categoryLabel: '建築計画 / 建築史',
          selectedNo: '1-014',
          qaaChoiceIndex: '2',
          isFixed: true,
        },
        {
          id: 'qaa-history-02',
          rowLabel: '問02',
          categoryLabel: '建築計画 / 建築史',
          selectedNo: '1-018',
          qaaChoiceIndex: '4',
        },
        {
          id: 'qaa-history-03',
          rowLabel: '問03',
          categoryLabel: '建築計画 / 建築史',
          selectedNo: '1-022',
          qaaChoiceIndex: '1',
        },
        {
          id: 'qaa-history-04',
          rowLabel: '問04',
          categoryLabel: '建築計画 / 建築史',
          selectedNo: '1-026',
          qaaChoiceIndex: '3',
          forcePageBreakBefore: true,
        },
      ],
    },
    {
      id: 'qaa-sunlight',
      label: '環境・設備 / 日照・採光',
      helper: '指定10問 / 一問一答',
      remainingCount: 6,
      rows: [
        {
          id: 'qaa-sunlight-01',
          rowLabel: '問01',
          categoryLabel: '環境・設備 / 日照・採光',
          selectedNo: '1-105',
          qaaChoiceIndex: '4',
        },
        {
          id: 'qaa-sunlight-02',
          rowLabel: '問02',
          categoryLabel: '環境・設備 / 日照・採光',
          selectedNo: '1-108',
          qaaChoiceIndex: '1',
          isFixed: true,
        },
        {
          id: 'qaa-sunlight-03',
          rowLabel: '問03',
          categoryLabel: '環境・設備 / 日照・採光',
          selectedNo: '1-110',
          qaaChoiceIndex: '2',
        },
        {
          id: 'qaa-sunlight-04',
          rowLabel: '問04',
          categoryLabel: '環境・設備 / 日照・採光',
          selectedNo: '1-112',
          qaaChoiceIndex: '3',
        },
      ],
    },
    {
      id: 'qaa-law',
      label: '法規 / 建築基準法',
      helper: '指定8問 / 一問一答',
      remainingCount: 4,
      rows: [
        {
          id: 'qaa-law-01',
          rowLabel: '問01',
          categoryLabel: '法規 / 建築基準法',
          selectedNo: '1-208',
          qaaChoiceIndex: '1',
        },
        {
          id: 'qaa-law-02',
          rowLabel: '問02',
          categoryLabel: '法規 / 建築基準法',
          selectedNo: '1-211',
          qaaChoiceIndex: '4',
          forcePageBreakBefore: true,
        },
        {
          id: 'qaa-law-03',
          rowLabel: '問03',
          categoryLabel: '法規 / 建築基準法',
          selectedNo: '1-216',
          qaaChoiceIndex: '3',
          isFixed: true,
        },
        {
          id: 'qaa-law-04',
          rowLabel: '問04',
          categoryLabel: '法規 / 建築基準法',
          selectedNo: '1-219',
          qaaChoiceIndex: '2',
        },
      ],
    },
  ],
  allCircle: [
    {
      id: 'circle-general',
      label: '建築計画 / 各種建築物',
      helper: '指定10問 / 回答が全て◯',
      remainingCount: 6,
      rows: [
        {
          id: 'circle-general-01',
          rowLabel: '問01',
          categoryLabel: '建築計画 / 各種建築物',
          selectedNo: '2-016',
          qaaChoiceIndex: '3',
          isFixed: true,
        },
        {
          id: 'circle-general-02',
          rowLabel: '問02',
          categoryLabel: '建築計画 / 各種建築物',
          selectedNo: '2-019',
          qaaChoiceIndex: '1',
        },
        {
          id: 'circle-general-03',
          rowLabel: '問03',
          categoryLabel: '建築計画 / 各種建築物',
          selectedNo: '2-023',
          qaaChoiceIndex: '4',
        },
        {
          id: 'circle-general-04',
          rowLabel: '問04',
          categoryLabel: '建築計画 / 各種建築物',
          selectedNo: '2-027',
          qaaChoiceIndex: '2',
        },
      ],
    },
    {
      id: 'circle-code',
      label: '建築法規 / 建築基準法',
      helper: '指定8問 / 回答が全て◯',
      remainingCount: 4,
      rows: [
        {
          id: 'circle-code-01',
          rowLabel: '問01',
          categoryLabel: '建築法規 / 建築基準法',
          selectedNo: '2-101',
          qaaChoiceIndex: '1',
        },
        {
          id: 'circle-code-02',
          rowLabel: '問02',
          categoryLabel: '建築法規 / 建築基準法',
          selectedNo: '2-104',
          qaaChoiceIndex: '3',
          isFixed: true,
        },
        {
          id: 'circle-code-03',
          rowLabel: '問03',
          categoryLabel: '建築法規 / 建築基準法',
          selectedNo: '2-109',
          qaaChoiceIndex: '4',
        },
        {
          id: 'circle-code-04',
          rowLabel: '問04',
          categoryLabel: '建築法規 / 建築基準法',
          selectedNo: '2-112',
          qaaChoiceIndex: '2',
        },
      ],
    },
    {
      id: 'circle-frame',
      label: '建築施工 / 躯体工事',
      helper: '指定8問 / 回答が全て◯',
      remainingCount: 4,
      rows: [
        {
          id: 'circle-frame-01',
          rowLabel: '問01',
          categoryLabel: '建築施工 / 躯体工事',
          selectedNo: '2-304',
          qaaChoiceIndex: '2',
        },
        {
          id: 'circle-frame-02',
          rowLabel: '問02',
          categoryLabel: '建築施工 / 躯体工事',
          selectedNo: '2-309',
          qaaChoiceIndex: '1',
        },
        {
          id: 'circle-frame-03',
          rowLabel: '問03',
          categoryLabel: '建築施工 / 躯体工事',
          selectedNo: '2-314',
          qaaChoiceIndex: '4',
          forcePageBreakBefore: true,
        },
        {
          id: 'circle-frame-04',
          rowLabel: '問04',
          categoryLabel: '建築施工 / 躯体工事',
          selectedNo: '2-318',
          qaaChoiceIndex: '3',
          isFixed: true,
        },
      ],
    },
  ],
  allCross: [
    {
      id: 'cross-basic',
      label: '建築計画 / 計画原論',
      helper: '指定10問 / 回答が全て×',
      remainingCount: 6,
      rows: [
        {
          id: 'cross-basic-01',
          rowLabel: '問01',
          categoryLabel: '建築計画 / 計画原論',
          selectedNo: '2-011',
          qaaChoiceIndex: '4',
          isFixed: true,
        },
        {
          id: 'cross-basic-02',
          rowLabel: '問02',
          categoryLabel: '建築計画 / 計画原論',
          selectedNo: '2-013',
          qaaChoiceIndex: '2',
        },
        {
          id: 'cross-basic-03',
          rowLabel: '問03',
          categoryLabel: '建築計画 / 計画原論',
          selectedNo: '2-015',
          qaaChoiceIndex: '1',
        },
        {
          id: 'cross-basic-04',
          rowLabel: '問04',
          categoryLabel: '建築計画 / 計画原論',
          selectedNo: '2-017',
          qaaChoiceIndex: '3',
        },
      ],
    },
    {
      id: 'cross-structure',
      label: '建築構造 / 構造力学',
      helper: '指定8問 / 回答が全て×',
      remainingCount: 4,
      rows: [
        {
          id: 'cross-structure-01',
          rowLabel: '問01',
          categoryLabel: '建築構造 / 構造力学',
          selectedNo: '2-205',
          qaaChoiceIndex: '2',
          forcePageBreakBefore: true,
        },
        {
          id: 'cross-structure-02',
          rowLabel: '問02',
          categoryLabel: '建築構造 / 構造力学',
          selectedNo: '2-209',
          qaaChoiceIndex: '1',
        },
        {
          id: 'cross-structure-03',
          rowLabel: '問03',
          categoryLabel: '建築構造 / 構造力学',
          selectedNo: '2-213',
          qaaChoiceIndex: '4',
          isFixed: true,
        },
        {
          id: 'cross-structure-04',
          rowLabel: '問04',
          categoryLabel: '建築構造 / 構造力学',
          selectedNo: '2-218',
          qaaChoiceIndex: '3',
        },
      ],
    },
    {
      id: 'cross-manage',
      label: '建築施工 / 施工管理',
      helper: '指定8問 / 回答が全て×',
      remainingCount: 4,
      rows: [
        {
          id: 'cross-manage-01',
          rowLabel: '問01',
          categoryLabel: '建築施工 / 施工管理',
          selectedNo: '2-321',
          qaaChoiceIndex: '1',
        },
        {
          id: 'cross-manage-02',
          rowLabel: '問02',
          categoryLabel: '建築施工 / 施工管理',
          selectedNo: '2-324',
          qaaChoiceIndex: '4',
          isFixed: true,
        },
        {
          id: 'cross-manage-03',
          rowLabel: '問03',
          categoryLabel: '建築施工 / 施工管理',
          selectedNo: '2-327',
          qaaChoiceIndex: '2',
        },
        {
          id: 'cross-manage-04',
          rowLabel: '問04',
          categoryLabel: '建築施工 / 施工管理',
          selectedNo: '2-330',
          qaaChoiceIndex: '3',
        },
      ],
    },
  ],
  choice: [
    {
      id: 'choice-process',
      label: '施工 / 仮設・工程',
      helper: '指定10問 / 選択問題',
      remainingCount: 6,
      rows: [
        {
          id: 'choice-process-01',
          rowLabel: '問01',
          categoryLabel: '施工 / 仮設・工程',
          selectedNo: '1-401',
          isFixed: true,
        },
        {
          id: 'choice-process-02',
          rowLabel: '問02',
          categoryLabel: '施工 / 仮設・工程',
          selectedNo: '1-406',
        },
        {
          id: 'choice-process-03',
          rowLabel: '問03',
          categoryLabel: '施工 / 仮設・工程',
          selectedNo: '1-409',
        },
        {
          id: 'choice-process-04',
          rowLabel: '問04',
          categoryLabel: '施工 / 仮設・工程',
          selectedNo: '1-414',
          forcePageBreakBefore: true,
        },
      ],
    },
    {
      id: 'choice-structure',
      label: '構造 / 構造力学',
      helper: '指定8問 / 選択問題',
      remainingCount: 4,
      rows: [
        {
          id: 'choice-structure-01',
          rowLabel: '問01',
          categoryLabel: '構造 / 構造力学',
          selectedNo: '1-302',
        },
        {
          id: 'choice-structure-02',
          rowLabel: '問02',
          categoryLabel: '構造 / 構造力学',
          selectedNo: '1-308',
          isFixed: true,
        },
        {
          id: 'choice-structure-03',
          rowLabel: '問03',
          categoryLabel: '構造 / 構造力学',
          selectedNo: '1-314',
        },
        {
          id: 'choice-structure-04',
          rowLabel: '問04',
          categoryLabel: '構造 / 構造力学',
          selectedNo: '1-319',
        },
      ],
    },
    {
      id: 'choice-air',
      label: '環境・設備 / 空気調和',
      helper: '指定8問 / 選択問題',
      remainingCount: 4,
      rows: [
        {
          id: 'choice-air-01',
          rowLabel: '問01',
          categoryLabel: '環境・設備 / 空気調和',
          selectedNo: '1-112',
          forcePageBreakBefore: true,
        },
        {
          id: 'choice-air-02',
          rowLabel: '問02',
          categoryLabel: '環境・設備 / 空気調和',
          selectedNo: '1-116',
        },
        {
          id: 'choice-air-03',
          rowLabel: '問03',
          categoryLabel: '環境・設備 / 空気調和',
          selectedNo: '1-121',
          isFixed: true,
        },
        {
          id: 'choice-air-04',
          rowLabel: '問04',
          categoryLabel: '環境・設備 / 空気調和',
          selectedNo: '1-126',
        },
      ],
    },
  ],
};

const FieldBlock = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
};

const TonePill = ({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'sky' | 'green' | 'amber' | 'rose';
}) => {
  const toneClass = {
    slate: '!border-gray-400 !bg-gray-50 !text-gray-800',
    sky: '!border-gray-400 !bg-gray-50 !text-gray-800',
    green: '!border-gray-400 !bg-gray-50 !text-gray-800',
    amber: '!border-gray-400 !bg-gray-50 !text-gray-800',
    rose: '!border-gray-400 !bg-gray-50 !text-gray-800',
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
};

const StepCard = ({
  step,
  title,
  action,
  description,
  footer,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 ">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-primary-foreground">
            {step}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t pt-4">{footer}</CardFooter>
      ) : null}
    </Card>
  );
};

const TestTableTabs = ({
  activeGroupId,
  groupUnitLabel,
  groups,
  onActiveGroupChange,
  showChoiceIndex,
}: {
  activeGroupId: string;
  groupUnitLabel: string;
  groups: TestTableGroup[];
  onActiveGroupChange: (value: string) => void;
  showChoiceIndex: boolean;
}) => {
  return (
    <Tabs
      className="w-full"
      value={activeGroupId}
      onValueChange={onActiveGroupChange}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            グループ単位: {groupUnitLabel}
          </p>
          <TonePill tone="slate">1行 = 1問</TonePill>
        </div>
        <TabsList
          className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 pb-2"
          variant="line"
        >
          {groups.map((group) => (
            <TabsTrigger
              className="flex-none rounded-full border border-transparent px-3 py-1.5 data-[state=active]:border-primary/30 data-[state=active]:bg-primary/5"
              key={group.id}
              value={group.id}
            >
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {groups.map((group, groupIndex) => (
        <TabsContent className="mt-4" key={group.id} value={group.id}>
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {group.label}
                </p>
                <p className="text-xs text-muted-foreground">{group.helper}</p>
              </div>
              {group.remainingCount > 0 ? (
                <TonePill tone="amber">
                  他 {group.remainingCount} 問を省略表示
                </TonePill>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border bg-background">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/35 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">枠</th>
                    <th className="px-3 py-2 font-medium">カテゴリ条件</th>
                    <th className="px-3 py-2 font-medium">No</th>
                    {showChoiceIndex ? (
                      <th className="px-3 py-2 font-medium">選択肢番号</th>
                    ) : null}
                    <th className="px-3 py-2 text-center font-medium">固定</th>
                    <th className="px-3 py-2 text-center font-medium">
                      強制改ページ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, rowIndex) => (
                    <tr className="border-t align-top" key={row.id}>
                      <td className="px-3 py-3 font-medium text-foreground">
                        {row.rowLabel}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.categoryLabel}
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          className="h-8 w-24 bg-white font-mono text-xs"
                          defaultValue={toDisplayNo(
                            row.selectedNo,
                            groupIndex,
                            rowIndex,
                          )}
                        />
                      </td>
                      {showChoiceIndex ? (
                        <td className="px-3 py-3">
                          <Input
                            className="h-8 w-16 bg-white text-center text-xs"
                            defaultValue={row.qaaChoiceIndex ?? ''}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <div className="flex justify-center">
                          <Checkbox defaultChecked={row.isFixed} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-center">
                          <Checkbox defaultChecked={row.forcePageBreakBefore} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
};

const MockExamTemplateEditor = ({
  groups,
}: {
  groups: MockExamTemplateGroup[];
}) => {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">カテゴリ選択</p>
        </div>
        <TonePill tone="green">
          合計 {groups.reduce((sum, group) => sum + group.totalCount, 0)} 問
        </TonePill>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div className="rounded-lg border bg-background p-3" key={group.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {group.label}
              </p>
              <TonePill tone="slate">既定 {group.totalCount} 問</TonePill>
            </div>

            <div className="mt-3 space-y-2">
              {group.rows.map((row) => (
                <div
                  className="rounded-lg border bg-muted/15 px-3 py-2"
                  key={row.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      {row.rowLabel}
                    </p>
                    <Button size="sm" type="button" variant="outline">
                      カテゴリ編集
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.categories.map((category) => (
                      <span
                        className="rounded-full border bg-white px-2.5 py-1 text-xs text-muted-foreground"
                        key={`${row.id}-${category}`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {group.remainingCount > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                他 {group.remainingCount} 枠も同じ形式でカテゴリ条件を設定
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const PdfCreationMockScreen = () => {
  const [creationType, setCreationType] = useState<CreationType>('mockExam');
  const [grade, setGrade] = useState<Grade>('firstGrade');
  const [title, setTitle] = useState('令和8年度 学科演習');
  const [workbookMode, setWorkbookMode] = useState<WorkbookMode>('qaa');
  const [choiceShuffle, setChoiceShuffle] = useState(true);
  const [difficultyEnabled, setDifficultyEnabled] = useState(true);
  const [excludePastQuestions, setExcludePastQuestions] = useState(true);
  const [excludeQaaUnavailable, setExcludeQaaUnavailable] = useState(true);
  const [excludeShuffleUnavailable, setExcludeShuffleUnavailable] =
    useState(false);
  const [excludedCustomTags, setExcludedCustomTags] = useState<string[]>([]);
  const [difficultyLow, setDifficultyLow] = useState(30);
  const [difficultyHigh, setDifficultyHigh] = useState(70);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [workbookGroupDialogOpen, setWorkbookGroupDialogOpen] = useState(false);
  const [groupPickerDrafts, setGroupPickerDrafts] = useState<
    Record<string, GroupPickerDraft>
  >(() => createDefaultGroupPickerDrafts());
  const [customWorkbookGroups, setCustomWorkbookGroups] = useState<
    TestTableGroup[]
  >([]);

  const tableGroups = useMemo<TestTableGroup[]>(() => {
    if (creationType === 'mockExam') {
      return mockExamGroupsByGrade[grade];
    }

    return [...workbookGroupsByMode[workbookMode], ...customWorkbookGroups];
  }, [creationType, grade, workbookMode, customWorkbookGroups]);

  const outputTitle = title.trim() || 'タイトル未入力';
  const difficultyValues = [
    difficultyLow,
    difficultyHigh - difficultyLow,
    100 - difficultyHigh,
  ];
  const mockExamTemplateGroups = useMemo(
    () => mockExamTemplateGroupsByGrade[grade],
    [grade],
  );
  const isChoiceShuffleAvailable =
    creationType === 'mockExam' || workbookMode === 'choice';
  const isQaaMode = creationType === 'workbook' && workbookMode !== 'choice';
  const tableGroupUnit =
    creationType === 'mockExam' ? '学科' : '大分類 / 小分類';
  const totalRequestedCount = useMemo(
    () =>
      tableGroups.reduce(
        (sum, group) => sum + parseQuestionCountFromHelper(group.helper),
        0,
      ),
    [tableGroups],
  );
  const selectedPickerCount = useMemo(
    () =>
      Object.values(groupPickerDrafts).filter((draft) => draft.checked).length,
    [groupPickerDrafts],
  );
  const sliderStyle = {
    '--pdf-slider-low': `${difficultyLow}%`,
    '--pdf-slider-high': `${difficultyHigh}%`,
    '--pdf-slider-mid-one': `${difficultyLow / 2}%`,
    '--pdf-slider-mid-two': `${difficultyLow + (difficultyHigh - difficultyLow) / 2}%`,
    '--pdf-slider-mid-three': `${difficultyHigh + (100 - difficultyHigh) / 2}%`,
  } as CSSProperties;

  const outputFiles = useMemo(() => {
    if (creationType === 'mockExam') {
      return grade === 'firstGrade'
        ? [
            '問題用紙_学科Ⅰ・II.pdf',
            '問題用紙_学科Ⅲ.pdf',
            '問題用紙_学科Ⅳ・V.pdf',
            '解説用紙_学科Ⅰ（計画）.pdf',
            '解説用紙_学科Ⅱ（環境・設備）.pdf',
            '解説用紙_学科Ⅲ（法規）.pdf',
            '解説用紙_学科Ⅳ（構造）.pdf',
            '解説用紙_学科Ⅴ（施工）.pdf',
            '出題条件.json',
          ]
        : [
            '問題用紙_学科Ⅰ・II.pdf',
            '問題用紙_学科Ⅲ・IV.pdf',
            '解説用紙_学科Ⅰ（建築計画）.pdf',
            '解説用紙_学科Ⅱ（建築法規）.pdf',
            '解説用紙_学科Ⅲ（建築構造）.pdf',
            '解説用紙_学科Ⅳ（建築施工）.pdf',
            '出題条件.json',
          ];
    }

    return [
      `問題集_${gradeLabels[grade]}_${workbookModeLabels[workbookMode]}_${outputTitle}.pdf`,
      '出題条件.json',
    ];
  }, [creationType, grade, outputTitle, workbookMode]);

  const drawResetKey = [
    creationType,
    grade,
    workbookMode,
    choiceShuffle ? 'shuffle-on' : 'shuffle-off',
    difficultyEnabled ? 'difficulty-on' : 'difficulty-off',
    excludePastQuestions ? 'exclude-past-on' : 'exclude-past-off',
    excludeQaaUnavailable ? 'exclude-qaa-on' : 'exclude-qaa-off',
    excludeShuffleUnavailable ? 'exclude-shuffle-on' : 'exclude-shuffle-off',
    excludedCustomTags.join(','),
    customWorkbookGroups
      .map((group) => `${group.id}:${group.helper}`)
      .join(','),
    `${difficultyLow}`,
    `${difficultyHigh}`,
  ].join('|');

  useEffect(() => {
    setActiveGroupId(tableGroups[0]?.id ?? '');
  }, [tableGroups]);

  useEffect(() => {
    if (drawResetKey === '') return;
    setHasDrawn(false);
  }, [drawResetKey]);

  const handleGroupDraftCheckedChange = (itemId: string, checked: boolean) => {
    setGroupPickerDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        checked,
      },
    }));
  };

  const handleGroupDraftCountChange = (itemId: string, nextValue: string) => {
    const normalized = nextValue.replace(/[^0-9]/g, '').slice(0, 2);

    setGroupPickerDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        count: normalized,
      },
    }));
  };

  const handleApplyWorkbookGroups = () => {
    setCustomWorkbookGroups(
      createWorkbookCustomGroups(groupPickerDrafts, workbookMode),
    );
    setWorkbookGroupDialogOpen(false);
  };

  // 今後の機能追加で使用予定。使用した場合は下のvoidは削除すること
  const handleWorkbookModeChange = (nextMode: WorkbookMode) => {
    setWorkbookMode(nextMode);
    setCustomWorkbookGroups([]);
    setGroupPickerDrafts(createDefaultGroupPickerDrafts());
    setWorkbookGroupDialogOpen(false);
  };

  void handleWorkbookModeChange;

  const resetMockState = () => {
    setCreationType('mockExam');
    setGrade('firstGrade');
    setTitle('令和8年度 学科演習');
    setWorkbookMode('qaa');
    setChoiceShuffle(true);
    setDifficultyEnabled(true);
    setExcludePastQuestions(true);
    setExcludeQaaUnavailable(true);
    setExcludeShuffleUnavailable(false);
    setExcludedCustomTags([]);
    setDifficultyLow(30);
    setDifficultyHigh(70);
    setHasDrawn(false);
    setActiveGroupId('');
    setWorkbookGroupDialogOpen(false);
    setCustomWorkbookGroups([]);
    setGroupPickerDrafts(createDefaultGroupPickerDrafts());
  };

  return (
    <div className="dev-pdf-mock pb-6 [--primary:0_0%_0%] [--primary-foreground:0_0%_100%] [--ring:0_0%_0%]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.92fr)]">
        <div className="space-y-4">
          <StepCard
            footer={
              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline">
                    JSON読込
                  </Button>
                  <Button
                    onClick={resetMockState}
                    type="button"
                    variant="outline"
                  >
                    初期状態にする
                  </Button>
                </div>
              </div>
            }
            step="1"
            title="出力形式選択"
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">出力形式</p>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    creationType === 'mockExam'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                  onClick={() => setCreationType('mockExam')}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">模擬試験作成</p>
                  </div>
                </button>
                <button
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    creationType === 'workbook'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                  onClick={() => setCreationType('workbook')}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold">問題集作成</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-1/2">
              <FieldBlock label="タイトル">
                <Input
                  className="w-full"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="タイトルを入力"
                  value={title}
                />
              </FieldBlock>
              <FieldBlock label="級">
                <Select
                  value={grade}
                  onValueChange={(value) => setGrade(value as Grade)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="級を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="firstGrade">1級</SelectItem>
                      <SelectItem value="secondGrade">2級</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldBlock>

              {/*creationType === 'workbook' ? (
                <FieldBlock
                  hint={workbookHints[workbookMode]}
                  label="問題集モード"
                >
                  <Select
                    value={workbookMode}
                    onValueChange={(value) =>
                      handleWorkbookModeChange(value as WorkbookMode)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="問題種別を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="qaa">一問一答</SelectItem>
                        <SelectItem value="allCircle">
                          一問一答（回答が全て◯）
                        </SelectItem>
                        <SelectItem value="allCross">
                          一問一答（回答が全て×）
                        </SelectItem>
                        <SelectItem value="choice">選択問題</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FieldBlock>
              ) : null*/}
            </div>
          </StepCard>

          <StepCard description="" step="2" title="出題条件設定">
            <div className="space-y-4">
              {creationType === 'mockExam' ? (
                <MockExamTemplateEditor groups={mockExamTemplateGroups} />
              ) : (
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <TonePill tone="green">{totalRequestedCount} 問</TonePill>
                      <Button
                        onClick={() => setWorkbookGroupDialogOpen(true)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        グループ追加
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {tableGroups.map((group) => (
                      <div
                        className="rounded-lg border bg-background p-3"
                        key={group.id}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {group.label}
                          </p>
                          <TonePill tone="slate">
                            {parseQuestionCountFromHelper(group.helper)}問
                          </TonePill>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-background p-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      オプション
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          選択肢シャッフル
                        </p>
                        {/* <p className="text-xs text-muted-foreground">
                          {isChoiceShuffleAvailable
                            ? '抽選条件側で ON / OFF を決め、抽選結果に反映する想定です。'
                            : '一問一答モードでは適用不可のため disabled 表示にしています。'}
                        </p> */}
                      </div>
                      <Switch
                        checked={isChoiceShuffleAvailable && choiceShuffle}
                        disabled={!isChoiceShuffleAvailable}
                        onCheckedChange={setChoiceShuffle}
                      />
                    </div>

                    {creationType === 'workbook' ? (
                      <>
                        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              過去問を除外
                            </p>
                            <p className="text-xs text-muted-foreground">
                              オリジナル問題だけを候補にする想定です。
                            </p>
                          </div>
                          <Switch
                            checked={excludePastQuestions}
                            onCheckedChange={setExcludePastQuestions}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              一問一答化不可を除外
                            </p>
                            <p className="text-xs text-muted-foreground">
                              一問一答系モードの候補条件として配置しています。
                            </p>
                          </div>
                          <Switch
                            checked={excludeQaaUnavailable}
                            onCheckedChange={setExcludeQaaUnavailable}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              シャッフル不可を除外
                            </p>
                            <p className="text-xs text-muted-foreground">
                              選択問題モードの候補絞り込みを想定しています。
                            </p>
                          </div>
                          <Switch
                            checked={excludeShuffleUnavailable}
                            onCheckedChange={setExcludeShuffleUnavailable}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>

                  <FieldBlock
                    /*  hint="ユーザーが任意のタグを追加し、そのタグを持つ問題を候補から除外する想定です。" */
                    label="特定タグ除外"
                  >
                    <BasicCreatableSelect
                      defaultOption={excludeTagOptions}
                      onChange={setExcludedCustomTags}
                      placeholder="除外タグを選択/追加"
                      value={excludedCustomTags}
                    />
                  </FieldBlock>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <SlidersHorizontal className="mt-0.5 size-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        難易度調整
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
                    <span className="text-xs text-muted-foreground">
                      有効化
                    </span>
                    <Switch
                      checked={difficultyEnabled}
                      onCheckedChange={setDifficultyEnabled}
                    />
                  </div>
                </div>

                <div
                  className={`dev-pdf-slider ${difficultyEnabled ? '' : 'is-disabled'}`}
                  style={sliderStyle}
                >
                  <div className="dev-pdf-slider__balloon dev-pdf-slider__balloon--1 ">
                    <span className="dev-pdf-slider__star text-gray-800!">
                      ★
                    </span>
                    <span className="dev-pdf-slider__value text-gray-800!">
                      {difficultyValues[0]}%
                    </span>
                  </div>
                  <div className="dev-pdf-slider__balloon dev-pdf-slider__balloon--2  ">
                    <span className="dev-pdf-slider__star text-gray-800!">
                      ★★
                    </span>
                    <span className="dev-pdf-slider__value text-gray-800!">
                      {difficultyValues[1]}%
                    </span>
                  </div>
                  <div className="dev-pdf-slider__balloon dev-pdf-slider__balloon--3  ">
                    <span className="dev-pdf-slider__star text-gray-800!">
                      ★★★
                    </span>
                    <span className="dev-pdf-slider__value text-gray-800!">
                      {difficultyValues[2]}%
                    </span>
                  </div>

                  <div className="dev-pdf-slider__track-wrap">
                    <div className="dev-pdf-slider__track  bg-gray-800!" />
                    <input
                      aria-label="難易度1と2の境界"
                      className="dev-pdf-slider__range"
                      disabled={!difficultyEnabled}
                      max={95}
                      min={0}
                      onChange={(event) => {
                        const nextValue = Math.min(
                          event.currentTarget.valueAsNumber,
                          difficultyHigh - 5,
                        );
                        setDifficultyLow(nextValue);
                      }}
                      step={5}
                      type="range"
                      value={difficultyLow}
                    />
                    <input
                      aria-label="難易度2と3の境界"
                      className="dev-pdf-slider__range"
                      disabled={!difficultyEnabled}
                      max={100}
                      min={5}
                      onChange={(event) => {
                        const nextValue = Math.max(
                          event.currentTarget.valueAsNumber,
                          difficultyLow + 5,
                        );
                        setDifficultyHigh(nextValue);
                      }}
                      step={5}
                      type="range"
                      value={difficultyHigh}
                    />
                  </div>

                  <div className="dev-pdf-slider__scale">
                    <span>0%</span>
                    <span>20%</span>
                    <span>40%</span>
                    <span>60%</span>
                    <span>80%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <Dialog
                open={creationType === 'workbook' && workbookGroupDialogOpen}
                onOpenChange={setWorkbookGroupDialogOpen}
              >
                <DialogContent className="dev-pdf-group-dialog max-w-220 p-0">
                  <DialogHeader className="border-b px-6 pt-6 pb-4">
                    <DialogTitle>抽選対象グループを編集</DialogTitle>
                  </DialogHeader>

                  <div className="dev-pdf-group-dialog__body px-6 py-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        選択中 {selectedPickerCount} カテゴリ
                      </p>
                      <TonePill tone="green">
                        合計{' '}
                        {Object.values(groupPickerDrafts).reduce(
                          (sum, draft) =>
                            draft.checked
                              ? sum + Math.max(Number(draft.count) || 0, 1)
                              : sum,
                          0,
                        )}
                        問
                      </TonePill>
                    </div>

                    <Accordion className="space-y-3" type="multiple">
                      {workbookGroupPickerSections.map((section) => (
                        <AccordionItem
                          className="rounded-xl border bg-muted/15 px-4"
                          key={section.id}
                          value={section.id}
                        >
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="text-left">
                              <p className="text-sm font-semibold text-foreground">
                                {section.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                小カテゴリ {section.items.length} 件
                              </p>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="space-y-2 pt-2">
                            {section.items.map((item) => {
                              const draft = groupPickerDrafts[item.id];
                              return (
                                <div
                                  className="dev-pdf-group-dialog__row"
                                  key={item.id}
                                >
                                  <div className="flex min-w-0 items-start gap-3">
                                    <Checkbox
                                      checked={draft?.checked === true}
                                      onCheckedChange={(checked) =>
                                        handleGroupDraftCheckedChange(
                                          item.id,
                                          checked === true,
                                        )
                                      }
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground">
                                        {item.smallCategory}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {item.bigCategory} /{' '}
                                        {item.smallCategory}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="h-8 w-20 bg-white text-right text-xs"
                                      onChange={(event) =>
                                        handleGroupDraftCountChange(
                                          item.id,
                                          event.target.value,
                                        )
                                      }
                                      value={draft?.count ?? ''}
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      問
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  <DialogFooter className="border-t px-6 py-4">
                    <Button
                      onClick={() => setWorkbookGroupDialogOpen(false)}
                      type="button"
                      variant="outline"
                    >
                      キャンセル
                    </Button>
                    <Button onClick={handleApplyWorkbookGroups} type="button">
                      編集
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </StepCard>

          <StepCard
            description=""
            footer={
              hasDrawn ? (
                <p className="w-full text-xs text-muted-foreground">
                  モックでは No
                  と選択肢番号の入力欄を置き、固定・強制改ページを個別に調整できる形にしています。
                </p>
              ) : undefined
            }
            step="3"
            title="問題テーブル"
          >
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                onClick={() => setHasDrawn(true)}
                type="button"
                className="border bg-background"
              >
                {hasDrawn ? '再抽選する' : '抽選する'}
              </Button>
            </div>
            {hasDrawn ? (
              <TestTableTabs
                activeGroupId={activeGroupId}
                groupUnitLabel={tableGroupUnit}
                groups={tableGroups}
                onActiveGroupChange={setActiveGroupId}
                showChoiceIndex={isQaaMode}
              />
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
                <Layers3 className="mx-auto size-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  抽選条件を確定して「抽選する」を押すと、問題テーブルが表示されます。
                </p>
              </div>
            )}
          </StepCard>

          <StepCard
            description=""
            footer={
              <div className="flex w-full flex-wrap justify-end gap-2">
                <Button type="button" variant="outline">
                  JSON保存
                </Button>
                <Button disabled={!hasDrawn} type="button">
                  PDF出力
                </Button>
              </div>
            }
            step="4"
            title="PDF出力"
          >
            <div className="grid gap-4">
              <div className="space-y-4">
                <FieldBlock label="出力先フォルダ">
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Input
                      className="flex-1"
                      readOnly
                      value="C:/Users/<user>/Documents/PDF作成/令和8年度 学科演習_20260422_103000"
                    />
                    <Button type="button" variant="outline">
                      <FolderOpen className="mr-1 size-4" />
                      参照
                    </Button>
                  </div>
                </FieldBlock>

                <div className="rounded-xl border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    出力前の確認
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                      <Checkbox defaultChecked />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          表紙を含める
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                      <Checkbox defaultChecked />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          出題条件.json を同時保存
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm font-medium text-foreground">
                        出力予定ファイル
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {outputFiles.map((fileName) => (
                          <li key={fileName}>{fileName}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </StepCard>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <div>
                  <CardTitle>プレビューイメージ</CardTitle>
                  <CardDescription>
                    {creationType === 'mockExam'
                      ? 'A4 ベースの問題用紙 / 解説用紙のプレビューを想定した見た目です。'
                      : 'B5 ベースの問題集プレビューを想定した見た目です。'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="dev-pdf-preview-sheet"
                data-mode={creationType === 'mockExam' ? 'mock' : 'workbook'}
              >
                <div className="dev-pdf-preview-sheet__hero  bg-white!">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
                    {creationType === 'mockExam' ? 'Mock Exam' : 'Workbook'}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {outputTitle}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    {gradeLabels[grade]} /{' '}
                    {creationType === 'mockExam'
                      ? '問題用紙・解説用紙を複数 PDF で出力'
                      : workbookModeLabels[workbookMode]}
                  </p>
                </div>
                <div className="dev-pdf-preview-sheet__body">
                  <div className="dev-pdf-preview-sheet__line dev-pdf-preview-sheet__line--lg" />
                  <div className="dev-pdf-preview-sheet__line" />
                  <div className="dev-pdf-preview-sheet__line dev-pdf-preview-sheet__line--md" />
                  <div className="dev-pdf-preview-sheet__grid">
                    <div className="dev-pdf-preview-sheet__box" />
                    <div className="dev-pdf-preview-sheet__box" />
                    <div className="dev-pdf-preview-sheet__box" />
                  </div>
                  <div className="dev-pdf-preview-sheet__line dev-pdf-preview-sheet__line--lg" />
                  <div className="dev-pdf-preview-sheet__line dev-pdf-preview-sheet__line--sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/*           <Card>
            <CardHeader>
              <CardTitle>現在の設定サマリー</CardTitle>
              <CardDescription>
                右側はフローの補助情報だけに絞り、主操作は左側を上から順に進めます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  出力形式:{' '}
                  {creationType === 'mockExam' ? '模擬試験作成' : '問題集作成'}
                </li>
                <li>級: {gradeLabels[grade]}</li>
                <li>
                  問題集モード:{' '}
                  {creationType === 'workbook'
                    ? workbookModeLabels[workbookMode]
                    : '未使用'}
                </li>
                <li>テーブル単位: {tableGroupUnit}</li>
                <li>指定総数: {totalRequestedCount}問</li>
                <li>
                  特定タグ除外:{' '}
                  {excludedCustomTags.length > 0
                    ? excludedCustomTags.join(' / ')
                    : 'なし'}
                </li>
                <li>抽選状態: {hasDrawn ? '抽選済み' : '未抽選'}</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>確認ポイント</CardTitle>
              <CardDescription>
                今回の修正方針に沿って、見るべき点を右側に残しています。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  左側が 出力形式 → 抽選条件 → テーブル → PDF出力
                  の順に読めること
                </li>
                <li>
                  問題枠テーブルが模擬試験 / 問題集で同じ列構成になっていること
                </li>
                <li>問題集のタブ名が 大分類 / 小分類 表記になっていること</li>
                <li>
                  一問一答時だけ選択肢番号列が出て、選択問題では消えること
                </li>
              </ul>
            </CardContent>
          </Card> */}
        </div>
      </div>
    </div>
  );
};

export default PdfCreationMockScreen;
