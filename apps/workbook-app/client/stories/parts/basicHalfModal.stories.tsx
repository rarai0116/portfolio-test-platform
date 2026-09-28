import { Meta, StoryObj, StoryFn } from "@storybook/react";
import { useState, useCallback, useContext, useEffect, useMemo } from "react";
import { Modal } from "react-native";
import BasicHalfModal from "../../components/parts/basicHalfModal";
import ModalManagerContextProvider, {
  ModalManagerContext,
} from "../../components/hooks/useModalManagerContext";
import type { BasicHalfModalProps } from "../../components/parts/basicHalfModal";

type T = typeof BasicHalfModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/BasicHalfModal",
  component: BasicHalfModal,
  args: {},
};

const Template: Story = (args) => {
  return (
    <ModalManagerContextProvider>
      <HalfModal {...args} />
    </ModalManagerContextProvider>
  );
};

const HalfModal = (args: BasicHalfModalProps) => {
  const { showModal, hideModal } = useContext(ModalManagerContext);
  const parameter = useMemo(() => {
    return {
      ...args,
      id: "basicHalfModal",
      title: "タイトル1",
      onPressOutPrimaryButton() {
        console.info("primaryButton2");
        showModal("secondHalfModal");
      },
    };
  }, [args, showModal]);
  const parameter2 = useMemo(() => {
    return {
      ...args,
      id: "secondHalfModal",
      title: "タイトル2",
      onPressOutPrimaryButton() {
        console.info("primaryButton3");
        hideModal();
      },
    };
  }, [args]);
  useEffect(() => {
    showModal("basicHalfModal");
  }, []);

  return (
    <>
      <BasicHalfModal {...parameter} />
      <BasicHalfModal {...parameter2} />
    </>
  );
};

export const basic = {
  render: Template,

  args: {
    text: "テキストテキストテキストテキストテキストテキストテキストテキスト",
    hasInput: true,
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

export default meta;
