import { createUid } from '@api/utils';
import type { EditorHandle } from '@parts/editor';
import Editor from '@parts/editor';
import type { Delta } from '@renderer/types/quillType';
import type { EditorKeyName } from '@shared/types/contracts';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radioGroup';
import { answerEditorType } from '@views/testDataEditor/store/useEditorTypeStore';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import type { Range } from 'quill';
import React, { useCallback, useId, useMemo } from 'react';

type Props = {
  answerRef?: React.Ref<EditorHandle>;
  answerChoiceRefs?: Array<React.Ref<EditorHandle> | null | undefined>;
  answerOldRef?: React.Ref<EditorHandle>;
  isSecondGrade?: boolean;
  onTextChange?: (delta: Delta, id: string) => void;
  onSelectionChange?: (id: string, range: Range | null) => void;
  onEditorReady?: (id: string) => void;
  onEditorTypeChange?: (nextValue: answerEditorType) => void;
  activeEditorKey?: EditorKeyName | null;
  readonly?: boolean;
  disabled?: boolean;
  invalidEditorKeys?: ReadonlySet<EditorKeyName>;
  invalidEditorType?: boolean;
};

const AnswerEditor = React.memo((props: Props) => {
  const id = useId();
  const { editMap, applyEditPatch } = useTestDataStore();
  const { selectedDataId } = useSelectedIdStore();

  const selectedAnswerEditorType: answerEditorType = useMemo(() => {
    //    console.log('DEBUG editMap:', editMap);
    //    console.log('DEBUG selectedDataId:', selectedDataId);

    if (!selectedDataId) {
      //      console.log('DEBUG: selectedDataId がない');
      return answerEditorType.normal;
    }
    if (!editMap[selectedDataId]) {
      //      console.log('DEBUG: editMap[selectedDataId] がない');
      return answerEditorType.normal;
    }
    const type = editMap[selectedDataId].data.answerEditorType;
    //    console.log('DEBUG: 取得した type =', type);
    return type ?? answerEditorType.normal;
  }, [editMap, selectedDataId]);
  const answerEditorTypeId1 = createUid(id, {
    prefix: 'answerEditor',
    suffix: 'type1',
  });
  const answerEditorTypeId2 = createUid(id, {
    prefix: 'answerEditor',
    suffix: 'type2',
  });
  const answerEditorTypeId3 = createUid(id, {
    prefix: 'answerEditor',
    suffix: 'type3',
  });
  const answerEditorTypeId4 = createUid(id, {
    prefix: 'answerEditor',
    suffix: 'type4',
  });
  const answerId = createUid(id, { prefix: 'answer' });
  const answer1Id = createUid(id, { prefix: 'answer', suffix: '1' });
  const answer2Id = createUid(id, { prefix: 'answer', suffix: '2' });
  const answer3Id = createUid(id, { prefix: 'answer', suffix: '3' });
  const answer4Id = createUid(id, { prefix: 'answer', suffix: '4' });
  const answer5Id = createUid(id, { prefix: 'answer', suffix: '5' });
  //const oldId = createUid(id, { prefix: 'old' });

  const hasEditorError = useCallback(
    (key: EditorKeyName) => props.invalidEditorKeys?.has(key) ?? false,
    [props.invalidEditorKeys],
  );

  const editorFrameClass = useCallback(
    (key: EditorKeyName) => {
      const isActive = props.activeEditorKey === key;
      const borderClass = isActive
        ? 'border-demoblue-100'
        : hasEditorError(key)
          ? 'border-error-border'
          : 'border-transparent';

      return ` border border-[3px] rounded-md
      ${props.readonly ? '' : 'transition-colors'} 
      ${borderClass}`;
    },
    [props.activeEditorKey, props.readonly, hasEditorError],
  );

  const editorTypeFrameClass = useMemo(
    () =>
      props.invalidEditorType
        ? 'flex flex-col gap-1 rounded-md border border-error-border p-2 transition-colors'
        : 'flex flex-col gap-1 rounded-md border border-transparent p-2 transition-colors',
    [props.invalidEditorType],
  );
  return (
    <div
      className="bg-white h-fit w-full flex flex-col gap-4 px-4 pt-4 pb-10"
      id={id}
    >
      <div className={editorTypeFrameClass}>
        <Label className="m-1">エディタの種類</Label>
        <RadioGroup
          value={selectedAnswerEditorType}
          disabled={props.disabled}
          onValueChange={(v: answerEditorType) => {
            if (props.disabled) return;
            if (!selectedDataId) return;
            applyEditPatch(selectedDataId, { answerEditorType: v });
            props.onEditorTypeChange?.(v);
          }}
          className="flex flex-row gap-4 pl-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={answerEditorTypeId1}
              disabled={props.disabled}
              value={answerEditorType.normal}
            />

            <Label htmlFor={answerEditorTypeId1}>通常</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={answerEditorTypeId2}
              disabled={props.disabled}
              value={answerEditorType.noHonbun}
            />
            <Label htmlFor={answerEditorTypeId2}>解説本文なし</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={answerEditorTypeId3}
              disabled={props.disabled}
              value={answerEditorType.partialNoChoice}
            />
            <Label htmlFor={answerEditorTypeId3}>一部選択肢なし</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={answerEditorTypeId4}
              disabled={props.disabled}
              value={answerEditorType.noChoice}
            />
            <Label htmlFor={answerEditorTypeId4}>選択肢なし</Label>
          </div>
        </RadioGroup>
      </div>

      <div
        className={`flex flex-col gap-1
          ${selectedAnswerEditorType === answerEditorType.noHonbun ? 'hidden' : ''}`}
      >
        <Label className="m-1">解説本文</Label>
        <div className={editorFrameClass('answerText')}>
          <Editor
            id={answerId}
            value=""
            ref={props.answerRef}
            readOnly={props.readonly}
            onSelectionChange={(range) => {
              props.onSelectionChange?.(answerId, range);
            }}
            onReady={() => props.onEditorReady?.(answerId)}
            onTextChange={(delta) => {
              if (props.onTextChange) {
                props.onTextChange(delta, answerId);
              }
            }}
          />
        </div>
      </div>

      <div
        className={`w-full flex flex-col gap-4 
                  ${selectedAnswerEditorType === answerEditorType.noChoice ? 'hidden' : ''}`}
      >
        <div className="flex flex-col gap-1">
          <Label className="m-1">解答1</Label>
          <div className={editorFrameClass('answerText1')}>
            <Editor
              id={answer1Id}
              value=""
              ref={props.answerChoiceRefs?.[0]}
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(answer1Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, answer1Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(answer1Id, range);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">解答2</Label>
          <div className={editorFrameClass('answerText2')}>
            <Editor
              id={answer2Id}
              value=""
              ref={props.answerChoiceRefs?.[1]}
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(answer2Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, answer2Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(answer2Id, range);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">解答3</Label>
          <div className={editorFrameClass('answerText3')}>
            <Editor
              id={answer3Id}
              value=""
              ref={props.answerChoiceRefs?.[2]}
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(answer3Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, answer3Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(answer3Id, range);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">解答4</Label>
          <div className={editorFrameClass('answerText4')}>
            <Editor
              id={answer4Id}
              value=""
              ref={props.answerChoiceRefs?.[3]}
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(answer4Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, answer4Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(answer4Id, range);
              }}
            />
          </div>
        </div>

        {props.isSecondGrade && (
          <div className="flex flex-col gap-1">
            <Label className="m-1">解答5</Label>
            <div className={editorFrameClass('answerText5')}>
              <Editor
                id={answer5Id}
                value=""
                ref={props.answerChoiceRefs?.[4]}
                readOnly={props.readonly}
                onReady={() => props.onEditorReady?.(answer5Id)}
                onTextChange={(_delta, _oldDelta, _source) => {
                  if (props.onTextChange && _source === 'user') {
                    props.onTextChange(_delta, answer5Id);
                  }
                }}
                onSelectionChange={(range) => {
                  props.onSelectionChange?.(answer5Id, range);
                }}
              />
            </div>
          </div>
        )}
        {/* <div className="flex flex-col gap-1">
          <Label className="m-1">旧</Label>
          <div>
            <Editor
              id={oldId}
              value=""
              ref={props.answerOldRef}
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(oldId)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange) {
                  if (_source === 'user') {
                    props.onTextChange(_delta, oldId);
                  }
                }
              }}
            />
          </div>
        </div> */}
      </div>
    </div>
  );
});

export default AnswerEditor;
