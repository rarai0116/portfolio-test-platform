import { createUid } from '@api/utils';
import BasicCreatableSelect from '@components/organism/basicCreatableSelect';
import BasicSingleCreatableSelect, {
  type BasicSingleCreatableSelectOption,
} from '@components/organism/basicSingleCreatableSelect';
import type { TestData, TestSubject } from '@shared/types/contracts';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@ui/accordion';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

type DetailInfoState = {
  bigCategoryTag: string;
  smallCategoryTag: string;
  themeTag: string;
  otherTags: string[];
};

type Props = {
  onPatchEdit: <K extends keyof TestData>(
    key: K,
    nextValue: TestData[K],
  ) => void;
  onPatchCategoryTags?: (
    patch: Pick<TestData, 'bigCategoryTag' | 'smallCategoryTag'>,
  ) => void;
  disabled?: boolean;
  invalidMetaKeys?: ReadonlySet<keyof TestData>;
  subject?: TestSubject;
  bigOptions: BasicSingleCreatableSelectOption[];
  smallOptions: BasicSingleCreatableSelectOption[];
  otherTagOptions?: BasicSingleCreatableSelectOption[];
  onCreateBigOption: (createdValue: string) => void;
  onCreateSmallOption: (createdValue: string, bigCategoryTag: string) => void;
  onCreateOtherTagOption?: (createdValue: string) => void;
};

const activeClass =
  'focus-visible:!border-demoblue-100 focus-visible:!ring-demoblue-100';

