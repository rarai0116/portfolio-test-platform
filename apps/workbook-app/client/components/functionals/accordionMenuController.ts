import type {ButtonInfo, ButtonInfoList} from '@hooks/useCheckButtonContext';
import {removeArrayElement} from '@functionals/arrayManager';
import {isEqual} from 'lodash';

type CategoryNameType = 'big' | 'small' | 'subject';

const categoryRank: Record<CategoryNameType, 0 | 1 | 2> = {
  small: 0,
  big: 1,
  subject: 2,
};
const rankCategory: Record<0 | 1 | 2, CategoryNameType> = {
  0: 'small',
  1: 'big',
  2: 'subject',
};
const getCategoryById: (id: string) => CategoryNameType | '不明' = (id) => {
  switch (/^([^-]+-)/.exec(id)?.[0]) {
    case 'big-': {
      return 'big';
    }

    case 'small-': {
      return 'small';
    }

    case 'subject-': {
      return 'subject';
    }

    default: {
      return '不明';
    }
  }
};

const getPrefixById: (id: string) => string[] = (id) => {
  const regex = /-(.+?)(?=-|$)/g;
  // matchAll を利用して各キャプチャグループ（ハイフン以降の部分）を配列で取得
  const segments = Array.from(id.matchAll(regex), (m) => m[1]);
  return segments;
};

// Idからボタン情報を取得する
const getButtonInfoById = (id: string, buttonInfoList: ButtonInfoList) => {
  return buttonInfoList.find((buttonInfo) => buttonInfo.id === id);
};

// 対象の下位カテゴリボタンリスト取得
const getLowerRankCategoryList = (
  _id: string,
  rank: 0 | 1 | 2,
  prefix: string[],
  rippleTargetState: boolean,
  buttonInfoIdList: string[],
  checkedButtonIdList: string[],
) => {
  const lowerRank = (rank - 1) as 0 | 1;

  if (lowerRank < 0) return [];
  const lowerCategoryType = rankCategory[lowerRank];

  const conditionsId = prefix.reduce((acc, cur) => {
    return `${acc}-${cur}`;
  }, `${lowerCategoryType}`);

  // 対象の下位カテゴリボタンリスト
  const lowerIdList = buttonInfoIdList.filter((targetId) => {
    return targetId.includes(conditionsId, 0);
  });
  if (rippleTargetState) {
    // チェックを外す場合
    // 下位カテゴリボタンリストの中でチェックされているものを返す
    return lowerIdList.filter((targetId) => {
      return checkedButtonIdList.includes(targetId);
    });
  } else {
    // チェックをつける場合
    // 下位カテゴリボタンリストの中でチェックされていないものを返す
    return lowerIdList.filter((targetId) => {
      return !checkedButtonIdList.includes(targetId);
    });
  }
};

// 対象の上位のカテゴリボタンリスト
// [チェックした場合]同ランクのカテゴリが全部チェックがついてる場合に上位にチェックをつける
// [チェックが外れた場合]同ランクが全てチェックされている状態でチェックが外れる場合、チェックを外す
const getUpperRankCategoryList = (
  id: string,
  rank: 0 | 1 | 2,
  prefix: string[],
  rippleTargetState: boolean,
  buttonInfoIdList: string[],
  checkedButtonIdList: string[],
) => {
  const upperRank = (rank + 1) as 1 | 2;

  if (upperRank > 2) return [];
  const upperCategoryType = rankCategory[upperRank];
  const sameCategoryType = rankCategory[rank];

  const targetId = prefix.reduce((acc, cur, index, array) => {
    // 最後の要素は無視する
    if (index === array.length - 1) return acc;
    return `${acc}-${cur}`;
  }, `${upperCategoryType}`);
  // 同ランクのID
  const SameRankId = prefix.reduce((acc, cur, index, array) => {
    // 最後の要素は無視する
    if (index === array.length - 1) return acc;
    return `${acc}-${cur}`;
  }, `${sameCategoryType}`);
  // 同ランクのリスト
  const sameRankList = buttonInfoIdList.filter((targetId) => {
    return targetId.includes(SameRankId, 0);
  });

  if (rippleTargetState) {
    // チェックを外す場合
    // すでにチェックがはずされている場合は何もしない
    if (!checkedButtonIdList.includes(targetId)) return [];
    // 同ランクが全てチェックされている状態でチェックが外れる場合、チェックを外す
    const isUncheck = sameRankList.every((_id) => {
      if (_id === id) return true;
      return checkedButtonIdList.includes(_id);
    });
    return isUncheck ? [targetId] : [];
  } else {
    // すでにチェックがついている場合は何もしない
    if (checkedButtonIdList.includes(targetId)) return [];
    // 同ランクが全てチェックされている状態でチェックされる場合、上位にチェックをつける
    const isCheck = sameRankList.every((_id) => {
      if (_id === id) return true;
      return checkedButtonIdList.includes(_id);
    });
    return isCheck ? [targetId] : [];
  }
};

