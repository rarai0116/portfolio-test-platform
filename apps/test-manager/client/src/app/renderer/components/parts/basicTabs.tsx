import {
  LineTabs,
  LineTabsContent,
  LineTabsList,
  LineTabsTrigger,
} from '@ui/lineTabs';

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export type Props = {
  tabs: TabItem[];
  keepMounted?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
};

/**shadcn/uiのTabsをラップしたコンポーネント */
const BasicTabs = (props: Props) => {
  return (
    <LineTabs
      value={props.value}
      onValueChange={props.onValueChange}
      defaultValue={props.value ? undefined : props.tabs[0].id}
      className="w-full min-w-0"
    >
      <LineTabsList>
        {props.tabs.map((tab) => (
          <LineTabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </LineTabsTrigger>
        ))}
      </LineTabsList>
      {props.tabs.map((tab) => (
        <LineTabsContent
          key={tab.id}
          value={tab.id}
          className="w-full min-w-0"
          {...(props.keepMounted ? { forceMount: true } : {})}
        >
          {tab.content}
        </LineTabsContent>
      ))}
    </LineTabs>
  );
};

export default BasicTabs;
