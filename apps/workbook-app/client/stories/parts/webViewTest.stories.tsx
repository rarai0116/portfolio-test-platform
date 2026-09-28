import {summarizeConsoleValue} from '../../components/functionals/consoleLevels';
import { useMemo } from "react";
import { Meta, StoryObj } from "@storybook/react";
import WebViewTest from "../../components/parts/webViewTest";
// import secondGradeData from '../../web/html/lib/secondGrade-export.json';
import type { TestData } from "../../components/hooks/useGlobalSaveDataContext";
import type { WebViewTestProps } from "../../components/parts/webViewTest";
import { questionGrade } from "../../types/commonUnionType";
import adjustTestData from "../../components/functionals/adjusttestData";
import { useState, useEffect } from "react";
import testDataList from "../../public/grade2Data.json";
/**
 * とりあえずエラーが出ないようにしただけ
 * ちゃんと動かすには、adjustTestData()の引数にTestData・localAssetList・BasisDirのダミーデータが必要
 */

const data = testDataList as TestData[];
console.info("webViewTest.stories：処理情報", summarizeConsoleValue(data));
const testNos = data.reduce<string[]>((acc, cur, i) => {
  acc.push(`${i}_${cur.subject ?? cur.subject}_${cur.testNo}`);
  return acc;
}, []);

const meta = {
  title: "Parts/WebViewTest",
  component: WebViewTest,
  args: {
    currentTestNo: 1,
    targetType: "question",
  },
  argTypes: {
    currentTestNo: {
      control: { type: "number" },
    },
    targetType: {
      options: ["question", "answer"],
      control: { type: "select" },
    },
  },
} satisfies Meta<WebViewTestProps>;

export default meta;

type Story = StoryObj<WebViewTestProps>;

export const basic: Story = {
  render: (args) => <WebViewTest {...args} />,
  args: {
    currentTestNo: 1,
    targetType: "question",
  },
};
