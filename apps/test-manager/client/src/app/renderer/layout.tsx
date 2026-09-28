import AppSideBar from '@components/organism/appSideBar';
import FullScreenLoading from '@parts/fullScreenLoading';
import { SidebarProvider } from '@ui/sidebar';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

const Layout = (): React.JSX.Element => {
  const { pathname } = useLocation();
  const hideAppSideBar =
    pathname.startsWith('/testDataEditor') ||
    pathname.startsWith('/previewWindow');
  useEffect(() => {
    // ログイン後画面に入ったタイミングでクライアントアップデートチェック

    const off = window.updater?.onStatus?.((ev) => {
      console.log('updater status:', ev);
      if (ev.type === 'downloaded') {
        const ok = window.confirm(
          '更新があります。今すぐ再起動して適用しますか？',
        );
        if (ok) void window.updater.install();
      }
      if (ev.type === 'error') {
        // 必要なら console.warn 程度。UX要件が増えない範囲で。
        console.warn('updater error:', ev.message);
      }
    });

    void window.updater
      ?.check?.()
      .then((check) => console.log('update check completed', check));

    return () => off?.();
  }, []);
  return (
    <SidebarProvider className="min-h-0 h-full overflow-hidden">
      {!hideAppSideBar && <AppSideBar />}
      <div className="flex-1 min-w-0 h-full">
        <Outlet />
        <FullScreenLoading />
      </div>
    </SidebarProvider>
  );
};

export default Layout;
