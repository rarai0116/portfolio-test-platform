import {View} from 'react-native';
import {Pressable} from 'react-native-gesture-handler';
import {useState, useCallback, useMemo, useContext} from 'react';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import {
  allScreenIdList,
  type MyPageViewsProps,
} from '../../types/viewParameter';
import Spacer from '../parts/spacer';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {
  type MessageCardStyleType,
  messageCardStyle,
} from '../../types/commonUnionType';
import {dateFormat, getYmdString} from '../functionals/timeManager';
import SmallButton from '../parts/smallButton';
import {ButtonContextProvider} from '../hooks/useButtonContext';
import type {ButtonInfoList} from '../hooks/useCheckButtonContext';
import {
  type MessageCardData,
  GlobalSaveDataContext,
} from '../hooks/useGlobalSaveDataContext';
import {TaskDataContext} from '../hooks/useTaskDataContext';
import UserIcon from './userIcon';

export type MessageCardProps = {
  // 共通props
  readonly id: string;
  readonly cardType?: MessageCardStyleType;
  /*
	linkedTaskId?: string;
	isNew: boolean;
	sender: IndividualMessageSenderType;
	senderType: MessageSenderType;
	date: Date;
	title: string;
	content: string;
	*/
};

const NewBadge = () => {
  return (
    <View
      style={tw`w-1.5 h-1.5 rounded-full bg-errorred-400 items-center justify-center pt-0.5`}
    />
  );
};

