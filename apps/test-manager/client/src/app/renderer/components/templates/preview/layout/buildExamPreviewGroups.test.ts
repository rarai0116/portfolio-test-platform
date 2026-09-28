import { describe, expect, it } from 'vitest';
import { buildExamPreviewGroups } from './buildExamPreviewGroups';
import type { LayoutState, PreviewItem } from './types';

const buildItem = (
  subject: string,
  overrides: Partial<PreviewItem> = {},
): PreviewItem => ({
  id: `item-${subject}`,
  subject,
  bigCategoryTag: '大分類A',
  smallCategoryTag: '小分類A',
  nengo: '令和',
  year: 6,
  testNo: '01',
  textHtml: '<p>問題文</p>',
  questionChoicesHtml: ['<p>選択肢</p>'],
  answerTextHtml: '<p>解説文</p>',
  answerChoicesHtml: ['<p>解答選択肢</p>'],
  answerBool: true,
  answerNo: '1',
  difficult: 1,
  ...overrides,
});

const buildState = (gradeNumber: 1 | 2, subjects: string[]): LayoutState => ({
  options: {
    mode: 'both',
    hasCover: true,
    hasSubCategoryHeading: false,
    questionCount: subjects.length,
    meta: {
      title: '模擬試験',
      grade: `${gradeNumber}級`,
    },
    page: {
      size: 'A4',
      pxPerMm: 0.2645,
      baseHeightMm: 287,
    },
    questionEditorType: 'normal',
    answerEditorType: 'normal',
    creationType: 'exam',
    gradeNumber,
  },
  items: subjects.map((subject, index) =>
    buildItem(subject, { id: `item-${index + 1}` }),
  ),
});

describe('buildExamPreviewGroups', () => {
  it('1級は問題冊子と解説冊子を仕様順で組み立てる', () => {
    const groups = buildExamPreviewGroups(
      buildState(1, ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ']),
    );

    expect(groups.questionGroups).toHaveLength(3);
    expect(groups.questionGroups[0]).toMatchObject({
      id: 'question-booklet-1',
      coverKey: 'cover1',
      label: '学科Ⅰ・学科Ⅱ',
      middleCoverKey: 'middleCover1',
    });
    expect(
      groups.questionGroups[0]?.subjects.map((subject) => subject.subject),
    ).toEqual(['学科Ⅰ', '学科Ⅱ']);
    expect(groups.questionGroups[1]).toMatchObject({
      id: 'question-booklet-2',
      coverKey: 'cover2',
      label: '学科Ⅲ',
      middleCoverKey: 'middleCover2',
    });
    expect(groups.questionGroups[2]).toMatchObject({
      middleCoverKey: 'middleCover2',
    });

    expect(groups.answerGroups.map((group) => group.coverKey)).toEqual([
      'cover1',
      'cover2',
      'cover3',
      'cover4',
      'cover5',
    ]);
  });

  it('欠けた学科は飛ばしつつ冊子順序を維持する', () => {
    const groups = buildExamPreviewGroups(buildState(1, ['学科Ⅱ', '学科Ⅳ']));

    expect(groups.questionGroups).toHaveLength(2);
    expect(groups.questionGroups[0]).toMatchObject({
      id: 'question-booklet-1',
      label: '学科Ⅱ',
      coverKey: 'cover1',
      middleCoverKey: 'middleCover1',
    });
    expect(groups.questionGroups[1]).toMatchObject({
      id: 'question-booklet-3',
      label: '学科Ⅳ',
      coverKey: 'cover3',
      middleCoverKey: 'middleCover2',
    });
    expect(groups.answerGroups.map((group) => group.coverKey)).toEqual([
      'cover2',
      'cover4',
    ]);
  });
});
