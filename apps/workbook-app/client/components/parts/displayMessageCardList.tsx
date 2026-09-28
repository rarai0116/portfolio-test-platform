import {View} from 'react-native';
import tw from '../../tailwind.custom';
import MessageCard from '../organisms/messageCard';
import type {MessageCardStyleType} from '../../types/commonUnionType';
import Spacer from './spacer';

type Props = {
  readonly list: Array<{
    id: string;
    cardType: MessageCardStyleType;
  }>;
};
const displayMessageCardList = ({list}: Props) => {
  const cards = list.map((v, i) => {
    return (
      <View key={v.id} style={tw`w-full items-center`}>
        <MessageCard
          key={v.id}
          id={v.id}
          cardType={v.cardType}
          /*
					isNew={v.isNew}
					sender={v.sender}
					senderType={v.senderType}
					date={v.date}
					title={v.title}
					content={v.content}
					linkedTaskId={v.linkedTaskId}
					*/
        />
        {!(i === list.length - 1) && <Spacer isHorizontal={false} size={12} />}
      </View>
    );
  });

  return <View>{cards}</View>;
};

export default displayMessageCardList;
