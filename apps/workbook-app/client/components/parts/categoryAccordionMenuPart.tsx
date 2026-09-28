import {useContext, useMemo} from 'react';
import type {ReactNode} from 'react';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import {AccordionMenuContext} from '../hooks/useAccordionMenuContext';
import type {CategoryNameType} from '../../types/commonUnionType';
import {questionCategoryName} from '../../types/commonUnionType';
import CategoryAccordionHeader from './categoryAccordionHeader';

export type CategoryAccordionMenuPartProps = {
  readonly children?: ReactNode;
  readonly buttonInfo: ButtonInfo;
  readonly hasBody: boolean;
  readonly categoryName: CategoryNameType;
};

const CategoryAccordionMenuPart = (props: CategoryAccordionMenuPartProps) => {
  const {display} = useContext(AccordionMenuContext);
  const [headerStyle, checkBoxStyle, arrowColor] = useMemo(() => {
    switch (props.categoryName) {
      case questionCategoryName.subject: {
        return [
          'h-13 bg-workbookblue-50 border-b border-quaternary',
          '',
          '#289DF4',
        ];
      }

      case questionCategoryName.bigCategory: {
        return ['bg-quaternary border-b border-quaternary', '', '#727272'];
      }

      case questionCategoryName.smallCategory: {
        return ['bg-white border-b border-quaternary', 'ml-2', '#727272'];
      }
    }
  }, [props.categoryName]);
  /*
  const [headerStyle, setHeaderStyle] = useState(
    'bg-quaternary border-b border-quaternary',
  );
  const [checkBoxStyle, setCheckBoxStyle] = useState('');
  const [arrowColor, setArrowColor] = useState('#727272');

  useEffect(() => {
    // console.log('props.categoryName', props.categoryName);
    switch (props.categoryName) {
      case questionCategoryName.subject: {
        setHeaderStyle('h-13 bg-workbookblue-50 border-b border-quaternary');
        setCheckBoxStyle('');
        setArrowColor('#289DF4');
        break;
      }

      case questionCategoryName.bigCategory: {
        setHeaderStyle('bg-quaternary border-b border-quaternary');
        setCheckBoxStyle('');
        setArrowColor('#727272');
        break;
      }

      case questionCategoryName.smallCategory: {
        setHeaderStyle('bg-white border-b border-quaternary');
        setCheckBoxStyle('ml-2');
        break;
      }
    }
  }, [props.categoryName]);
  */

  return (
    <>
      <CategoryAccordionHeader
        key={`cah-${props.buttonInfo.id}`}
        style={headerStyle}
        checkBoxStyle={checkBoxStyle}
        buttonInfo={props.buttonInfo}
        arrowColor={arrowColor}
      />
      {props.hasBody && display === 'flex' && props.children}
    </>
  );
};

export default CategoryAccordionMenuPart;
