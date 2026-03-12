import React, { useState, useEffect, useMemo } from 'react';
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
    const [isEmbedded, setIsEmbedded] = useState(false);
    const [frameVersion, setFrameVersion] = useState(0);

    useEffect(() => {
        setIsEmbedded(false);
        setIsLoading(false);
    }, [displayUrl]);

    useEffect(() => {
        if (!isEmbedded || !displayUrl || !isLoading) return undefined;
        const timer = setTimeout(() => setIsLoading(false), 10000);
        return () => clearTimeout(timer);
    }, [displayUrl, frameVersion, isEmbedded, isLoading]);

    const iframeUrl = useMemo(() => {
        if (!displayUrl) return '';
        if (!frameVersion) return displayUrl;
        const separator = displayUrl.includes('?') ? '&' : '?';
        return `${displayUrl}${separator}_ts=${frameVersion}`;
    }, [displayUrl, frameVersion]);

    const handleOpenEmbed = () => {
        if (!displayUrl) return;
        setIsLoading(true);
        setFrameVersion(Date.now());
        setIsEmbedded(true);
    };

    const handleRefresh = () => {
        if (!displayUrl || !isEmbedded) return;
        setIsLoading(true);
        setFrameVersion(Date.now());
    };

    return (
        /* [수정] h-full과 flex-col로 부모(Outlet)가 준 모든 높이를 사용함 */
        <div className="page-shell flex-1 h-full min-w-0 flex flex-col overflow-hidden">

            {/* 헤더: shrink-0으로 자기 높이만 딱 가짐 */}
            <header className="premium-card shrink-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3 md:gap-4">
                        <div className="p-2 md:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                            <Printer className="w-5 h-5 md:w-8 md:h-8 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-3xl font-black gradient-primary gradient-text leading-none break-words">{printerName}</h2>
                            <p className="mt-1 flex items-start gap-1.5 text-[10px] md:text-sm text-slate-400 font-mono break-all">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {displayUrl}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
                        <button
                            onClick={isEmbedded ? () => setIsEmbedded(false) : handleOpenEmbed}
                            disabled={!displayUrl}
                            className="glass-button px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs md:text-base disabled:opacity-40 disabled:cursor-not-allowed w-full"
                        >
                            <span className="hidden sm:inline">{isEmbedded ? '임베드 닫기' : '임베드 열기'}</span>
                            <span className="sm:hidden">{isEmbedded ? '닫기' : '열기'}</span>
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={!displayUrl || !isEmbedded}
                            className="glass-button px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs md:text-base disabled:opacity-40 disabled:cursor-not-allowed w-full"
                        >
                            <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">새로고침</span>
                        </button>
                        {displayUrl && (
                            <a
                                href={displayUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-xs md:text-base font-medium flex items-center justify-center gap-2 w-full"
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
                {!displayUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center">
                        <div className="space-y-3 max-w-md">
                            <p className="text-slate-200 text-base md:text-lg font-black">프린터 UI 주소가 없습니다.</p>
                            <p className="text-slate-400 text-sm">설정에서 Klipper 주소를 먼저 입력해야 웹뷰를 열 수 있습니다.</p>
                        </div>
                    </div>
                )}

                {displayUrl && !isEmbedded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center">
                        <div className="space-y-4 max-w-lg">
                            <div className="space-y-2">
                                <p className="text-slate-100 text-lg md:text-xl font-black">경량 모드로 대기 중</p>
                                <p className="text-slate-400 text-sm md:text-base">
                                    외부 프린터 UI iframe은 메모리를 크게 쓰기 때문에 필요할 때만 열도록 바꿨습니다.
                                </p>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                                <button
                                    onClick={handleOpenEmbed}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold w-full sm:w-auto"
                                >
                                    이 페이지 안에서 열기
                                </button>
                                <a
                                    href={displayUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-200 text-sm font-bold hover:bg-slate-800 w-full sm:w-auto"
                                >
                                    새 탭에서 열기
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {isEmbedded && (
                    <>
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
                            src={iframeUrl}
                            title={printerName}
                            /* [수정] absolute inset-0로 부모 컨테이너 크기에 완벽 밀착 */
                            className="absolute inset-0 w-full h-full border-0"
                            allowFullScreen
                            loading="lazy"
                            onLoad={() => setIsLoading(false)}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default PrinterView;
