import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import PrinterView from './pages/PrinterView';
import ModelSites from './pages/ModelSites';
import Settings from './pages/Settings';
import Webcam from './pages/Webcam';
import Maintenance from './pages/Maintenance';
import Tools from './pages/Tools';
import Reports from './pages/Reports';

import { SettingsProvider } from './context/SettingsContext';
const AiChatbot = lazy(() => import('./pages/AiChatbot'));

function App() {
  const RouteFallback = (
    <div className="w-full h-full min-h-[40vh] flex items-center justify-center text-slate-500">
      로딩 중...
    </div>
  );

  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route
              path="printer"
              element={<PrinterView />}
            />
            <Route path="webcam" element={<Webcam />} />
            <Route
              path="chatbot"
              element={(
                <Suspense fallback={RouteFallback}>
                  <AiChatbot />
                </Suspense>
              )}
            />
            <Route path="models" element={<ModelSites />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="tools" element={<Tools />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
