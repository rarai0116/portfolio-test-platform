import { createUid } from '@api/utils';
import Editor, { type EditorHandle } from '@parts/editor';
import type { Delta } from '@renderer/types/quillType';
import type { EditorKeyName } from '@shared/types/contracts';
import { questionEditorType } from '@shared/types/contracts';
import { Label } from '@ui/label';
import { RadioGroup, RadioGroupItem } from '@ui/radioGroup';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import type { Range } from 'quill';
import { useCallback, useId, useMemo } from 'react';

type Props = {
  questionRef?: React.Ref<EditorHandle>;
  choiceRefs?: Array<React.Ref<EditorHandle> | null | undefined>;
  oldRef?: React.Ref<EditorHandle>;
  isSecondGrade?: boolean;
  invalidEditorKeys?: ReadonlySet<EditorKeyName>;
  invalidEditorType?: boolean;
  activeEditorKey?: EditorKeyName | null;
  onTextChange?: (delta: Delta, id: string) => void;
  onSelectionChange?: (id: string, range: Range | null) => void;
  onEditorReady?: (id: string) => void;
  onEditorTypeChange?: (nextValue: questionEditorType) => void;
  readonly?: boolean;
  disabled?: boolean;
};

const QuestionEditor = (props: Props) => {
  const id = useId();
  const { editMap, applyEditPatch } = useTestDataStore();
  const { selectedDataId } = useSelectedIdStore();
  const selectedQuestionEditorType: questionEditorType = useMemo(() => {
    if (!selectedDataId) return questionEditorType.normal;
    if (!editMap[selectedDataId]) return questionEditorType.normal;
    return (
      editMap[selectedDataId].data.questionEditorType ??
      questionEditorType.normal
    );
  }, [editMap, selectedDataId]);
  const questionEditorTypeId1 = createUid(id, {
    prefix: 'questionEditor_',
    suffix: '_type1',
  });
  const questionEditorTypeId2 = createUid(id, {
    prefix: 'questionEditor_',
    suffix: '_type2',
  });
  const questionId = createUid(id, { prefix: 'question' });
  const choice1Id = createUid(id, { prefix: 'choice', suffix: '1' });
  const choice2Id = createUid(id, { prefix: 'choice', suffix: '2' });
  const choice3Id = createUid(id, { prefix: 'choice', suffix: '3' });
  const choice4Id = createUid(id, { prefix: 'choice', suffix: '4' });
  const choice5Id = createUid(id, { prefix: 'choice', suffix: '5' });
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
          value={selectedQuestionEditorType}
          disabled={props.disabled}
          onValueChange={(v: questionEditorType) => {
            console.log('onValueChange', v);
            if (props.disabled) return;
            if (!selectedDataId) return;
            applyEditPatch(selectedDataId, { questionEditorType: v });
            props.onEditorTypeChange?.(v);
          }}
          className="flex flex-row gap-4 pl-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={questionEditorTypeId1}
              value={questionEditorType.normal}
              disabled={props.disabled}
            />
            <Label htmlFor={questionEditorTypeId1}>通常</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              id={questionEditorTypeId2}
              value={questionEditorType.noChoice}
              disabled={props.disabled}
            />
            <Label htmlFor={questionEditorTypeId2}>選択肢なし</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="w-full flex flex-col gap-1">
        <Label className="m-1">問題本文</Label>
        <div className={editorFrameClass('text')}>
          <Editor
            ref={props.questionRef}
            id={questionId}
            value=""
            onReady={() => props.onEditorReady?.(questionId)}
            readOnly={props.readonly}
            onSelectionChange={(range) => {
              props.onSelectionChange?.(questionId, range);
            }}
            onTextChange={(delta) => {
              if (props.onTextChange) {
                props.onTextChange(delta, questionId);
              }
            }}
          />
        </div>
      </div>

      <div
        className={`w-full flex flex-col gap-4
          ${selectedQuestionEditorType === questionEditorType.noChoice ? 'hidden' : ''}`}
      >
        <div className="flex flex-col gap-1">
          <Label className="m-1">選択肢1</Label>
          <div className={editorFrameClass('ch1')}>
            <Editor
              ref={props.choiceRefs?.[0]}
              id={choice1Id}
              value=""
              readOnly={props.readonly}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(choice1Id, range);
              }}
              onTextChange={(delta) => {
                if (props.onTextChange) {
                  props.onTextChange(delta, choice1Id);
                }
              }}
              onReady={() => props.onEditorReady?.(choice1Id)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">選択肢2</Label>
          <div className={editorFrameClass('ch2')}>
            <Editor
              ref={props.choiceRefs?.[1]}
              id={choice2Id}
              value=""
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(choice2Id)}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(choice2Id, range);
              }}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, choice2Id);
                }
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">選択肢3</Label>
          <div className={editorFrameClass('ch3')}>
            <Editor
              ref={props.choiceRefs?.[2]}
              id={choice3Id}
              value=""
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(choice3Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, choice3Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(choice3Id, range);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="m-1">選択肢4</Label>
          <div className={editorFrameClass('ch4')}>
            <Editor
              ref={props.choiceRefs?.[3]}
              id={choice4Id}
              value=""
              readOnly={props.readonly}
              onReady={() => props.onEditorReady?.(choice4Id)}
              onTextChange={(_delta, _oldDelta, _source) => {
                if (props.onTextChange && _source === 'user') {
                  props.onTextChange(_delta, choice4Id);
                }
              }}
              onSelectionChange={(range) => {
                props.onSelectionChange?.(choice4Id, range);
              }}
            />
          </div>
        </div>

        {props.isSecondGrade && (
          <div className="flex flex-col gap-1">
            <Label className="m-1">選択肢5</Label>
            <div className={editorFrameClass('ch5')}>
              <Editor
                ref={props.choiceRefs?.[4]}
                id={choice5Id}
                value=""
                readOnly={props.readonly}
                onReady={() => props.onEditorReady?.(choice5Id)}
                onTextChange={(_delta, _oldDelta, _source) => {
                  if (props.onTextChange && _source === 'user') {
                    props.onTextChange(_delta, choice5Id);
                  }
                }}
                onSelectionChange={(range) => {
                  props.onSelectionChange?.(choice5Id, range);
                }}
              />
            </div>
          </div>
        )}
        {/* <div className="flex flex-col gap-1">
          <Label className="m-1">旧</Label>
          <div>
            <Editor
              ref={props.oldRef}
              id={oldId}
              value=""
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
};

export default QuestionEditor;
