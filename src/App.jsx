import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';

import { SettingsProvider } from './context/SettingsContext';
const Home = lazy(() => import('./pages/Home'));
const PrinterView = lazy(() => import('./pages/PrinterView'));
const ModelSites = lazy(() => import('./pages/ModelSites'));
const Settings = lazy(() => import('./pages/Settings'));
const Webcam = lazy(() => import('./pages/Webcam'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Tools = lazy(() => import('./pages/Tools'));
const Reports = lazy(() => import('./pages/Reports'));
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
        <Suspense fallback={RouteFallback}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route
                path="printer"
                element={<PrinterView />}
              />
              <Route path="webcam" element={<Webcam />} />
              <Route path="chatbot" element={<AiChatbot />} />
              <Route path="models" element={<ModelSites />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="tools" element={<Tools />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
