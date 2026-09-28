/*
import {useEffect} from 'react';
import SubjectAccordionMenu from '../parts/subjectAccordionMenu';
// import {useAccordionMenuState} from '../hooks/useAccordionMenuState';

export type AccordionMenuProps = {readonly isSingleSelectionSubject?: boolean};

const AccordionMenu = (props: AccordionMenuProps) => {
  const {isSingleSelectionSubject = false} = props;
  const {subjectButtonInfolist} = useAccordionMenuState({
    isSingleSelectionSubject,
  });
  return (
    <>
      {subjectButtonInfolist.map((buttonInfo, no) => {
        return (
          <SubjectAccordionMenu
            key={buttonInfo.id}
            buttonInfo={buttonInfo}
            subject={buttonInfo.id.replace('subject-', '')}
          />
        );
      })}
    </>
  );
};

export default AccordionMenu;
*/
