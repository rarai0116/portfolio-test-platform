import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ChoicesCard from "../../components/parts/choicesCard";

type T = typeof ChoicesCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ChoicesCard",
  component: ChoicesCard,
  args: {},
};

export const basic = {
  args: {
    choicesSentence: [
      "AppTextにwidthを設定すれば下3つははみ出ない",
      '例；<p>適当である。台所、洗面・脱衣室、洗濯機置場、物干し場などは使用頻度が高く、<u>家事動線を整理する</u>ことが重要である。</p>',
      "hogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehoge",
      "ほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげ",
      "家事動線は、台所、洗面・脱衣室、物干し場などの関係を考慮し、移動距離が過度に長くならないように計画する。",
      "来客動線は、家族の私的空間を通過しなくても応接できるよう、玄関、客間、便所などの関係に配慮する。",
      "高齢者が居住する住宅では、寝室から便所までの動線を短くし、夜間の移動にも配慮することが望ましい。",
      "住宅内の動線は、居室相互のつながりを強めるため、家族動線、家事動線、来客動線をできるだけ同一経路に集中させる。",
    ],
  },
};

export default meta;