const MessageCard = (props: MessageCardProps) => {
  const _isFocused = useIsFocused();
  const navigation =
    useNavigation<MyPageViewsProps<'MyPageMessage'>['navigation']>();
  // const rootNavigation = useNavigation<RootViewsProps<'Tab'>['navigation']>();
  const {
    messageData,
    //    getCategoryData,
  } = useContext(GlobalSaveDataContext);
  const {taskSettingListArray} = useContext(TaskDataContext);

  /*
  const {initialPracticeQuestionSetting} = useContext(
    InitialSettingDataContext,
  );
  const {questionCategoryCommonButtonList} = useContext(
    QuestionSettingViewContext,
  );
  */

  const message = useMemo<MessageCardData>(() => {
    return {
      ...messageData[props.id],
      id: props.id,
      cardType: props.cardType ?? messageData[props.id].cardType,
    };
  }, [messageData, props.id, props.cardType]);

  const date = useMemo(
    () => getYmdString(message.date, dateFormat.slash),
    [message.date],
  );

  /* メッセージ概要 */
  /** カードを押したときの処理 */

  const onPressOutMessageCard = useCallback(() => {
    navigation.navigate('MyPageEachMessage', {
      userId: allScreenIdList.MyPageEachMessage,
      id: message.id,
    });
    // isNewをfalseに設定
  }, [navigation, message.id]);

  /* メッセージ詳細 */
  /** リンクされている課題データを取得 */
  const taskData = useMemo(() => {
    return taskSettingListArray.find((v) => {
      return v.id === message.linkedTaskId;
    });
  }, [taskSettingListArray, message.linkedTaskId]);

  //  const [categoryString, setCategoryString] = useState<string>('');
  // const [checkedCategoryButtonInfoList, setCheckedCategoryButtnInfoList] =
  useState<ButtonInfoList | undefined>(undefined);

  /** 問題設定に渡す文字列とボタン情報を取得 */
  /*
  const getQuestionSettingString = useCallback(() => {
    if (
      taskData !== undefined &&
      taskData.questionMode === questionMode.practice
    ) {
      const currentQuestionCategory = taskData.isQaa
        ? taskData.practiceQuestionSetting.qaaQuestionCategory
        : taskData.practiceQuestionSetting.questionCategory;
      const initialQuestionCategory = taskData.isQaa
        ? initialPracticeQuestionSetting.qaaQuestionCategory
        : initialPracticeQuestionSetting.questionCategory;
      const questionCategoryString = getCheckedCategoryString(
        currentQuestionCategory,
        questionMode.practice,
        // currentCategoryData,
        questionCategoryCommonButtonList.buttonList,
      );
      setCategoryString(questionCategoryString);
      // setCheckedCategoryButtnInfoList(questionCategoryButtonInfoList);
    }
  }, [
    initialPracticeQuestionSetting,
    taskData,
    questionCategoryCommonButtonList,
  ]);


  useEffect(() => {
    if (!isFocused) return;
    if (taskData !== undefined) {
      getQuestionSettingString();
    }
  }, [taskData]);
  */

  /** 課題ボタンを押した時の処理 */
  const OnPressOutTaskButton = useCallback(() => {
    navigation.navigate('Tab', {
      screen: 'QuestionTab',
      userId: allScreenIdList.QuestionTab,
      params: {
        userId: allScreenIdList.QuestionTab,
        screen: 'QuestionSetting',
        params: {
          id: taskData!.id,
          checkedCategoryIdList: [],
          headerTitle: taskData!.title,
          userId: allScreenIdList.QuestionSetting,
          // checkedCategoryString: categoryString,
        },
      },
    });
  }, [taskData, navigation]);

  return (
    <View style={tw`w-11/12 `}>
      {message.cardType === messageCardStyle.summary ? (
        <Pressable
          style={tw`bg-white rounded-md px-4 py-3`}
          onPress={onPressOutMessageCard}
        >
          {message.isNew ? (
            <View style={tw`absolute top-2.5 right-2.5`}>
              <NewBadge />
            </View>
          ) : null}

          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row`}>
              {/* アイコン */}
              <UserIcon user={message.sender} color="workbookblue-500" />
              <Spacer isHorizontal size={8} />
              {/* 送信者 */}
              <AppText style={tw`text-base`} numberOfLines={1}>
                {message.sender}
              </AppText>
            </View>

            <View>
              <AppText style={tw`text-xs text-secondary`} numberOfLines={1}>
                {date}
              </AppText>
            </View>
          </View>
          <Spacer isHorizontal={false} size={12} />

          <View style={tw`pl-8`}>
            {/* タイトル */}
            <AppText style={tw`w-full text-sm text-primary`} numberOfLines={1}>
              {message.title}
            </AppText>
            <Spacer isHorizontal={false} size={4} />
            {/* 内容 */}
            <AppText
              style={tw`w-full text-sm text-secondary`}
              numberOfLines={1}
            >
              {message.content}
            </AppText>
          </View>
        </Pressable>
      ) : (
        <View style={tw`bg-white rounded-md px-4 py-3`}>
          <Spacer isHorizontal={false} size={12} />
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row`}>
              {/* アイコン */}
              <UserIcon user={message.sender} color="workbookblue-500" />
              <Spacer isHorizontal size={8} />
              {/* 送信者 */}
              <AppText style={tw`text-base`} numberOfLines={1}>
                {message.sender}
              </AppText>
            </View>

            <View>
              <AppText style={tw`text-xs text-secondary`} numberOfLines={1}>
                {date}
              </AppText>
            </View>
          </View>
          <Spacer isHorizontal={false} size={12} />

          <View style={tw`px-1`}>
            {/* 内容 */}
            <AppText style={tw`w-full text-sm text-secondary text-justify`}>
              {message.content}
            </AppText>

            {message.linkedTaskId ? (
              <>
                <Spacer isHorizontal={false} size={12} />
                <View style={tw`items-end`}>
                  <ButtonContextProvider onPressOut={OnPressOutTaskButton}>
                    <SmallButton text="課題ページへ" width="104px" />
                  </ButtonContextProvider>
                </View>
              </>
            ) : null}
          </View>
          <Spacer isHorizontal={false} size={12} />
        </View>
      )}
    </View>
  );
};

export default MessageCard;
