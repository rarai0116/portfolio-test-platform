import type { TestSubject } from '@shared/types/contracts';
import answerCover1Url from '../../../../../../../resources/coverData/exam/answer/cover1.png?url';
import answerCover2Url from '../../../../../../../resources/coverData/exam/answer/cover2.png?url';
import answerCover3Url from '../../../../../../../resources/coverData/exam/answer/cover3.png?url';
import answerCover4Url from '../../../../../../../resources/coverData/exam/answer/cover4.png?url';
import answerCover5Url from '../../../../../../../resources/coverData/exam/answer/cover5.png?url';
import questionCover1Url from '../../../../../../../resources/coverData/exam/question/cover1.png?url';
import questionCover2Url from '../../../../../../../resources/coverData/exam/question/cover2.png?url';
import questionCover3Url from '../../../../../../../resources/coverData/exam/question/cover3.png?url';
import middleCover1Url from '../../../../../../../resources/coverData/exam/question/middleCover1.png?url';
import middleCover2Url from '../../../../../../../resources/coverData/exam/question/middleCover2.png?url';

export const examQuestionCoverUrls = {
  cover1: questionCover1Url,
  cover2: questionCover2Url,
  cover3: questionCover3Url,
  middleCover1: middleCover1Url,
  middleCover2: middleCover2Url,
} as const;

export const examMiddleCoverUrls = {
  middleCover1: middleCover1Url,
  middleCover2: middleCover2Url,
} as const;

export const examAnswerCoverUrls = {
  cover1: answerCover1Url,
  cover2: answerCover2Url,
  cover3: answerCover3Url,
  cover4: answerCover4Url,
  cover5: answerCover5Url,
} as const;

export type ExamQuestionCoverKey = keyof typeof examQuestionCoverUrls;
export type ExamMiddleCoverKey = keyof typeof examMiddleCoverUrls;
export type ExamAnswerCoverKey = keyof typeof examAnswerCoverUrls;

export const subjectSirializer = (gradeNumber: 1 | 2, subject: TestSubject) => {
  if (gradeNumber === 1) {
    switch (subject) {
      case '学科Ⅰ':
        return '学科Ⅰ（計画）';
      case '学科Ⅱ':
        return '学科Ⅱ（環境・設備）';
      case '学科Ⅲ':
        return '学科Ⅲ（法規）';
      case '学科Ⅳ':
        return '学科Ⅳ（構造）';
      case '学科Ⅴ':
        return '学科Ⅴ（施工）';
      default:
        return subject;
    }
  } else {
    switch (subject) {
      case '学科Ⅰ':
        return '学科Ⅰ（建築計画）';
      case '学科Ⅱ':
        return '学科Ⅱ（建築法規）';
      case '学科Ⅲ':
        return '学科Ⅲ（建築構造）';
      case '学科Ⅳ':
        return '学科Ⅳ（建築施工）';
      default:
        return subject;
    }
  }
};
