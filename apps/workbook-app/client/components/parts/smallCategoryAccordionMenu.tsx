import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import SmallCategoryAccordionMenuPart from './smallCategoryAccordionMenuPart';

export type SmallCategoryAccordionMenuProps = {
  readonly subject: string;
  readonly big: string;
  readonly small: string;
  readonly buttonInfo: ButtonInfo;
};

const SmallCategoryAccordionMenu = (props: SmallCategoryAccordionMenuProps) => {
  return (
    <SmallCategoryAccordionMenuPart
      key={`camp-${props.subject}-${props.big}-${props.small}`}
      categoryName="小カテゴリ―"
      buttonInfo={props.buttonInfo}
    />
  );
};

export default SmallCategoryAccordionMenu;
