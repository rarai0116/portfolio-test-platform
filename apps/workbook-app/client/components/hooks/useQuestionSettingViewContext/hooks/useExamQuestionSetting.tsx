import type React from 'react';
import {useContext, useEffect, useMemo} from 'react';
import _ from 'lodash';
import {
  CheckButtonStates,
  useCheckedButtonList,
  type ButtonInfoList,
} from '../../useCheckButtonContext';
import {InitialSettingDataContext} from '../../useInitialSettingDataContext';
import {GlobalSaveDataContext} from '../../useGlobalSaveDataContext';
import {
  type QuestionModeType,
  type QuestionSettingStateType,
  questionMode,
  questionSettingState,
} from '../../../../types/commonUnionType';
/** Defined Types */
export type ExamSettingKey = 'subject' | 'numberOfQuestions';
export type ExamQuestionSettingType = Record<ExamSettingKey, ButtonInfoList>;
export type ExamQuestionSettingIdList = Record<ExamSettingKey, string[]>;

export type ExamQuestionSetting = {
  subject: ButtonInfoList;
  numberOfQuestions: ButtonInfoList;
  examQuestionSettingId: ExamQuestionSettingIdList;
  examSubjectCheckedButtonInfoList: ButtonInfoList;
  setExamSubjectCheckedButtonList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  examNumberOfQuestionsCheckedButtonList: ButtonInfoList;
  setExamNumberOfQuestionsCheckedButtonInfoList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  currentSelectedExamSettingIdList: ExamQuestionSettingIdList;
};

