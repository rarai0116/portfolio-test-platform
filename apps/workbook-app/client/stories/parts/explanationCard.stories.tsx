import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExplanationCard from "../../components/parts/explanationCard";

type T = typeof ExplanationCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ExplanationCard",
  component: ExplanationCard,
  args: {},
};

export const basic = {
  args: {
    questionNumber: "5",
    explanationSentence: [
      "AppTextにwidthを設定すれば下3つははみ出ない",
      '例；<p>適当である。台所、洗面・脱衣室、洗濯機置場、物干し場などは使用頻度が高く、<u>家事動線を整理する</u>ことが重要である。</p>',
      "hogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehoge",
      "ほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげほげ",
      '<p>適当である。台所、洗面・脱衣室、洗濯機置場、物干し場などは使用頻度が高く、<u>家事動線を整理する</u>ことが重要である。</p>',
      "適当である。来客が私的空間を通らずに応接できると、プライバシーを確保しやすい。",
      "適当である。高齢者の居住では、寝室と便所の距離、段差、照明、手すりの設置などに配慮することが望ましい。",
      "最も不適当である。動線をすべて同一経路に集中させると、生活上の干渉や混雑が生じやすい。家族動線、家事動線、来客動線は必要に応じて分離し、生活のしやすさとプライバシーを両立させる。",
    ],
  },
};

export default meta;
