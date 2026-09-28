import {useContext, useMemo} from 'react';
import {GlobalSaveDataContext} from './useGlobalSaveDataContext';
import useCommonSettingCard, {
  type UseCommonSettingCardReturnType,
} from './useCommonSettingCard';

const useTaskSettingCard = (id: string): UseCommonSettingCardReturnType => {
  const {savedSettingList} = useContext(GlobalSaveDataContext);

  const cardData = useMemo(
    () => savedSettingList[id] ?? null,
    [id, savedSettingList],
  );
  const commonSetting = useCommonSettingCard(id, cardData);
  const value = useMemo(() => {
    return {
      ...commonSetting,
      cardData,
    };
  }, [commonSetting, cardData]);
  return value;
};

export default useTaskSettingCard;
