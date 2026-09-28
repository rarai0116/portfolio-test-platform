import {useMemo} from 'react';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import type {CategoryNameType} from '../../types/commonUnionType';
import {questionCategoryName} from '../../types/commonUnionType';
import SmallCategoryAccordionHeader from './smallCategoryAccordionHeader';

export type SmallCategoryAccordionMenuPartProps = {
  readonly buttonInfo: ButtonInfo;
  readonly categoryName: CategoryNameType;
};

const SmallCategoryAccordionMenuPart = (
  props: SmallCategoryAccordionMenuPartProps,
) => {
  const [headerStyle, checkBoxStyle] = useMemo(() => {
    switch (props.categoryName) {
      case questionCategoryName.subject: {
        return ['h-13 bg-workbookblue-50 border-b border-quaternary', ''];
      }

      case questionCategoryName.bigCategory: {
        return ['bg-quaternary border-b border-quaternary', ''];
      }

      case questionCategoryName.smallCategory: {
        return ['bg-white border-b border-quaternary', 'ml-2'];
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
    <SmallCategoryAccordionHeader
      key={`cah-${props.buttonInfo.id}`}
      style={headerStyle}
      checkBoxStyle={checkBoxStyle}
      buttonInfo={props.buttonInfo}
    />
  );
};

export default SmallCategoryAccordionMenuPart;
