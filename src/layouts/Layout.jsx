import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Layout = () => {
    const { theme } = useTheme();
    const wakeLockRef = useRef(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
    const location = useLocation();

    // 라우트 변경 시 모바일에서만 사이드바 닫기
    useEffect(() => {
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    }, [location.pathname]);

    // WakeLock 로직 (기존 유지)
    useEffect(() => {
        const requestWakeLock = async () => {
            const isWakelockEnabled = localStorage.getItem('wakelock-enabled') === 'true';
            if (!isWakelockEnabled) {
                if (wakeLockRef.current) {
                    try { await wakeLockRef.current.release(); wakeLockRef.current = null; } catch (err) { }
                }
                return;
            }
            try { if ('wakeLock' in navigator && !wakeLockRef.current) { wakeLockRef.current = await navigator.wakeLock.request('screen'); } } catch (err) { }
        };
        const handleVisibilityChange = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
        requestWakeLock();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
            }
        };
    }, []);

    return (
        /* 최상위 컨테이너: fixed inset-0로 사파리 뷰포트 고정 */
        <div className={`fixed inset-0 flex flex-col overflow-hidden font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#020617] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
            }`}>

            {/* 1. 전역 배경 레이어 (z-0) */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className={`absolute inset-0 transition-opacity duration-500 ${theme === 'dark' ? 'bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-pink-900/10' : 'bg-gradient-to-br from-blue-100/60 via-purple-100/60 to-pink-100/60'
                    }`} />
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: `radial-gradient(circle, ${theme === 'dark' ? '#ffffff' : '#000000'} 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }} />
            </div>

            {/* 2. 상단 헤더 (Mobile 전용) */}
            <header className={`md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 transition-all duration-300 border-b backdrop-blur-md ${isSidebarOpen ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'
                } ${theme === 'dark' ? 'bg-slate-950/50 border-slate-800/50' : 'bg-white/50 border-slate-200/50'
                }`}
                style={{
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                    height: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)'
                }}>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div className="ml-3 flex flex-col justify-center">
                    <span className="text-lg font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                        Layer Zero
                    </span>
                    <span className="text-[0.55rem] font-bold text-slate-500 tracking-[0.3em] leading-none opacity-80 mt-0.5">
                        Absolute Control for Your Workspace
                    </span>
                </div>
            </header>

            {/* 3. 메인 레이아웃 엔진 */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* 모바일 오버레이: 사이드바 열릴 때 배경 어둡게 */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                {/* 메인 콘텐츠 영역 (z-10) */}
                <main className="flex-1 min-w-0 h-full overflow-hidden relative z-10 flex flex-col">
                    {!isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className={`hidden md:flex absolute top-4 left-4 z-30 p-2 rounded-lg border shadow-sm transition-colors ${theme === 'dark'
                                ? 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                                : 'bg-white/90 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            aria-label="사이드바 열기"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    )}
                    <div className={`flex-1 flex flex-col overflow-y-auto md:overflow-y-scroll custom-scrollbar relative
                        pb-[env(safe-area-inset-bottom, 0px)]
                        px-[env(safe-area-inset-left, 0px)]
                        transition-all duration-300
                        ${!isSidebarOpen ? 'pt-[calc(3.5rem+env(safe-area-inset-top,0px))]' : 'pt-[env(safe-area-inset-top,0px)]'}
                        md:pt-0`} style={{ scrollbarGutter: "stable both-edges" }}>

                        <div className="flex-1 flex flex-col w-full h-full md:p-8">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
