import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import { autoCheck } from './autoCheck';
import { PAST_EXAM_DUPLICATE_FAILED_KEY } from './pastExamDuplicate';

function baseEntry(): TestData {
  return {
    active: true,
    answer: '',
    answerNumber: '1',
    answerText: '<p><br></p>',
    answerText1: '<p><br></p>',
    answerText2: '<p><br></p>',
    answerText3: '<p><br></p>',
    answerText4: '<p><br></p>',
    answerText5: '<p><br></p>',
    bigCategoryTag: '',
    ch1: '<p><br></p>',
    ch2: '<p><br></p>',
    ch3: '<p><br></p>',
    ch4: '<p><br></p>',
    ch5: '<p><br></p>',
    difficult: '',
    grade: 1,
    isConvertibleQaa: false,
    isNegativeAnswer: false,
    nengo: '',
    no: 1,
    parentAnswerHonbun: '',
    parentHonbun: '',
    parentNo: 0,
    parentbNo: '',
    smallCategoryTag: '',
    status: 'エラー',
    subject: '学科Ⅰ',
    testNo: '',
    publicationYear: '',
    publicationNo: '',
    text: '<p><br></p>',
    themeTag: '',
    year: '',
    otherTags: [],
    questionEditorType: 'normal',
    answerEditorType: 'normal',
  };
}

function fillAllEditors(entry: TestData): TestData {
  entry.text = '<p><strong>重要本文</strong></p>';
  entry.ch1 = '<p>選択肢1</p>';
  entry.ch2 = '<p>選択肢2</p>';
  entry.ch3 = '<p>選択肢3</p>';
  entry.ch4 = '<p>選択肢4</p>';
  entry.ch5 = '<p>選択肢5</p>';
  entry.answerText = '<p>解説本文</p>';
  entry.answerText1 = '<p>解答1</p>';
  entry.answerText2 = '<p>解答2</p>';
  entry.answerText3 = '<p>解答3</p>';
  entry.answerText4 = '<p>解答4</p>';
  entry.answerText5 = '<p>解答5</p>';
  return entry;
}

