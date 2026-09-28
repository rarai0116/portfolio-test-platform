/*
import {useState, useCallback, useContext, useEffect, useMemo} from 'react';
import {get} from 'lodash';
import {ButtonStates} from './useButtonContext';
import type {ButtonInfo, ButtonInfoList} from './useCheckButtonContext';
import {CheckButtonContext, CheckButtonStates} from './useCheckButtonContext';

const RippleEffectModeState = {
  unchecked: 'Unchecked',
  checked: 'Checked',
  processing: 'Processing',
  none: 'None',
} as const;

type RippleEffectModeType =
  (typeof RippleEffectModeState)[keyof typeof RippleEffectModeState]; // 'Checked','Unchecked','Disabled'

type Props = {
  isSingleSelectionSubject?: boolean;
};

// Idからボタン情報を取得する
const getButtonInfoById = (id: string, buttonInfoList: ButtonInfoList) => {
  return buttonInfoList.find((buttonInfo) => buttonInfo.id === id);
};

export const useAccordionMenuState: (props: Props) => {
  subjectButtonInfolist: ButtonInfoList;
  isSingleSelectionSubject: boolean;
} = (props) => {
  const {
    buttonInfoList,
    toggleTargetButtonList,
    checkedButtonIdList,
    setToggleTargetButtonList,
    toggleTargetButtonIdList,
    setDisabledButtonInfoList,
    disabledButtonInfoList,
    checkedButtonList,
    buttonInfoDictionary,
    buttonInfoIdList,
  } = useContext(CheckButtonContext);

  const [downStreamRippleEffectTargetId, setDownStreamRippleEffectTargetId] =
    useState('');
  const [downStreamRippleEffectMode, setDownStreamRippleEffectMode] =
    useState<RippleEffectModeType>(RippleEffectModeState.none);
  const [upStreamRippleEffectTargetId, setUpStreamRippleEffectTargetId] =
    useState('');
  const [upStreamRippleEffectMode, setUpStreamRippleEffectMode] =
    useState<RippleEffectModeType>(RippleEffectModeState.none);
  // subjectは一つしか選べないようにするか否かを管理するステート
  const isSingleSelectionSubject = useMemo(
    () => props.isSingleSelectionSubject ?? false,
    [props.isSingleSelectionSubject],
  );

  // ボタンがチェックされた際の処理

  // 下位カテゴリへの波及効果の有無の判定
  const downStreamRippleEffectDetect = useCallback(() => {
    // 上位カテゴリが変更対象に指定された場合、下位カテゴリに波及効果を与える
    if (
      toggleTargetButtonList.length > 0 &&
      !toggleTargetButtonIdList[0].includes('small-', 0) &&
      downStreamRippleEffectMode === RippleEffectModeState.none
    ) {
      setDownStreamRippleEffectTargetId(toggleTargetButtonIdList[0]);
      // チェックされた場合と外された場合で処理を分ける
      if (checkedButtonIdList.includes(toggleTargetButtonIdList[0])) {
        // チェックを外される場合
        // console.warn('1.下流への波及モード開始:uncheck');
        setDownStreamRippleEffectMode(RippleEffectModeState.unchecked);
      } else {
        // チェックされる場合
        // console.warn('1.下流への波及モード開始:check');
        setDownStreamRippleEffectMode(RippleEffectModeState.checked);
      }
    }
  }, [
    toggleTargetButtonList,
    toggleTargetButtonIdList,
    checkedButtonIdList,
    downStreamRippleEffectMode,
  ]);

  // 上位カテゴリへの波及効果の有無の判定
  const upStreamRippleEffectDetect = useCallback(() => {
    // 下位カテゴリが変更対象に指定された場合、条件に合う場合上位カテゴリに波及効果を与える
    if (
      toggleTargetButtonList.length > 0 &&
      /^(big|small)/i.test(toggleTargetButtonIdList[0]) &&
      downStreamRippleEffectMode === RippleEffectModeState.none
    ) {
      // チェックボックスが変更されることで同カテゴリのチェックボックスが全てチェックされる、またはチェックが外れる場合波及モードを開始する
      const categoryPrefix = toggleTargetButtonIdList[0].replace(/[^-]*$/, '');
      const targetList = buttonInfoList
        .filter((buttonInfo) => {
          return (
            buttonInfo.id.includes(categoryPrefix, 0) &&
            buttonInfo.id !== toggleTargetButtonIdList[0]
          );
        })
        .map((buttonInfo) => {
          return buttonInfo.id;
        });

      if (checkedButtonIdList.includes(toggleTargetButtonIdList[0])) {
        // チェックを外す場合
        // 同属の他のチェックボックスも全てチェックされていた場合のみ波及効果を適用する
        if (
          targetList.every((targetId) => checkedButtonIdList.includes(targetId))
        ) {
          // console.warn('1.上流への波及モード開始:uncheck');
          setUpStreamRippleEffectTargetId(toggleTargetButtonIdList[0]);
          setUpStreamRippleEffectMode(RippleEffectModeState.unchecked);
        }
      } else if (
        targetList.every((targetId) => checkedButtonIdList.includes(targetId))
      ) {
        // チェックする場合
        // 同属の他のチェックボックスも全てチェックされていた場合のみ波及効果を適用する
        // console.warn('1.上流への波及モード開始:check');
        setUpStreamRippleEffectTargetId(toggleTargetButtonIdList[0]);
        setUpStreamRippleEffectMode(RippleEffectModeState.checked);
      }
    }
  }, [
    buttonInfoList,
    toggleTargetButtonList,
    toggleTargetButtonIdList,
    checkedButtonIdList,
    downStreamRippleEffectMode,
  ]);

  // 下位カテゴリへの波及効果適用
  const downStreamRippleEffect = useCallback(() => {
    if (toggleTargetButtonIdList.length === 0) {
      if (downStreamRippleEffectMode !== RippleEffectModeState.processing) {
        // console.warn('2.下流への波及処理対象の選定');
        const prefix = downStreamRippleEffectTargetId.replace(/-.*$/, '-');
        const headWord = downStreamRippleEffectTargetId
          .replace(prefix, '')
          .replaceAll(/[()]/g, '\\$&'); // エスケープ
        // 対象のチェックボックスを絞り込む
        const EffectedButtonInfoList: ButtonInfoList = buttonInfoList.filter(
          (buttonInfo) => {
            const regExp = prefix.includes('subject-')
              ? new RegExp(`^(big|small)-.*${headWord}-`, 'i')
              : new RegExp(`^small-.*${headWord}-`, 'i');
            if (downStreamRippleEffectMode === RippleEffectModeState.checked) {
              return (
                buttonInfo.id.match(regExp) &&
                !checkedButtonIdList.includes(buttonInfo.id)
              );
            }

            if (
              downStreamRippleEffectMode === RippleEffectModeState.unchecked
            ) {
              return (
                buttonInfo.id.match(regExp) &&
                checkedButtonIdList.includes(buttonInfo.id)
              );
            }

            return false;
          },
        );
        // console.log('EffectedButtonInfoList', EffectedButtonInfoList);
        if (EffectedButtonInfoList.length > 0) {
          setToggleTargetButtonList(EffectedButtonInfoList);
          setDownStreamRippleEffectMode(RippleEffectModeState.processing);
        } else {
          // console.warn('下流への波及効果の対象がない');
          initializeDownStreamRippleEffect();
        }
      } else if (
        downStreamRippleEffectMode === RippleEffectModeState.processing
      ) {
        // console.warn('3.下流への波及処理終了');
        initializeDownStreamRippleEffect();
      }
    }
  }, [
    buttonInfoList,
    downStreamRippleEffectMode,
    downStreamRippleEffectTargetId,
    toggleTargetButtonIdList,
    checkedButtonIdList,
  ]);
  // 上位カテゴリへの波及効果適用
  const upStreamRippleEffect = useCallback(() => {
    if (toggleTargetButtonIdList.length === 0) {
      if (upStreamRippleEffectMode === RippleEffectModeState.processing) {
        // console.warn('3.上流への波及処理終了');
        initializeUpStreamRippleEffect();
      } else if (upStreamRippleEffectMode !== RippleEffectModeState.none) {
        // console.warn('2.上流への波及処理対象の選定');
        // console.log(upStreamRippleEffectTargetId);
        const prefix = upStreamRippleEffectTargetId.replace(/-.*$/, '-');
        // console.log('prefix', prefix);
        // 対象が小カテゴリの場合
        if (prefix.includes('small-')) {
          const bigCategoryTargetId = upStreamRippleEffectTargetId.replace(
            /(small)(.*)(-[^-]*)$/,
            'big$2',
          );
          // console.log('bigCategoryTargetId', bigCategoryTargetId);
          const directBigTargetButtonInfo = getButtonInfoById(
            bigCategoryTargetId,
            buttonInfoList,
          );
          const bigCategoryPrefix = bigCategoryTargetId.replace(/-[^-]*$/, '');
          const bigCategoryTargetIdList = buttonInfoList
            .filter((buttonInfo) => {
              return (
                buttonInfo.id.includes(bigCategoryPrefix, 0) &&
                buttonInfo.id !== bigCategoryTargetId
              );
            })
            .map((buttonInfo) => {
              return buttonInfo.id;
            });
          // console.log('bigCategoryTargetIdList', bigCategoryTargetIdList);

          // 直系のSubjectカテゴリとbigカテゴリのチェックボックスをtoggleListに入れる
          const SubjectCategoryTargetId = bigCategoryTargetId.replace(
            /(big)(.*)(-[^-]*)$/,
            'subject$2',
          );
          const directSubjectTargetButtonInfo = getButtonInfoById(
            SubjectCategoryTargetId,
            buttonInfoList,
          );

          if (upStreamRippleEffectMode === RippleEffectModeState.checked) {
            // チェックをつける場合の処理
            // 同属の大カテゴリが全てcheckedかどうかの判定
            if (
              bigCategoryTargetIdList.every((targetId) =>
                checkedButtonIdList.includes(targetId),
              )
            ) {
              // 直系のSubjectカテゴリとbigカテゴリのチェックボックスをtoggleListに入れる
              setToggleTargetButtonList([
                directBigTargetButtonInfo,
                directSubjectTargetButtonInfo,
              ] as ButtonInfoList);
            } else {
              setToggleTargetButtonList([
                directBigTargetButtonInfo,
              ] as ButtonInfoList);
            }
          } else {
            // チェックを外す場合の処理
            // 直系のSubjectカテゴリがcheckedの場合、チェックを外す
            if (
              directSubjectTargetButtonInfo !== undefined &&
              checkedButtonIdList.includes(directSubjectTargetButtonInfo.id)
            ) {
              setToggleTargetButtonList([
                directBigTargetButtonInfo,
                directSubjectTargetButtonInfo,
              ] as ButtonInfoList);
            } else {
              setToggleTargetButtonList([
                directBigTargetButtonInfo,
              ] as ButtonInfoList);
            }
          }
        } else {
          // 対象がbigカテゴリの場合
          const subjectCategoryTargetId = upStreamRippleEffectTargetId.replace(
            /(big)(.*)(-[^-]*)$/,
            'subject$2',
          );
          const directSubjectTargetButtonInfo = getButtonInfoById(
            subjectCategoryTargetId,
            buttonInfoList,
          );
          // 直系のsubjectカテゴリのチェックボックスのみをtoggleListに入れる
          setToggleTargetButtonList([
            directSubjectTargetButtonInfo,
          ] as ButtonInfoList);
        }

        // 波及処理中にする
        setUpStreamRippleEffectMode(RippleEffectModeState.processing);
      }
    }
  }, [
    buttonInfoList,
    upStreamRippleEffectMode,
    upStreamRippleEffectTargetId,
    toggleTargetButtonIdList,
    checkedButtonIdList,
  ]);
  // 学科制限の管理
  const singleSelectionSubject = useCallback(() => {
    // 学科制限の管理
    if (checkedButtonIdList.length === 0) {
      // 全ての制限を外す
      const list: ButtonInfoList = buttonInfoList.filter((buttonInfo) => {
        return (
          buttonInfo.initialState === CheckButtonStates.disabled ||
          buttonInfo.initialState === CheckButtonStates.disabledChecked
        );
      });
      // console.log(list);
      setDisabledButtonInfoList(list);
      // console.log('選択制限解除', disabledButtonInfoList);
      // console.log('buttonInfoList', buttonInfoList);
    } else {
      // チェックがついている場合、チェックの付いている科目以外の全てのチェックボックスをロックする
      const subjectKey = /学科./.exec(checkedButtonList[0].id);
      const list: ButtonInfoList = buttonInfoList.filter((buttonInfo) => {
        return (
          buttonInfo.initialState === CheckButtonStates.disabled ||
          buttonInfo.initialState === CheckButtonStates.disabledChecked ||
          (subjectKey !== null && !buttonInfo.id.includes(subjectKey[0]))
        );
      });
      setDisabledButtonInfoList(list);
    }
  }, [checkedButtonList, buttonInfoList]);

  // buttonInfolistの中からsubjectに対応するものを抽出
  const subjectButtonInfolist: ButtonInfoList = useMemo(() => {
    return buttonInfoList.filter((buttonInfo) =>
      buttonInfo.id.includes('subject-', 0),
    );
  }, [buttonInfoList]);

  // 下位カテゴリの波及効果を初期化して終了
  const initializeDownStreamRippleEffect = useCallback(() => {
    setDownStreamRippleEffectTargetId('');
    setDownStreamRippleEffectMode(RippleEffectModeState.none);
  }, []);
  // 上位カテゴリの波及効果を初期化して終了
  const initializeUpStreamRippleEffect = useCallback(() => {
    setUpStreamRippleEffectTargetId('');
    setUpStreamRippleEffectMode(RippleEffectModeState.none);
  }, []);

  // 波及効果モードのトリガー判定
  useEffect(() => {
    // console.log('★');
    // console.log('toggleTargetButtonList', toggleTargetButtonList);
    // console.log('toggleTargetButtonIdList', toggleTargetButtonIdList);
    // console.log('rippleEffectMode', downStreamRippleEffectMode);
    // console.log('checkedButtonIdList', checkedButtonIdList);

    if (
      downStreamRippleEffectMode === RippleEffectModeState.none &&
      upStreamRippleEffectMode === RippleEffectModeState.none
    ) {
      downStreamRippleEffectDetect();
      upStreamRippleEffectDetect();
    }

  }, [toggleTargetButtonList]);

  useEffect(() => {
    if (isSingleSelectionSubject) {
      singleSelectionSubject();
    }
  }, [checkedButtonList]);
  useEffect(() => {
    if (downStreamRippleEffectMode !== RippleEffectModeState.none) {
      downStreamRippleEffect();
    } else if (upStreamRippleEffectMode !== RippleEffectModeState.none) {
      upStreamRippleEffect();
    }
  }, [
    checkedButtonIdList,
    downStreamRippleEffectMode,
    upStreamRippleEffectMode,
  ]);
  return {
    subjectButtonInfolist,
    isSingleSelectionSubject,
  };
};

*/
