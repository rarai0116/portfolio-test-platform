import React, {useCallback} from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {SettingCardData} from '@hooks/useGlobalSaveDataContext';
import tw from '../../tailwind.custom';
import SettingCard from '../organisms/settingCard';
import TaskSettingCard from '../organisms/settingCard/taskSettingCard';
import SavedSettngCard from '../organisms/settingCard/savedSettngCard';
import Spacer from './spacer';

type CardType = 'task' | 'saved' | 'previous' | 'interrupted';
type Props = {
  readonly list: string[];
  readonly isDisablePress?: boolean;
  readonly onPressOut?: (id: string, cardData?: SettingCardData | null) => void;
};

export const DisplaySavedSettingCardList = React.memo(
  ({list, isDisablePress = false, onPressOut}: Props) => {
    const renderItem = useCallback(
      ({item: id, index}: {readonly item: string; readonly index: number}) => (
        <View style={tw`w-full items-center`}>
          <SavedSettngCard
            id={id}
            isDisablePress={isDisablePress}
            onPressOut={onPressOut}
          />
          {index < list.length - 1 && <Spacer isHorizontal={false} size={12} />}
        </View>
      ),
      [isDisablePress, onPressOut, list.length],
    );

    const getItemType = useCallback((_item: string, _index: number) => {
      // アイテムタイプを返すことで、FlashListが最適化できる
      return 'SavedSettingCard';
    }, []);

    if (list.length === 0) {
      return <View />;
    }

    return (
      <FlashList
        removeClippedSubviews
        data={list}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        getItemType={getItemType}
        // 上下の余白(旧Spacer相当)はリスト内に内包する
        contentContainerStyle={tw`py-3`}
        // パフォーマンス最適化のオプション
        drawDistance={400}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

export const DispayTaskSettingCardList = React.memo(
  ({list, isDisablePress = false, onPressOut}: Props) => {
    const renderItem = useCallback(
      ({item: id, index}: {readonly item: string; readonly index: number}) => (
        <View style={tw`w-full items-center`}>
          <TaskSettingCard
            id={id}
            isDisablePress={isDisablePress}
            onPressOut={onPressOut}
          />
          {index < list.length - 1 && <Spacer isHorizontal={false} size={12} />}
        </View>
      ),
      [isDisablePress, onPressOut, list.length],
    );

    const getItemType = useCallback((_item: string, _index: number) => {
      // アイテムタイプを返すことで、FlashListが最適化できる
      return 'TaskSettingCard';
    }, []);

    if (list.length === 0) {
      return <View />;
    }

    return (
      <FlashList
        removeClippedSubviews
        data={list}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        getItemType={getItemType}
        contentContainerStyle={tw``}
        // パフォーマンス最適化のオプション
        drawDistance={400}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);
export const DisplaySettingCardList = React.memo(
  ({list, isDisablePress, onPressOut}: Props) => {
    const renderItem = useCallback(
      ({item: id, index}: {readonly item: string; readonly index: number}) => (
        <View style={tw`w-full items-center`}>
          <SettingCard
            id={id}
            isDisablePress={isDisablePress}
            onPressOut={onPressOut}
          />
          {index < list.length - 1 && <Spacer isHorizontal={false} size={12} />}
        </View>
      ),
      [isDisablePress, onPressOut, list.length],
    );

    const getItemType = useCallback((_item: string, _index: number) => {
      // アイテムタイプを返すことで、FlashListが最適化できる
      return 'settingCard';
    }, []);

    if (list.length === 0) {
      return <View />;
    }

    return (
      <FlashList
        removeClippedSubviews
        data={list}
        renderItem={renderItem}
        keyExtractor={(item) => item}
        getItemType={getItemType}
        contentContainerStyle={tw``}
        // パフォーマンス最適化のオプション
        drawDistance={400}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

DisplaySettingCardList.displayName = 'DisplaySettingCardList';

// 後方互換性のための関数エクスポート（既存コードがこれを使用している場合）
export const displaySettingCardList = (
  list: string[],
  cardType: CardType,
  isDisablePress?: boolean,
  onPressOut?: (id: string, cardData?: SettingCardData | null) => void,
) => {
  if (cardType === 'saved') {
    return (
      <DisplaySavedSettingCardList
        list={list}
        isDisablePress={isDisablePress}
        onPressOut={onPressOut}
      />
    );
  }

  if (cardType === 'task') {
    return (
      <DispayTaskSettingCardList
        list={list}
        isDisablePress={isDisablePress}
        onPressOut={onPressOut}
      />
    );
  }

  return (
    <DisplaySettingCardList
      list={list}
      isDisablePress={isDisablePress}
      onPressOut={onPressOut}
    />
  );
};

export default displaySettingCardList;
