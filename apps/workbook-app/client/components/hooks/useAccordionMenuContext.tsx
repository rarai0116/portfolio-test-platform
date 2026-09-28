import {createContext, useState, useMemo, useCallback} from 'react';
import type {ReactNode} from 'react';

type AccordionMenuContextObject = {
  display: string;
  arrowDirection: string;
  handleAccordionMenu: () => void;
  // ボタン名の代替名リスト
  buttonNameAliasList: Record<string, string | number>;
};

type Props = {
  readonly children: ReactNode;
  readonly buttonNameAliasList?: Record<string, string | number>;
};

export const AccordionMenuContext = createContext<AccordionMenuContextObject>(
  {} as AccordionMenuContextObject,
);
/**
 * @module useAccordionMenuContext
 * @desc アコーディオンメニューの状態管理
 * @param {Props} props
 * @returns {ReactNode}
 */
export const AccordionMenuContextProvider = (props: Props) => {
  const [display, setDisplay] = useState<'flex' | 'hidden'>('hidden');
  const [arrowDirection, setArrowDirection] = useState<string>('down');

  const open = useCallback(() => {
    setDisplay('flex');
    setArrowDirection('up');
  }, []);

  const close = useCallback(() => {
    setDisplay('hidden');
    setArrowDirection('down');
  }, []);

  const handleAccordionMenu = useCallback(() => {
    if (display === 'hidden') {
      open();
      // console.log('あいたよ');
    } else {
      close();
      // console.log('とじたよ');
    }
  }, [display, open, close]);

  const value = useMemo(() => {
    return {
      buttonNameAliasList: props.buttonNameAliasList ?? {},
      display,
      arrowDirection,
      handleAccordionMenu,
    };
  }, [display, arrowDirection, handleAccordionMenu, props.buttonNameAliasList]);

  return (
    <AccordionMenuContext.Provider value={value}>
      {props.children}
    </AccordionMenuContext.Provider>
  );
};
