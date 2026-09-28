import { Meta, StoryObj, StoryFn } from "@storybook/react";
import { useState, useCallback, useContext, useEffect, useMemo } from "react";
import { Modal } from "react-native";
import type { BasicModalWindowProps } from "../../components/parts/basicModalWindow";
import BasicModalWindow from "../../components/parts/basicModalWindow";
import ModalManagerContextProvider, {
  ModalManagerContext,
} from "../../components/hooks/useModalManagerContext";

type T = typeof BasicModalWindow;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/BasicModalWindow",
  component: BasicModalWindow,
  args: {},
};

const Template: Story = (args) => {
  return (
    <ModalManagerContextProvider>
      <ModalWindow {...args} />
    </ModalManagerContextProvider>
  );
};

const ModalWindow = (args: BasicModalWindowProps) => {
  const { showModal, hideModal } = useContext(ModalManagerContext);
  const parameter = useMemo(() => {
    return {
      ...args,
      id: "basicModalWindow",
      title: "タイトル1",
      onPressOutPrimaryButton() {
        console.info("primaryButton2");
        showModal("secondModalWindow");
      },
    };
  }, [args, showModal]);
  const parameter2 = useMemo(() => {
    return {
      ...args,
      id: "secondModalWindow",
      title: "タイトル2",
      onPressOutPrimaryButton() {
        console.info("primaryButton3");
        hideModal();
      },
    };
  }, [args]);

  useEffect(() => {
    showModal("basicModalWindow");
  }, []);

  return (
    <>
      <BasicModalWindow {...parameter} />
      <BasicModalWindow {...parameter2} />
    </>
  );
};

export const basic = {
  render: Template,

  args: {
    text: "テキストテキストテキストテキストテキストテキストテキストテキスト",
    primaryButtonText: "ボタン1",
    /* secondaryButtonText: 'ボタン2', */
    thirdlyButtonText: "ボタン3",
    onPressOutPrimaryButton() {
      console.info("primaryButton");
    },
    onPressOutThirdlyButton() {
      console.info("thirdlyButton");
    },
  },
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;
