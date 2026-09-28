import {createContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';

type InquiryFormContextObject = {
  isInitialOpen: boolean;
  setIsInitialOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type Props = {
  readonly children: ReactNode;
};

export const InquiryFormContext = createContext<InquiryFormContextObject>(
  {} as InquiryFormContextObject,
);

export const InquiryFormContextProvider = (props: Props) => {
  const [isInitialOpen, setIsInitialOpen] = useState<boolean>(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      isInitialOpen,
      setIsInitialOpen,
    };
  }, [isInitialOpen, setIsInitialOpen]);

  return (
    <InquiryFormContext.Provider value={value}>
      {props.children}
    </InquiryFormContext.Provider>
  );
};