// 対象のボタンの状態が反転することで、どのボタンに波及効果を与えるかどうかを判定する
const serchRippleEffectedTargetButtonIdList = (
  buttonInfo: ButtonInfo,
  checkedButtonIdList: string[],
  buttonInfoIdList: string[],
  checkAction?: 'check' | 'uncheck',
  startRank?: number,
) => {
  // 反転後にチェックされるかの判定
  const {id} = buttonInfo;
  const rippleTargetState = checkedButtonIdList.includes(id);
  checkAction ??= rippleTargetState ? 'uncheck' : 'check';
  const category = getCategoryById(id);
  if (category === '不明') {
    return {checkAction, startRank, rank: -1, list: []};
  }

  const rank = categoryRank[category];

  // チェックアクションの状態と、対象のボタンの状態が同じ場合、rankが2の場合は何もしない⭐︎
  if (
    (checkAction === 'uncheck' && !rippleTargetState) ||
    (checkAction === 'check' && rippleTargetState) ||
    rank === 2
  ) {
    return {checkAction, startRank, rank, list: []};
  }

  // 開始ランクと同じランクのものに対しては何もしない
  if (rank === startRank) return {checkAction, startRank, rank, list: []};
  if (startRank === undefined) startRank = rank;
  const prefix = getPrefixById(id);
  // 対象の下位カテゴリボタンリスト
  const lowerList = getLowerRankCategoryList(
    id,
    rank,
    prefix,
    rippleTargetState,
    buttonInfoIdList,
    checkedButtonIdList,
  );

  // 対象の上位のカテゴリボタンリスト
  const upperList = getUpperRankCategoryList(
    id,
    rank,
    prefix,
    rippleTargetState,
    buttonInfoIdList,
    checkedButtonIdList,
  );

  return {checkAction, startRank, rank, list: [...lowerList, ...upperList]};
};

export const handleCheckButton = (
  targetButtonIdList: string[],
  currentcheckedButtonIdList: string[],
  buttonIdList: string[],
  buttonInfoList: ButtonInfoList,
  checkAction?: 'check' | 'uncheck',
  _startRank?: number,
) => {
  // 現在のcheckedButtonListをletで取得
  // 初期値として波及対象のリストにtargetButtonInfoListをセット
  const rippleEffectTargetButtonList = targetButtonIdList;
  let newRippleEffectTargetButtonList: string[] = [];
  // rippleEffectTargetButtonListが空になるまでserchRippleEffectedTargetButtonIdListを実行
  for (const targetButtonId of rippleEffectTargetButtonList) {
    const targetButtonInfo = getButtonInfoById(targetButtonId, buttonInfoList);
    // 対象のボタン情報が取得できない場合はスキップ
    if (!targetButtonInfo) {
      continue;
    }

    // 対象のボタンの状態が反転することで、どのボタンに波及効果を与えるかどうかを判定する
    const result = serchRippleEffectedTargetButtonIdList(
      targetButtonInfo,
      currentcheckedButtonIdList,
      buttonIdList,
      checkAction,
      _startRank,
    );
    void [isEqual(_startRank, result.rank)];
    // ランクが2の場合は何もしない⭐︎
    if (result.rank === 2) continue;
    // 対象のランクが同じ場合は何もしない
    if (isEqual(_startRank, result.rank)) continue;
    // ランクを更新する
    if (_startRank === undefined) _startRank = result.startRank;
    checkAction = result.checkAction;
    newRippleEffectTargetButtonList.push(...result.list);
    // 重複を削除
    newRippleEffectTargetButtonList = [
      ...new Set(newRippleEffectTargetButtonList),
    ];
    // targetButtonIdをcheckedButtonIdListに存在しないなら加え、存在するなら追加する
    if (currentcheckedButtonIdList.includes(targetButtonId)) {
      // checkActionがcheckedなら何もしない
      if (checkAction === 'check') continue;
      // チェックを外す場合

      currentcheckedButtonIdList = removeArrayElement(
        targetButtonId,
        currentcheckedButtonIdList,
      );
    } else {
      // チェックをつける場合
      // checkActionがuncheckedなら何もしない
      if (checkAction === 'uncheck') continue;

      currentcheckedButtonIdList.push(targetButtonId);
    }
  }

  if (newRippleEffectTargetButtonList.length === 0)
    return currentcheckedButtonIdList;

  // 波及効果のあったボタンでもう一度handleCheckButtonを実行
  currentcheckedButtonIdList = handleCheckButton(
    newRippleEffectTargetButtonList,
    currentcheckedButtonIdList,
    buttonIdList,
    buttonInfoList,
    checkAction,
    _startRank,
  );
  return currentcheckedButtonIdList;
};