describe('自動チェックAPI > 無視ルールと空判定', () => {
  it('1級ではch5/answerText5が無視され、空でもerrorに含まれない', () => {
    const entry = baseEntry();
    entry.grade = 0;
    const res = autoCheck(entry);
    expect(res.ignoredKeys).toContain('ch5');
    expect(res.ignoredKeys).toContain('answerText5');
    expect(res.missingEditorKeys).not.toContain('ch5');
    expect(res.missingEditorKeys).not.toContain('answerText5');
  });

  it('answerEditorType=noHonbunならanswerTextは無視（解説側のみ）', () => {
    const entry = baseEntry();
    entry.answerEditorType = 'noHonbun';
    // textは空のままなのでerrorに含まれる
    const res = autoCheck(entry);
    expect(res.ignoredKeys).toContain('answerText');
    expect(res.missingEditorKeys).not.toContain('answerText');
    expect(res.missingEditorKeys).toContain('text');
  });

  it('noChoice（両側）で選択肢を無視', () => {
    const entry = baseEntry();
    entry.questionEditorType = 'noChoice';
    entry.answerEditorType = 'noChoice';
    const res = autoCheck(entry);
    ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'].forEach((k) => {
      expect(res.ignoredKeys).toContain(k);
    });
    [
      'answerText1',
      'answerText2',
      'answerText3',
      'answerText4',
      'answerText5',
    ].forEach((k) => {
      expect(res.ignoredKeys).toContain(k);
    });
  });

  it('partialNoChoice なら一部の解説選択肢が空でも個別エラーにならない', () => {
    const entry = fillAllEditors(baseEntry());
    entry.answerEditorType = 'partialNoChoice';
    entry.answerText2 = '<p><br></p>';

    const res = autoCheck(entry);

    expect(res.missingEditorKeys).not.toContain('answerText2');
    expect(res.failedKeys).not.toContain('answerChoicesAllEmpty');
    expect(res.status).toBe('warning');
  });

  it('partialNoChoice で解説選択肢が全て空なら専用エラーになる', () => {
    const entry = fillAllEditors(baseEntry());
    entry.answerEditorType = 'partialNoChoice';
    entry.answerText1 = '<p><br></p>';
    entry.answerText2 = '<p><br></p>';
    entry.answerText3 = '<p><br></p>';
    entry.answerText4 = '<p><br></p>';
    entry.answerText5 = '<p><br></p>';

    const res = autoCheck(entry);

    expect(res.missingEditorKeys).not.toContain('answerText1');
    expect(res.failedKeys).toContain('answerChoicesAllEmpty');
    expect(res.status).toBe('error');
  });

  it('1級の partialNoChoice では answerText5 を除いた全空だけをエラーにする', () => {
    const entry = fillAllEditors(baseEntry());
    entry.grade = 0;
    entry.answerEditorType = 'partialNoChoice';
    entry.answerText1 = '<p><br></p>';
    entry.answerText2 = '<p><br></p>';
    entry.answerText3 = '<p><br></p>';
    entry.answerText4 = '<p><br></p>';
    entry.answerText5 = '<p>解答5</p>';

    const res = autoCheck(entry);

    expect(res.failedKeys).toContain('answerChoicesAllEmpty');
    expect(res.status).toBe('error');
  });

  it('HTMLのimgタグがあれば空扱いではない', () => {
    const entry = baseEntry();
    entry.text = '<p><strong>重要本文</strong><img alt="x" /></p>';
    entry.ch1 = '<p><img alt="y" /></p>';
    const res = autoCheck(entry);
    expect(res.missingEditorKeys).not.toContain('text');
    expect(res.missingEditorKeys).not.toContain('ch1');
  });

  it('HTMLにKaTeXや ql-formula があれば空扱いではない', () => {
    const entry = baseEntry();
    entry.text =
      '<p><span class="ql-formula" data-value="x^2"><span class="katex">rendered</span></span></p>';
    entry.ch1 = '<p><span class="katex">y</span></p>';

    const res = autoCheck(entry);

    expect(res.missingEditorKeys).not.toContain('text');
    expect(res.missingEditorKeys).not.toContain('ch1');
  });

  it('innerTextがあれば空扱いではない', () => {
    const entry = baseEntry();
    entry.text = '<p><strong>本文</strong></p>';
    entry.answerText1 = '<p>解答1</p>';
    const res = autoCheck(entry);
    expect(res.missingEditorKeys).not.toContain('text');
    expect(res.missingEditorKeys).not.toContain('answerText1');
  });

  it('問題本文に2文字以上のstrong要素が無ければerrorになる', () => {
    const entry = fillAllEditors(baseEntry());
    entry.text = '<p><strong>注</strong>本文です</p>';

    const res = autoCheck(entry);
    expect(res.status).toBe('error');
    expect(res.failedKeys).toContain('textStrong');
  });

  it('問題本文に2文字以上のstrong要素があれば追加エラーにならない', () => {
    const entry = fillAllEditors(baseEntry());
    entry.text = '<p>これは<strong>重要事項</strong>です</p>';

    const res = autoCheck(entry);
    expect(res.failedKeys).not.toContain('textStrong');
  });

  it('エディタが全て充足し、METAのみ欠落ならwarning', () => {
    const entry = fillAllEditors(baseEntry());
    const res = autoCheck(entry);
    expect(res.status).toBe('warning');
    expect(res.failedKeys.length).toBeGreaterThan(0);
    expect(res.missingEditorKeys.length).toBe(0);
    expect(res.missingMetaKeys.length).toBeGreaterThan(0);
  });

  it('editorTypeが欠落していればwarning', () => {
    const entry = fillAllEditors(baseEntry());
    entry.questionEditorType = undefined;
    entry.answerEditorType = undefined;
    const res = autoCheck(entry);
    expect(res.status).toBe('warning');
    expect(res.missingEditorType).toContain('questionEditorType');
    expect(res.missingEditorType).toContain('answerEditorType');
  });

  it('全て満たせばsuccess', () => {
    const entry = fillAllEditors(baseEntry());
    entry.subject = '学科Ⅰ';
    entry.answerNumber = '1';
    entry.nengo = '令和';
    entry.year = '5';
    entry.testNo = '10';
    entry.publicationYear = '2024';
    entry.publicationNo = '12';
    entry.difficult = '普通';
    entry.grade = 1;
    entry.bigCategoryTag = '大';
    entry.smallCategoryTag = '小';
    entry.themeTag = 'テーマ';
    entry.questionEditorType = 'normal';
    entry.answerEditorType = 'normal';

    const res = autoCheck(entry);
    expect(res.status).toBe('success');
    expect(res.failedKeys.length).toBe(0);
  });

  it('オリジナル問題では元号・年度・問題No・出典元情報・難易度が空でもsuccessになる', () => {
    const entry = fillAllEditors(baseEntry());
    entry.isOriginal = true;
    entry.subject = '学科Ⅰ';
    entry.answerNumber = '1';
    entry.grade = 1;
    entry.bigCategoryTag = '大分類';
    entry.smallCategoryTag = '小分類';
    entry.themeTag = 'テーマ';

    const res = autoCheck(entry);

    expect(res.missingMetaKeys.includes('nengo')).toBe(false);
    expect(res.missingMetaKeys.includes('year')).toBe(false);
    expect(res.missingMetaKeys.includes('testNo')).toBe(false);
    expect(res.missingMetaKeys.includes('publicationYear')).toBe(false);
    expect(res.missingMetaKeys.includes('publicationNo')).toBe(false);
    expect(res.missingMetaKeys.includes('difficult')).toBe(false);

    expect(res.status).toBe('success');
  });

  it('オリジナル問題でもsubjectなど他の必須メタが欠けていればsuccessにならない', () => {
    const entry = fillAllEditors(baseEntry());
    entry.isOriginal = true;
    entry.subject = '' as TestData['subject']; // subject未入力をシミュレート
    entry.answerNumber = '1';
    entry.grade = 1;
    entry.bigCategoryTag = '大分類';
    entry.smallCategoryTag = '小分類';
    entry.themeTag = 'テーマ';

    const res = autoCheck(entry);
    expect(res.missingMetaKeys).toContain('subject');
    expect(res.status).toBe('warning');
  });

  it('本試験過去問題では元号・年度・問題No・出典元情報・難易度が従来どおり必須', () => {
    const entry = fillAllEditors(baseEntry());
    entry.isOriginal = false;
    entry.subject = '学科Ⅰ';
    entry.answerNumber = '1';
    entry.grade = 1;
    entry.bigCategoryTag = '大分類';
    entry.smallCategoryTag = '小分類';
    entry.themeTag = 'テーマ';

    const res = autoCheck(entry);
    expect(res.missingMetaKeys).toContain('nengo');
    expect(res.missingMetaKeys).toContain('year');
    expect(res.missingMetaKeys).toContain('testNo');
    expect(res.missingMetaKeys).toContain('publicationYear');
    expect(res.missingMetaKeys).toContain('publicationNo');
    expect(res.missingMetaKeys).toContain('difficult');
    expect(res.status).toBe('warning');
  });

  it('本試験過去問題の重複IDが渡されたらerrorになる', () => {
    const entry = fillAllEditors(baseEntry());
    entry.isOriginal = false;
    entry.subject = '学科Ⅰ';
    entry.answerNumber = '1';
    entry.nengo = '令和';
    entry.year = '5';
    entry.testNo = '10';
    entry.publicationYear = '2024';
    entry.publicationNo = '12';
    entry.difficult = '普通';
    entry.grade = 1;
    entry.bigCategoryTag = '大';
    entry.smallCategoryTag = '小';
    entry.themeTag = 'テーマ';

    const res = autoCheck(entry, {
      duplicatePastExamIds: ['12', '27'],
    });

    expect(res.status).toBe('error');
    expect(res.failedKeys).toContain(PAST_EXAM_DUPLICATE_FAILED_KEY);
    expect(res.duplicatePastExamIds).toEqual(['12', '27']);
  });

  it('重複IDが空なら重複エラーは追加されない', () => {
    const entry = fillAllEditors(baseEntry());
    entry.isOriginal = false;
    entry.subject = '学科Ⅰ';
    entry.answerNumber = '1';
    entry.nengo = '令和';
    entry.year = '5';
    entry.testNo = '10';
    entry.publicationYear = '2024';
    entry.publicationNo = '12';
    entry.difficult = '普通';
    entry.grade = 1;
    entry.bigCategoryTag = '大';
    entry.smallCategoryTag = '小';
    entry.themeTag = 'テーマ';

    const res = autoCheck(entry, {
      duplicatePastExamIds: [],
    });

    expect(res.status).toBe('success');
    expect(res.failedKeys).not.toContain(PAST_EXAM_DUPLICATE_FAILED_KEY);
    expect(res.duplicatePastExamIds).toEqual([]);
  });
});