const useExamQuestionSetting: (props: {
  id: string;
  currentSetting: {
    currentSettingId: string;
    settingState: QuestionSettingStateType;
    questionModeType: QuestionModeType;
    isCalledSaved: boolean;
  };
}) => ExamQuestionSetting = (props) => {
  /** Props */
  const {currentSetting} = props;
  const {currentSettingId, settingState, questionModeType} = currentSetting;

  /** Load Context */
  const {
    initialExamSubjectButtonInfoList,
    initialExamQuestionSettingId,
    getExamNumberOfQuestionsButtonInfoList,
    idToCheckedButtonInfoList,
    idListToCheckedButtonList,
  } = useContext(InitialSettingDataContext);

  const {previousSavedSetting, answerlingTestSettingData, savedSettingList} =
    useContext(GlobalSaveDataContext);

  /** Load CheckButtonList */
  const [examSubjectCheckedButtonInfoList, setExamSubjectCheckedButtonList] =
    useCheckedButtonList(initialExamSubjectButtonInfoList);
  const [
    examNumberOfQuestionsCheckedButtonList,
    setExamNumberOfQuestionsCheckedButtonInfoList,
  ] = useCheckedButtonList(
    getExamNumberOfQuestionsButtonInfoList('subjectOneTwo'),
  );

  const currentSelectedExamSettingIdList: ExamQuestionSettingIdList =
    useMemo(() => {
      return {
        subject: examSubjectCheckedButtonInfoList.map((v) => v.id),
        numberOfQuestions: examNumberOfQuestionsCheckedButtonList.map(
          (v) => v.id,
        ),
      };
    }, [
      examSubjectCheckedButtonInfoList,
      examNumberOfQuestionsCheckedButtonList,
    ]);

  /** 模擬試験モードの設定id */
  const examQuestionSettingId: ExamQuestionSettingIdList = useMemo(() => {
    if (questionModeType === questionMode.exam) {
      // 保存した設定・課題の場合
      if (currentSettingId !== undefined) {
        if (
          settingState === questionSettingState.saved ||
          settingState === questionSettingState.task
        ) {
          if (!savedSettingList?.[currentSettingId]) {
            return initialExamQuestionSettingId;
          }

          return savedSettingList[currentSettingId].examQuestionSetting;
        }

        if (
          settingState === questionSettingState.previous &&
          previousSavedSetting !== null
        ) {
          return previousSavedSetting.examQuestionSetting;
        }

        if (
          settingState === questionSettingState.interrupted &&
          answerlingTestSettingData !== null &&
          answerlingTestSettingData.settingCardData.id === currentSettingId
        ) {
          return answerlingTestSettingData.settingCardData.examQuestionSetting;
        }
      }

      // 初期設定の場合
      return initialExamQuestionSettingId;
    }

    return initialExamQuestionSettingId;
  }, [
    settingState,
    questionModeType,
    currentSettingId,
    previousSavedSetting,
    answerlingTestSettingData,
    savedSettingList,
    initialExamQuestionSettingId,
  ]);

  /** 模擬試験モードの設定 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const {subject, numberOfQuestions} = useMemo<ExamQuestionSettingType>(() => {
    try {
      if (examSubjectCheckedButtonInfoList.length === 0) {
        return {
          subject: [],
          numberOfQuestions: [],
        };
      }

      const pattern = /eqs_\d級_(subject.+)/g;
      let numberOfQuestions: ButtonInfoList | undefined;
      if (examSubjectCheckedButtonInfoList.length > 0) {
        if (examSubjectCheckedButtonInfoList[0].id) {
          numberOfQuestions = getExamNumberOfQuestionsButtonInfoList(
            examSubjectCheckedButtonInfoList[0].id.replaceAll(pattern, '$1'),
          );
        } else {
          numberOfQuestions =
            getExamNumberOfQuestionsButtonInfoList('subjectOneTwo');
        }

        const initialSetting = _.cloneDeep({
          subject: initialExamSubjectButtonInfoList,
          numberOfQuestions,
        }) as ExamQuestionSettingType;

        const keys = Object.keys(initialSetting) as Array<
          keyof ExamQuestionSettingType
        >;

        return keys.reduce<ExamQuestionSettingType>((object, key) => {
          if (settingState === questionSettingState.initial) {
            return initialSetting;
          }

          // practiceExamSettingId: propsから渡されるid(保存された設定/課題として保存されたもの)
          // =>初期設定のbuttonInfoにidがあれば、checked
          object[key] = initialSetting[key].map((buttonInfo) => {
            if (examQuestionSettingId[key].includes(buttonInfo.id)) {
              if (settingState === questionSettingState.task) {
                return {
                  ...buttonInfo,
                  initialState: CheckButtonStates.disabledChecked,
                };
              }

              return {
                ...buttonInfo,
                initialState: CheckButtonStates.checked,
              };
            }

            if (settingState === questionSettingState.task) {
              return {...buttonInfo, initialState: CheckButtonStates.disabled};
            }

            return {...buttonInfo, initialState: CheckButtonStates.unchecked};
          });

          return object;
        }, initialSetting);
      }

      return {
        subject: [],
        numberOfQuestions: [],
      };
    } catch (error: unknown) {
      console.error('{subject, numberOfQuestions}：処理失敗', error);
      throw new Error('模擬試験モードの設定の初期化に失敗しました。');
    }
  }, [
    settingState,
    examQuestionSettingId,
    initialExamSubjectButtonInfoList,
    examSubjectCheckedButtonInfoList,
  ]);

  /** Defined Effects */
  /** settingStateが課題・保存した設定に変更されたときに各種ButtonListを更新する */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    const _settingState = settingState;
    const _settingModeType = questionModeType;
    if (_settingModeType !== questionMode.exam) return;
    if (
      _settingState === questionSettingState.saved ||
      _settingState === questionSettingState.task ||
      _settingState === questionSettingState.previous ||
      _settingState === questionSettingState.interrupted
    ) {
      const save =
        _settingState === questionSettingState.previous
          ? previousSavedSetting
          : savedSettingList[currentSettingId];

      if (!save) return;

      if (_settingModeType === questionMode.exam) {
        const subject = /_(\w+)$/.exec(save.examQuestionSetting.subject[0]);
        if (subject === null) {
          return;
        }

        setExamSubjectCheckedButtonList(
          idListToCheckedButtonList(
            save.examQuestionSetting.subject,
            initialExamSubjectButtonInfoList,
          ),
        );
        setExamNumberOfQuestionsCheckedButtonInfoList(
          idListToCheckedButtonList(
            save.examQuestionSetting.numberOfQuestions,
            getExamNumberOfQuestionsButtonInfoList(subject[1]),
          ),
        );
      }
    }
  }, [currentSetting]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // 初期設定以外は、初めに選択した学科をセット
    if (
      currentSettingId !== undefined &&
      !currentSettingId.includes('initialSetting')
    ) {
      const buttonInfo = idToCheckedButtonInfoList(
        examQuestionSettingId.subject[0],
        initialExamSubjectButtonInfoList,
      );
      setExamSubjectCheckedButtonList(buttonInfo);
    }
  }, [
    currentSettingId,
    examQuestionSettingId.subject,
    initialExamSubjectButtonInfoList,
  ]);

  return {
    subject,
    numberOfQuestions,
    examQuestionSettingId,
    examSubjectCheckedButtonInfoList,
    setExamSubjectCheckedButtonList,
    examNumberOfQuestionsCheckedButtonList,
    setExamNumberOfQuestionsCheckedButtonInfoList,
    currentSelectedExamSettingIdList,
  };
};

export default useExamQuestionSetting;
