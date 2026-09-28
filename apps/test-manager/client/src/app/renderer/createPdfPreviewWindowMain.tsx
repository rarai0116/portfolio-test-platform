import '@renderer/api/loggerBootstrap';
import { installImageErrorRecovery } from '@renderer/api/imageErrorRecovery';
import { installRendererTelemetry } from '@renderer/api/telemetryBootstrap';
import '@styles/createPdfPreviewWindow.css';
import CreatePdfPreviewWindowView from '@views/createPdfPreview';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';

installRendererTelemetry();
// demo-asset 画像の表示失敗回復を各documentへ1回だけ設置する（設計10.2）
installImageErrorRecovery(document);

const rootElement = document.querySelector('#root');
if (!rootElement) throw new Error('ルート要素が見つかりません');

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route
          element={<CreatePdfPreviewWindowView />}
          path="createPdfPreviewWindow"
        />
        <Route path="*" element={<CreatePdfPreviewWindowView />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
