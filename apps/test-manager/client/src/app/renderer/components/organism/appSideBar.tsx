import { cn } from '@api/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from '@ui/sidebar';
import { useCreatePdfModeTransition } from '@views/createPdf/hooks/useCreatePdfModeTransition';
import { useCallback } from 'react';
import {
  NavLink,
  type NavLinkRenderProps,
  // useLocation,
  useNavigate,
} from 'react-router';

// biome-ignore lint/complexity/noBannedTypes: Props実装予定あり
export type Props = {};

const AppSidebar = () => {
  const navigate = useNavigate();
  const transitionCreatePdfMode = useCreatePdfModeTransition();
  const onClickLogout = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault(); // 先に遷移しないようにする
      try {
        const result = await window.electron.ipcRenderer.invoke('auth:signOut');
        console.log('Sign-out result:', result);
      } finally {
        console.log('Navigating to login page after logout');
        navigate('/'); // index = Login
      }
    },
    [navigate],
  );

  const navLinkStyle = useCallback(() => {
    return ({ isActive }: NavLinkRenderProps) =>
      cn(
        ` bg-primary text-accent-foreground items-start
        justify-center flex flex-col gap-1  p-3 text-xs transition-all outline-none 
        hover:bg-primary-hover hover:text-accent-foreground 
        focus:bg-primary-active focus:text-accent-foreground  w-full`,
        isActive ? 'bg-demoblue-800 pointer-events-none' : '',
      );
  }, []);

  const handleCreatePdfModeClick = useCallback(
    (targetPath: '/createPdf/exam' | '/createPdf/workbook') =>
      (e: React.MouseEvent) => {
        e.preventDefault();
        void transitionCreatePdfMode({ targetPath });
      },
    [transitionCreatePdfMode],
  );

  return (
    <Sidebar className="w-30" collapsible="none">
      <SidebarHeader className="flex items-center bg-primary">
        <div className="text-center text-lg font-bold text-white p-2">
          Test Manager
        </div>
      </SidebarHeader>
      <SidebarContent className="flex items-center bg-primary">
        <NavLink to="/testDataList" className={navLinkStyle()}>
          問題データリスト
        </NavLink>

        <NavLink
          to="/createPdf/exam"
          className={navLinkStyle()}
          onClick={handleCreatePdfModeClick('/createPdf/exam')}
        >
          模擬試験作成
        </NavLink>

        <NavLink
          to="/createPdf/workbook"
          className={navLinkStyle()}
          onClick={handleCreatePdfModeClick('/createPdf/workbook')}
        >
          問題集作成
        </NavLink>
        {import.meta.env.DEV && (
          <NavLink to="/createPdf/main" className={navLinkStyle()}>
            テスト版PDF作成（模擬試験）
          </NavLink>
        )}
        {import.meta.env.DEV && (
          <NavLink to="/createPdf/tempWorkbook" className={navLinkStyle()}>
            テスト版PDF作成（問題集）
          </NavLink>
        )}
        <SidebarGroup />
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter className="flex items-center w-full bg-primary px-0 pb-4">
        <NavLink
          to="/"
          onClick={onClickLogout}
          className={`${navLinkStyle()} items-center! w-full`}
        >
          ログアウト
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
