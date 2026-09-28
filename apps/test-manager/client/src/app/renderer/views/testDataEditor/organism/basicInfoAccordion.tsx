import { createUid } from '@api/utils';
import type { TestData, TestSubject } from '@shared/types/contracts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/accordion';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

type BasicInfoState = {
  grade: number;
  subject: string;
  answerNumber: string;
  nengo: string;
  year: string;
  testNo: string;
  difficult: string;
  publicationYear: string;
  publicationNo: string;
  isOriginal: boolean;
};
type Props = {
  onPatchEdit: <K extends keyof TestData>(
    key: K,
    nextValue: TestData[K],
  ) => void;
  disabled?: boolean;
  invalidMetaKeys?: ReadonlySet<keyof TestData>;
};
const activeClass =
  'focus-visible:!border-demoblue-100 focus-visible:!ring-demoblue-100';
const errorClass = 'border-error-border ring-error-border ring-[2px]';
const publicationYearOptions = Array.from(
  { length: new Date().getFullYear() + 1 - 2010 + 1 },
  (_, index) => String(2010 + index),
).reverse();

const BasicInfoAccordion = React.memo(
  ({ onPatchEdit, disabled, invalidMetaKeys }: Props) => {
    const { selectedDataId } = useSelectedIdStore();
    const id = useId();
    const { editMap } = useTestDataStore();

    const answerId = createUid(id, { prefix: 'answer' });
    const gengouId = createUid(id, { prefix: 'gengou' });
    const yearId = createUid(id, { prefix: 'year' });
    const questionNoId = createUid(id, { prefix: 'questionNo' });
    const difficultyId = createUid(id, { prefix: 'difficulty' });
    const publicationYearId = createUid(id, { prefix: 'publicationYear' });
    const publicationNoId = createUid(id, { prefix: 'publicationNo' });
    //    const gradeId = createUid(id, { prefix: 'grade' });
    const subjectId = createUid(id, { prefix: 'subject' });

    const hasMetaError = useCallback(
      (key: keyof TestData) => invalidMetaKeys?.has(key) ?? false,
      [invalidMetaKeys],
    );
    // 初期値は編集データ（editMap）から取得。無ければ空
    const initialState: BasicInfoState = useMemo(() => {
      const src = selectedDataId ? editMap[selectedDataId]?.data : undefined;
      return {
        answerNumber: (src?.answerNumber as string) ?? '',
        nengo: (src?.nengo as string) ?? '',
        year: (src?.year as string) ?? '',
        testNo:
          src?.testNo && Number(src?.testNo) > 0 ? String(src?.testNo) : '',
        difficult: (src?.difficult as string) ?? '',
        publicationYear: (src?.publicationYear as string) ?? '',
        publicationNo: (src?.publicationNo as string) ?? '',
        grade: (src?.grade as number) ?? -1,
        subject: (src?.subject as string) ?? '',
        isOriginal: src?.isOriginal === true,
      };
    }, [selectedDataId, editMap]);

    const [state, setState] = useState<BasicInfoState>(initialState);
    useEffect(() => {
      setState(initialState);
    }, [initialState]);

    return (
      <Accordion
        type="single"
        collapsible
        defaultValue="item"
        className="w-full gap-4"
      >
        <AccordionItem
          value={`item`}
          className="bg-white rounded-md px-4 shadow-sm"
        >
          <AccordionTrigger>
            <div className="flex gap-5 text-nowrap flex-wrap">
              <div className="text-primary">No.{selectedDataId}</div>
              <div className="text-foreground text-sm font-normal">
                {state.isOriginal ? 'オリジナル問題' : '本試験過去問題'}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-2">
                <div>{state.grade + 1}級</div>
                {/* <Select
                  value={String(state.grade)}
                  disabled
                  onValueChange={(v) => {
                    const nv = Number(v);
                    setState((s) => ({ ...s, grade: nv }));
                    onPatchEdit('grade', nv);
                  }}
                >
                  <SelectTrigger id={gradeId} className="w-15" size="sm">
                    <SelectValue placeholder="ー" />
                  </SelectTrigger>
                  <SelectContent className="w-15">
                    <SelectGroup>
                      <SelectItem value="0">1級</SelectItem>
                      <SelectItem value="1">2級</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select> */}
                <Select
                  value={state.subject || undefined}
                  onValueChange={(v) => {
                    if (disabled) return;
                    setState((s) => ({ ...s, subject: v }));
                    onPatchEdit('subject', v as TestSubject);
                    onPatchEdit('bigCategoryTag', '');
                    onPatchEdit('smallCategoryTag', '');
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={subjectId}
                    className={`w-19 ${activeClass} ${hasMetaError('subject') ? errorClass : ''}`}
                    size="sm"
                  >
                    <SelectValue placeholder="ー" />
                  </SelectTrigger>
                  <SelectContent className="w-19">
                    <SelectGroup>
                      <SelectItem value="学科Ⅰ">学科Ⅰ</SelectItem>
                      <SelectItem value="学科Ⅱ">学科Ⅱ</SelectItem>
                      <SelectItem value="学科Ⅲ">学科Ⅲ</SelectItem>
                      <SelectItem value="学科Ⅳ">学科Ⅳ</SelectItem>
                      {state.grade === 0 && (
                        <SelectItem value="学科Ⅴ">学科Ⅴ</SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-xs" htmlFor={answerId}>
                    答え
                  </Label>
                  <Select
                    value={state.answerNumber || undefined}
                    disabled={disabled}
                    onValueChange={(v) => {
                      if (disabled) return;
                      setState((s) => ({ ...s, answerNumber: v }));
                      onPatchEdit('answerNumber', v);
                    }}
                  >
                    <SelectTrigger
                      id={answerId}
                      className={`w-12 ${activeClass} ${hasMetaError('answerNumber') ? errorClass : ''}`}
                      size="sm"
                    >
                      <SelectValue placeholder="ー" />
                    </SelectTrigger>
                    <SelectContent className="w-12">
                      <SelectGroup>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        {state.grade === 1 && (
                          <SelectItem value="5">5</SelectItem>
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Label className="text-xs" htmlFor={gengouId}>
                    元号
                  </Label>
                  <Select
                    value={state.nengo || undefined}
                    disabled={disabled}
                    onValueChange={(v) => {
                      if (disabled) return;
                      setState((s) => ({ ...s, nengo: v }));
                      onPatchEdit('nengo', v);
                    }}
                  >
                    <SelectTrigger
                      id={gengouId}
                      className={`w-12 ${activeClass} ${hasMetaError('nengo') ? errorClass : ''}`}
                      size="sm"
                    >
                      <SelectValue placeholder="ー" />
                    </SelectTrigger>
                    <SelectContent className="w-12">
                      <SelectGroup>
                        <SelectItem value="令和">R</SelectItem>
                        <SelectItem value="平成">H</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-row items-center gap-1">
                  <div className="flex flex-col items-center">
                    <Label className="text-xs mb-1" htmlFor={yearId}>
                      年度
                    </Label>
                    <Input
                      id={yearId}
                      className={`w-12 h-7 ${activeClass} ${hasMetaError('year') ? errorClass : ''}`}
                      value={state.year}
                      disabled={disabled}
                      onChange={(e) => {
                        if (disabled) return;
                        const v = e.target.value;
                        setState((s) => ({ ...s, year: v }));
                        onPatchEdit('year', v);
                      }}
                    />
                  </div>

                  <div className="mt-6 ">ー</div>

                  <div className="flex flex-col items-center">
                    <Label className="text-xs mb-1" htmlFor={questionNoId}>
                      問題No.
                    </Label>
                    <Input
                      id={questionNoId}
                      className={`w-12 h-7 ${activeClass} ${hasMetaError('testNo') ? errorClass : ''}`}
                      value={state.testNo}
                      disabled={disabled}
                      onChange={(e) => {
                        if (disabled) return;
                        // console.log('event:', e);
                        const text = e.target.value;
                        setState((s) => ({ ...s, testNo: text }));
                        onPatchEdit('testNo', text);
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Label className="text-xs" htmlFor={difficultyId}>
                    難易度
                  </Label>
                  <Select
                    value={state.difficult || undefined}
                    disabled={disabled}
                    onValueChange={(v) => {
                      if (disabled) return;
                      setState((s) => ({ ...s, difficult: v }));
                      onPatchEdit('difficult', v);
                    }}
                  >
                    <SelectTrigger
                      id={difficultyId}
                      className={`w-19 ${activeClass} ${hasMetaError('difficult') ? errorClass : ''}`}
                      size="sm"
                    >
                      <SelectValue placeholder="ー" />
                    </SelectTrigger>
                    <SelectContent className="w-19">
                      <SelectGroup>
                        <SelectItem value="1">☆</SelectItem>
                        <SelectItem value="2">☆☆</SelectItem>
                        <SelectItem value="3">☆☆☆</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <Label className="text-xs" htmlFor={publicationYearId}>
                      発行年
                    </Label>
                    <Select
                      value={state.publicationYear || undefined}
                      disabled={disabled}
                      onValueChange={(value?: string) => {
                        if (disabled) return;
                        setState((s) => ({
                          ...s,
                          publicationYear: value || '',
                        }));
                        onPatchEdit('publicationYear', value || '');
                      }}
                    >
                      <SelectTrigger
                        id={publicationYearId}
                        className={`w-24 ${activeClass} ${hasMetaError('publicationYear') ? errorClass : ''}`}
                        size="sm"
                      >
                        <SelectValue placeholder="----" />
                      </SelectTrigger>
                      <SelectContent className="w-24">
                        <SelectGroup>
                          {publicationYearOptions.map((publicationYear) => (
                            <SelectItem
                              key={publicationYear}
                              value={publicationYear}
                            >
                              {publicationYear}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <Label className="text-xs" htmlFor={publicationNoId}>
                      資料No
                    </Label>
                    <Input
                      id={publicationNoId}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className={`w-20 h-7 ${activeClass} ${hasMetaError('publicationNo') ? errorClass : ''}`}
                      disabled={disabled}
                      value={state.publicationNo}
                      onChange={(e) => {
                        if (disabled) return;
                        const value = e.target.value.replace(/\D/g, '');
                        setState((s) => ({ ...s, publicationNo: value }));
                        onPatchEdit('publicationNo', value);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  },
);

export default BasicInfoAccordion;
