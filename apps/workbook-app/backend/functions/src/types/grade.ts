/************************
 *  Grade
 * @description 級の定義
 ***********************/
const GradeList = {
  FirstGrade: 'firstGrade',
  SecondGrade: 'secondGrade',
  Common: 'common',
} as const;
export type GradeStr = (typeof GradeList)[keyof typeof GradeList];
/** Type Grade Method**/
export const isGrade = (value: string): value is GradeStr => {
  return Object.values(GradeList).includes(value as GradeStr);
};
const Grade = {
  isGrade,
  GradeList,
};
export type GradeNumber = 1 | 2;

export default Grade;
