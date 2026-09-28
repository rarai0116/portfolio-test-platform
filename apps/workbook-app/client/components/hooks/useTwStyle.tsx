import {useState} from 'react';

export const useTwStyle = (
  init: string[],
): [string[], React.Dispatch<React.SetStateAction<string[]>>] => {
  const [twStyle, setTwStyle] = useState(init);
  return [twStyle, setTwStyle];
};
