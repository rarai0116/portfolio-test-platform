import '@renderer/api/loggerBootstrap';
import { installImageErrorRecovery } from '@renderer/api/imageErrorRecovery';
import { installRendererTelemetry } from '@renderer/api/telemetryBootstrap';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@styles/main.css';
import '@styles/quill.css';
import GoogleAuthPopup from '@renderer/auth/googleAuthPopup';
import Layout from '@renderer/layout';
import CreatePdfView from '@views/createPdf';
import CreatePdfPreviewWindowView from '@views/createPdfPreview';
import Login from '@views/login';
import PreviewWindowView from '@views/preview';
import QuestionEditor from '@views/testDataEditor';
import TestDataList from '@views/testDataList';
import { HashRouter, Navigate, Route, Routes } from 'react-router';

// 開発時のみ DevExperimental を遅延読み込み
const DevExperimental = import.meta.env.DEV
  ? lazy(() => import('@views/devExperimental'))
  : null;

installRendererTelemetry();
// demo-asset 画像の表示失敗回復を各documentへ1回だけ設置する（設計10.2）
installImageErrorRecovery(document);

const rootElement = document.querySelector('#root');
if (!rootElement) throw new Error('ルート要素が見つかりません');
createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route index element={<Login />} />
        <Route path="auth" element={<GoogleAuthPopup />} />
        <Route
          path="createPdfPreviewWindow"
          element={<CreatePdfPreviewWindowView />}
        />
        <Route element={<Layout />}>
          <Route
            path="createPdf"
            element={<Navigate replace to="/createPdf/exam" />}
          />
          <Route path="createPdf/exam" element={<CreatePdfView key="exam" />} />
          <Route
            path="createPdf/workbook"
            element={<CreatePdfView key="workbook" />}
          />
          {import.meta.env.DEV && (
            <Route
              path="createPdf/main"
              element={<CreatePdfView key="main" />}
            />
          )}
          {import.meta.env.DEV && (
            <Route
              path="createPdf/tempWorkbook"
              element={<CreatePdfView key="tempWorkbook" />}
            />
          )}
          <Route path="testDataEditor" element={<QuestionEditor />} />
          <Route path="testDataList" element={<TestDataList />} />
          <Route path="previewWindow" element={<PreviewWindowView />} />
        </Route>
        {import.meta.env.DEV && DevExperimental && (
          <Route
            path="__dev" // 開発用パス（本番非公開）
            element={
              <Suspense fallback={<div />}>
                <DevExperimental />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