const DetailInfoAccordion = React.memo(
  ({
    onPatchEdit,
    disabled,
    invalidMetaKeys,
    subject,
    bigOptions,
    smallOptions,
    otherTagOptions = [],
    onCreateBigOption,
    onCreateSmallOption,
    onCreateOtherTagOption,
    onPatchCategoryTags,
  }: Props) => {
    const { selectedDataId, selectedGrade } = useSelectedIdStore();
    const { editMap } = useTestDataStore();

    const id = useId();
    const bigCategoryId = createUid(id, { prefix: 'bigCategory' });
    const smallCategoryId = createUid(id, { prefix: 'smallCategory' });
    const themeId = createUid(id, { prefix: 'theme' });

    const hasMetaError = useCallback(
      (key: keyof TestData) => invalidMetaKeys?.has(key) ?? false,
      [invalidMetaKeys],
    );
    // 初期値は編集データ（editMap）から取得。無ければ空
    const initialState: DetailInfoState = useMemo(() => {
      const src = selectedDataId ? editMap[selectedDataId]?.data : undefined;
      return {
        bigCategoryTag: (src?.bigCategoryTag as string) ?? '',
        smallCategoryTag: (src?.smallCategoryTag as string) ?? '',
        themeTag: (src?.themeTag as string) ?? '',
        otherTags: Array.isArray(src?.otherTags) ? src.otherTags : [],
        /*         isOriginal: src?.isOriginal === true,
         */
      };
    }, [selectedDataId, editMap]);

    const [state, setState] = useState<DetailInfoState>(initialState);
    useEffect(() => {
      setState(initialState);
    }, [initialState]);

    const findParentBigForSmall = useCallback(
      async (small: string): Promise<string | null> => {
        if (!subject) return null;

        const bigRes = await window.testCategory.getKey(selectedGrade, subject);
        if (!bigRes.ok) return null;

        for (const big of bigRes.keys) {
          const smallRes = await window.testCategory.getKey(
            selectedGrade,
            subject,
            big,
          );
          if (!smallRes.ok) continue;
          if (smallRes.keys.includes(small)) return big;
        }
        return null;
      },
      [selectedGrade, subject],
    );

    const setBigAndResetSmall = useCallback(
      (nextBig: string) => {
        setState((s) => ({
          ...s,
          bigCategoryTag: nextBig,
          smallCategoryTag: '',
        }));

        if (onPatchCategoryTags) {
          onPatchCategoryTags({
            bigCategoryTag: nextBig,
            smallCategoryTag: '',
          });
          return;
        }

        onPatchEdit('bigCategoryTag', nextBig);
        onPatchEdit('smallCategoryTag', '');
      },
      [onPatchEdit, onPatchCategoryTags],
    );

    const handleSmallChange = useCallback(
      async (nextSmall: string) => {
        // クリア
        if (!nextSmall) {
          setState((s) => ({ ...s, smallCategoryTag: '' }));
          onPatchEdit('smallCategoryTag', '');
          return;
        }

        // 現在の大カテゴリ配下に存在するなら、そのまま小だけ更新
        if (
          state.bigCategoryTag &&
          smallOptions.some((o) => o.value === nextSmall)
        ) {
          setState((s) => ({ ...s, smallCategoryTag: nextSmall }));
          onPatchEdit('smallCategoryTag', nextSmall);
          return;
        }

        // 大カテゴリが未選択/不整合の場合：親大カテゴリを逆引きして自動切替
        const parentBig = await findParentBigForSmall(nextSmall);
        if (parentBig) {
          setState((s) => ({
            ...s,
            bigCategoryTag: parentBig,
            smallCategoryTag: nextSmall,
          }));

          if (onPatchCategoryTags) {
            onPatchCategoryTags({
              bigCategoryTag: parentBig,
              smallCategoryTag: nextSmall,
            });
            return;
          }

          onPatchEdit('bigCategoryTag', parentBig);
          onPatchEdit('smallCategoryTag', nextSmall);
          return;
        }

        // フォールバック（DBに存在しない等）
        console.warn(
          'smallCategoryTag の親 bigCategoryTag を特定できませんでした',
          {
            selectedGrade,
            nextSmall,
          },
        );
        setState((s) => ({ ...s, smallCategoryTag: nextSmall }));
        onPatchEdit('smallCategoryTag', nextSmall);
      },
      [
        findParentBigForSmall,
        onPatchEdit,
        selectedGrade,
        smallOptions,
        state.bigCategoryTag,
        onPatchCategoryTags,
      ],
    );

    return (
      <Accordion
        type="single"
        collapsible
        defaultValue="item"
        className="w-full gap-2"
      >
        <AccordionItem
          value="item"
          className="bg-white rounded-md px-4 shadow-sm"
        >
          <AccordionTrigger>
            <div className="text-primary ml-2">詳細情報</div>
          </AccordionTrigger>

          <AccordionContent>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="ml-2">大分類</Label>
                <div className="mx-1 w-[98%]" id={bigCategoryId}>
                  <BasicSingleCreatableSelect
                    disabled={disabled}
                    invalid={hasMetaError('bigCategoryTag')}
                    value={state.bigCategoryTag}
                    options={bigOptions}
                    placeholder="大分類を選択/追加"
                    allowCreate
                    onCreateOption={(created) => {
                      if (disabled) return;
                      onCreateBigOption(created);
                      setBigAndResetSmall(created);
                    }}
                    onChange={(nextBig) => {
                      if (disabled) return;
                      setBigAndResetSmall(nextBig);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="ml-2">小分類</Label>
                <div className="mx-1 w-[98%]" id={smallCategoryId}>
                  <BasicSingleCreatableSelect
                    disabled={disabled}
                    invalid={hasMetaError('smallCategoryTag')}
                    value={state.smallCategoryTag}
                    options={smallOptions}
                    placeholder="小分類を選択/追加"
                    allowCreate={Boolean(state.bigCategoryTag)}
                    onCreateOption={(created) => {
                      if (disabled) return;
                      if (!state.bigCategoryTag) return;

                      onCreateSmallOption(created, state.bigCategoryTag);

                      setState((s) => ({ ...s, smallCategoryTag: created }));
                      onPatchEdit('smallCategoryTag', created);
                    }}
                    onChange={(nextSmall) => {
                      if (disabled) return;
                      void handleSmallChange(nextSmall);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="ml-2" htmlFor={themeId}>
                  テーマ
                </Label>
                <Input
                  id={themeId}
                  className={`w-[98%] h-9 mx-1 ${activeClass} ${
                    hasMetaError('themeTag')
                      ? 'border-error-border ring-error-border ring-2'
                      : ''
                  }`}
                  disabled={disabled}
                  value={state.themeTag}
                  onChange={(e) => {
                    if (disabled) return;
                    const v = e.target.value;
                    setState((s) => ({ ...s, themeTag: v }));
                    onPatchEdit('themeTag', v);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="ml-2">タグ</Label>
                <div className="mx-1 w-[98%]">
                  <BasicCreatableSelect
                    disabled={disabled}
                    defaultOption={otherTagOptions}
                    value={state.otherTags}
                    onCreateOption={(created) => {
                      if (disabled) return;
                      onCreateOtherTagOption?.(created);
                    }}
                    onChange={(next) => {
                      if (disabled) return;
                      setState((s) => ({ ...s, otherTags: next }));
                      onPatchEdit('otherTags', next);
                    }}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  },
);

export default DetailInfoAccordion;
