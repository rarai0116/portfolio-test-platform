import { Meta, StoryObj, StoryFn } from "@storybook/react";
import { useState, useCallback, useContext, useMemo } from "react";
import HalfModal, {
  HalfModalProps,
} from "../../components/identities/halfModal";
import AppText from "../../components/identities/appText";
import BasisButton from "../../components/identities/button";
import PrimaryLongButton from "../../components/parts/primaryLongButton";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";
import ModalManagerContextProvider, {
  ModalManagerContext,
} from "../../components/hooks/useModalManagerContext";

/** これらの型宣言は消す */
type T = typeof HalfModal;
type Story = StoryFn<T>;

const meta: Meta<T> = { //Meta宣言は消す
  title: "Identities/HalfModal",
  component: HalfModal,
  args: {},
} satisfies Meta<typeof HalfModal>;// 追加


const Template: Story = (args) => {
  return (
    <HalfModal
      modalHeaderRightButton={args.modalHeaderRightButton}
      id="halfmodal_test"
      hasHeader={false}
      isBackDropPressFreeze={args.isBackDropPressFreeze}
    >
      {args.children}
    </HalfModal>
  );
};

export const basic = {
  render: Template,

  args: {
    id: "modal",
    isBackDropPressFreeze: false,
    children: <AppText>テスト</AppText>,
    modalHeaderRightButton: "決定",
  },
};

export default meta;
