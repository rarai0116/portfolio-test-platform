// 開発専用ガード（本番で読み込まれたら即例外）
if (!import.meta.env.DEV) {
  throw new Error('DevExperimental は開発専用のページです（本番では使用不可）');
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import UiTester from '@views/devExperimental/uiTester';
import type React from 'react';
import { lazy, Suspense, useMemo, useState } from 'react';

// テスターは遅延読み込み（将来の追加にも対応しやすい）
const FirestoreApiTester = lazy(() => import('./firestoreApiTester'));
const StorageApiTester = lazy(() => import('./storageApiTester'));
const PdfCreationMock = lazy(() => import('./pdfCreationMockScreen'));
const PdfMockTest = lazy(() => import('./pdfMock_test'));

// ここにテスト画面を登録していくとタブに反映される
const TEST_SCREENS = [
  {
    id: 'firestore',
    label: 'Firestore API',
    render: () => <FirestoreApiTester />,
  },
  {
    id: 'storage',
    label: 'Storage API',
    render: () => <StorageApiTester />,
  },
  {
    id: 'react-select',
    label: 'React Select',
    render: () => <UiTester />,
  },
  {
    id: 'pdf-creation-mock',
    label: 'PDF作成モック_1',
    render: () => <PdfCreationMock />,
  },
  {
    id: 'pdf-mock',
    label: 'PDF作成モック_2',
    render: () => <PdfMockTest />,
  },
] as const;

const STORAGE_KEY = '__devTester.activeTab';

const DevExperimental: React.FC = () => {
  const defaultTab = TEST_SCREENS[0].id;
  const [active, setActive] = useState<string>(() => {
    const saved =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return saved && TEST_SCREENS.some((t) => t.id === saved)
      ? saved
      : defaultTab;
  });

  const tabs = useMemo(() => TEST_SCREENS, []);

  const handleChange = (v: string) => {
    setActive(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">DevExperimental</h1>

      <Tabs value={active} onValueChange={handleChange} className="w-full">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            <Suspense
              fallback={
                <div className="text-sm text-muted-foreground">読み込み中…</div>
              }
            >
              {t.render()}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default DevExperimental;
