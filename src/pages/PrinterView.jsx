import React, { useState, useEffect } from 'react';
import { Printer, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const PrinterView = () => {
    const { settings } = useSettings();

    const getFullUrl = (ip) => {
        if (!ip) return '';
        const raw = ip.startsWith('http') ? ip : `http://${ip}`;
        try {
            const url = new URL(raw);
            // 설정값이 Moonraker(7125)여도 프린터 웹뷰는 UI 포트(8888)로 표시
            if (url.port === '7125') {
                url.port = '8888';
            }
            return url.toString();
        } catch {
            return raw;
        }
    };

    const displayUrl = getFullUrl(settings.klipperIp);
    const printerName = settings.printerName;

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
    }, [displayUrl]);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1500);
        return () => clearTimeout(timer);
    }, [displayUrl]);

    const handleRefresh = () => {
        setIsLoading(true);
        const frame = document.getElementById('printer-frame');
        if (frame) {
            frame.src = frame.src;
        }
        setTimeout(() => setIsLoading(false), 1500);
    };

    return (
        /* [수정] h-full과 flex-col로 부모(Outlet)가 준 모든 높이를 사용함 */
        <div className="flex-1 h-full w-full flex flex-col animate-fade-in p-2 md:p-0 gap-4 overflow-hidden">

            {/* 헤더: shrink-0으로 자기 높이만 딱 가짐 */}
            <header className="premium-card shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                            <Printer className="w-5 h-5 md:w-8 md:h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-3xl font-black gradient-primary gradient-text leading-none">{printerName}</h2>
                            <p className="text-[10px] md:text-sm text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {displayUrl}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            className="glass-button p-2 md:px-4 md:py-2.5 rounded-xl flex items-center gap-2 text-xs md:text-base"
                        >
                            <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">새로고침</span>
                        </button>
                        {displayUrl && (
                            <a
                                href={displayUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 md:px-4 md:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-xs md:text-base font-medium flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden sm:inline">새 탭</span>
                            </a>
                        )}
                    </div>
                </div>
            </header>

            {/* [수정] iframe 컨테이너: flex-1과 h-full로 남은 세로 공간을 전부 먹어버림 */}
            <div className="flex-1 h-full min-h-0 w-full glass-card-dark rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/30 relative">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
                        <div className="text-center space-y-3">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                            <p className="text-slate-400 text-sm font-medium animate-pulse">Klipper 연결 중...</p>
                        </div>
                    </div>
                )}

                <iframe
                    id="printer-frame"
                    src={displayUrl}
                    title={printerName}
                    /* [수정] absolute inset-0로 부모 컨테이너 크기에 완벽 밀착 */
                    className="absolute inset-0 w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default PrinterView;
