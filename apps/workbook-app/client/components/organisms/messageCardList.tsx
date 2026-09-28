import {useContext, useMemo} from 'react';
import {messageCardStyle, messageSender} from '../../types/commonUnionType';
import displayMessageCardList from '../parts/displayMessageCardList';
import Spacer from '../parts/spacer';
import {
  GlobalSaveDataContext,
  type MessageCardData,
} from '../hooks/useGlobalSaveDataContext';

export type MessageCardListProps = {readonly index: number};

const MessageCardList = (props: MessageCardListProps) => {
  const {messageData} = useContext(GlobalSaveDataContext);

  /** 選択したタブに応じて表示するカードリストを変更 */
  const messageCardPropsList: MessageCardData[] = useMemo(() => {
    switch (props.index) {
      case 0: {
        return Object.values(messageData);
      }

      case 1: {
        return Object.values(messageData).filter((v, _i) => {
          return v.senderType === messageSender.teacher;
        });
      }

      case 2: {
        return Object.values(messageData).filter((v, _i) => {
          return v.senderType === messageSender.app;
        });
      }

      default: {
        return Object.values(messageData);
      }
    }
  }, [props.index, messageData]);

  /** cardStyleを追加 */
  const messageCardPropsListWithCardStyle = useMemo(() => {
    return messageCardPropsList.map((v) => ({
      ...v,
      cardType: messageCardStyle.summary,
    }));
  }, [messageCardPropsList]);

  return (
    <>
      <Spacer isHorizontal={false} size={12} />
      {displayMessageCardList({list: messageCardPropsListWithCardStyle})}
    </>
  );
};

export default MessageCardList;
