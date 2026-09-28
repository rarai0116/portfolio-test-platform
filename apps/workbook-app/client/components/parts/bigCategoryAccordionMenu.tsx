import {memo} from 'react';
import {useContext, useMemo} from 'react';
import type {ButtonInfo, ButtonInfoList} from '../hooks/useCheckButtonContext';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import {AccordionMenuContextProvider} from '../hooks/useAccordionMenuContext';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import CategoryAccordionMenuPart from './categoryAccordionMenuPart';
import SmallCategoryAccordionHeader from './smallCategoryAccordionHeader';

export type BigCategoryAccordionMenuProps = {
  readonly subject: string;
  readonly big: string;
  readonly buttonInfo: ButtonInfo;
};

const BigCategoryAccordionMenu = memo(
  (props: BigCategoryAccordionMenuProps) => {
    // SubjectAccordionMenuのProviderからの情報
    const {questionCountMap} = useContext(QuestionSettingViewContext);
    const {buttonInfoDictionary} = useContext(CheckButtonContext);
    // buttonInfolistの中からsubjectおよびbigCategoryに属するsmallCategoryを抽出
    /*
  const smallCategoryButtonInfoList: ButtonInfoList = useMemo(() => {
    return buttonInfoList.filter((buttonInfo) => {
      return buttonInfo.id.includes(`small-${props.subject}-${props.big}-`, 0);
    });
  }, [buttonInfoList, props.subject, props.big]);
  */

    const smallcategoryAccordions = useMemo(() => {
      /*
    console.log(
      'buttonInfoDictionary',
      buttonInfoDictionary,
      `small-${props.subject}-${props.big}-`,
    );
    */
      const targetKeys = Object.keys(buttonInfoDictionary).filter((key) =>
        key.includes(`small-${props.subject}-${props.big}-`, 0),
      );
      // console.log('targetKeys', targetKeys);
      const targetButtonInfoList = targetKeys.reduce<ButtonInfoList>(
        (acc, key) => {
          const buttonInfo = buttonInfoDictionary[key];
          if (!buttonInfo) return acc;
          acc.push(buttonInfo);
          return acc;
        },
        [],
      );
      // console.log('targetButtonInfoList', targetButtonInfoList);
      return targetButtonInfoList.map((buttonInfo) => {
        return (
          <SmallCategoryAccordionHeader
            key={`scah-${buttonInfo.id}`}
            style="bg-white border-b border-quaternary"
            checkBoxStyle="ml-2"
            buttonInfo={buttonInfo}
          />
        );
      });
    }, [buttonInfoDictionary, props.subject, props.big]);

    return (
      <AccordionMenuContextProvider
        key={`amcp-${props.buttonInfo.id}`}
        buttonNameAliasList={questionCountMap}
      >
        <CategoryAccordionMenuPart
          key={`camp-${props.subject}-${props.big}`}
          hasBody
          categoryName="大カテゴリ―"
          buttonInfo={props.buttonInfo}
        >
          {smallcategoryAccordions}
        </CategoryAccordionMenuPart>
      </AccordionMenuContextProvider>
    );
  },
);

export default BigCategoryAccordionMenu;
