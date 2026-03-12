import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Printer, Settings, Video, MessageSquareText, Box, Wrench, Calculator, Zap, ChevronLeft, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKlipperStatus } from '../hooks/useKlipperData';
import { useSettings } from '../context/SettingsContext';

import { useTheme } from '../contexts/ThemeContext';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { theme } = useTheme();
    const { settings } = useSettings();
    const klipperStatus = useKlipperStatus();
    const [printerName, setPrinterName] = useState(settings.printerName || '프린터 1');

    useEffect(() => {
        setPrinterName(settings.printerName || '프린터 1');
    }, [settings.printerName]);

    const navItems = [
        { icon: Home, label: '홈', path: '/', color: 'text-blue-400' },
        { icon: Printer, label: printerName, path: '/printer', color: 'text-purple-400' },
        { icon: Video, label: '웹캠', path: '/webcam', color: 'text-pink-400' },
        { icon: MessageSquareText, label: 'AI 챗봇', path: '/chatbot', color: 'text-cyan-400' },
        { icon: Box, label: '3D 도안', path: '/models', color: 'text-emerald-400' },
        { icon: Wrench, label: '유지보수', path: '/maintenance', color: 'text-red-400' },
        { icon: Calculator, label: '도구', path: '/tools', color: 'text-yellow-400' },
        { icon: FileText, label: '리포트', path: '/reports', color: 'text-indigo-400' },
        { icon: Settings, label: '설정', path: '/settings', color: 'text-orange-400' },
    ];

    return (
        <aside className={cn(
            // 기본 스타일 (모바일 기준)
            "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden border-r border-slate-200 dark:border-slate-800",
            // 모바일 토글 상태
            isOpen ? "translate-x-0" : "-translate-x-full",
            // 데스크탑 스타일 (항상 translate-x-0, 너비로 제어)
            "md:relative md:translate-x-0",
            isOpen ? "md:w-64" : "md:w-0 md:border-none"
        )}>
            {/* 배경 그라데이션 */}
            <div className={`absolute inset-0 transition-colors duration-300 ${theme === 'dark'
                ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
                : 'bg-white'
                }`} />
            <div className={`absolute inset-0 ${theme === 'dark'
                ? 'bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-pink-900/10'
                : 'bg-gradient-to-br from-blue-100/30 via-purple-100/30 to-pink-100/30'
                }`} />

            {/* 글래스 오버레이 */}
            <div className={`absolute inset-0 backdrop-blur-xl border-r shadow-2xl transition-colors duration-300 ${theme === 'dark'
                ? 'bg-slate-900/40 border-slate-700/50'
                : 'bg-white/95 border-slate-200'
                }`} />

            {/* 컨텐츠 */}
            <div className="relative z-10 flex flex-col h-full">
                {/* 로고 영역 */}
                <div className="p-4 pb-5 md:p-6 md:pb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3 group">
                        <div className="relative">
                            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center animate-glow-pulse">
                                <Box className="w-5 h-5 md:w-6 md:h-6 text-white animate-float" />
                            </div>
                            {/* 글로우 효과 */}
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 opacity-50 blur-xl group-hover:opacity-75 transition-opacity" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold gradient-primary gradient-text neon-blue leading-tight">
                                Layer Zero
                            </h1>
                            <p className="text-[11px] md:text-xs text-slate-400 flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                Powered by AI
                            </p>
                        </div>
                    </div>
                    {/* 닫기 버튼 */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 md:p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        <ChevronLeft className={cn("w-4 h-4 md:w-5 md:h-5", theme === 'dark' ? "text-slate-400" : "text-slate-600")} />
                    </button>
                </div>

                {/* 네비게이션 */}
                <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                cn(
                                    "group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden min-w-0",
                                    isActive
                                        ? "text-white shadow-lg"
                                        : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {/* 활성 상태 배경 */}
                                    {isActive && (
                                        <>
                                            {theme === 'dark' ? (
                                                /* 다크 모드 활성: 기존 그라데이션 */
                                                <>
                                                    <div className="absolute inset-0 gradient-primary opacity-90" />
                                                    <div className="absolute inset-0 neon-border" />
                                                </>
                                            ) : (
                                                /* 라이트 모드 활성: 흰색 배경 + 그림자 */
                                                <div className="absolute inset-0 bg-white shadow-md border border-slate-100" />
                                            )}
                                        </>
                                    )}

                                    {/* 호버 효과 */}
                                    {!isActive && (
                                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${theme === 'dark'
                                            ? 'bg-gradient-to-r from-slate-800/0 via-slate-800/50 to-slate-800/0'
                                            : 'bg-slate-200/50'
                                            } `} />
                                    )}

                                    {/* 아이콘 */}
                                    <item.icon
                                        className={cn(
                                            "w-5 h-5 relative z-10 transition-all duration-300",
                                            isActive ? "scale-110" : "group-hover:scale-110 group-hover:rotate-6",
                                            isActive
                                                ? (theme === 'dark' ? "text-white" : item.color.replace('text-', 'text-').replace('-400', '-600')) // 라이트모드 활성 시 아이콘 색상 진하게
                                                : item.color
                                        )}
                                    />

                                    {/* 텍스트 */}
                                    <span className={cn(
                                        "font-medium relative z-10 transition-all duration-300 truncate",
                                        isActive && "font-bold",
                                        isActive
                                            ? (theme === 'dark' ? "text-white" : "text-slate-900") // 라이트모드 활성 시 검은 글씨
                                            : (theme === 'dark' ? "text-slate-400 group-hover:text-white" : "text-slate-600 group-hover:text-slate-900") // 라이트모드 비활성 시 진한 회색
                                    )}>
                                        {item.label}
                                    </span>

                                    {/* 우측 화살표 (활성 시) */}
                                    {isActive && (
                                        <div className="ml-auto">
                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        </div>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* 하단 상태 카드 */}
                <div className="mt-auto p-3 md:p-4">
                    <div className={`p-3 md:p-4 rounded-xl space-y-2 md:space-y-3 ${theme === 'dark' ? 'glass-card-dark' : 'bg-white border border-slate-200 shadow-sm'
                        } `}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Printer Status</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${klipperStatus.isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'} `} />
                                <span className={`text-xs font-semibold ${klipperStatus.isOnline ? 'text-green-400' : 'text-red-400'} `}>
                                    {klipperStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                        </div>

                        <div className={`pt-1.5 md:pt-2 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'} `}>
                            <div className="text-xs text-slate-600 text-center">
                                Layer Zero v1.0 · 2026
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
