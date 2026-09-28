import {useContext, useMemo, useCallback} from 'react';
import {FlashList} from '@shopify/flash-list';
import {
  type ButtonInfo,
  CheckButtonContext,
} from '../hooks/useCheckButtonContext';
// import {useAccordionMenuState} from '../hooks/useAccordionMenuState';
import BigCategoryAccordionMenu from '../parts/bigCategoryAccordionMenu';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import type {QuestionSubjectType} from '@/types/commonUnionType';

export type AccordionMenuProps = {
  readonly isSingleSelectionSubject?: boolean;
};

type AccordionData = {
  id: string;
  buttonInfo: ButtonInfo;
  subject: QuestionSubjectType;
};

const ModalAccordionMenu = (_props: AccordionMenuProps) => {
  const {categorySubject} = useContext(QuestionSettingViewContext);
  const {buttonInfoDictionary} = useContext(CheckButtonContext);

  // データ構造を配列に変換
  const accordionData: AccordionData[] = useMemo(() => {
    if (!categorySubject) return [];

    const buttonKeys = Object.keys(buttonInfoDictionary).filter((key) =>
      key.includes(`big-${categorySubject}-`, 0),
    );

    return buttonKeys.map((key) => ({
      id: key,
      buttonInfo: buttonInfoDictionary[key],
      subject: categorySubject,
    }));
  }, [categorySubject, buttonInfoDictionary]);

  const renderBigCategory = useCallback(
    ({item}: {readonly item: AccordionData}) => (
      <BigCategoryAccordionMenu
        key={`bcam-${item.buttonInfo.id}`}
        subject={item.subject}
        big={String(item.buttonInfo.value)}
        buttonInfo={item.buttonInfo}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: AccordionData) => item.id, []);

  if (!categorySubject) return null;

  return (
    <FlashList
      // パフォーマンス最適化
      removeClippedSubviews
      data={accordionData}
      renderItem={renderBigCategory}
      keyExtractor={keyExtractor}
    />
  );
};

export default ModalAccordionMenu;
