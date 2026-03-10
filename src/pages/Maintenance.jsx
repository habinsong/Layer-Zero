import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
    Wrench,
    AlertCircle,
    Activity,
    Gauge,
    Sparkles,
    ClipboardList,
    Play,
    Copy,
    Check,
    History,
    Trash2,
    Plus,
    CalendarClock,
    CircleCheckBig,
    Eye,
    X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { useKlipperJobStats } from '../hooks/useKlipperData';
import { sendGcode } from '../utils/moonrakerApi';
import BedMeshSurfaceChart from '../components/BedMeshSurfaceChart';
import {
    addMaintenanceLog,
    clearMaintenanceLogsRemote,
    clearMeshHistoryRemote,
    getMaintenanceChecklist,
    getMaintenanceLogs,
    getMaintenanceState,
    getMeshHistory,
    putMaintenanceChecklist,
    putMaintenanceState,
    subscribeServerEvents
} from '../utils/centralApi';

const MAINTENANCE_SCHEDULE_KEY = 'maintenance-schedule';
const FILAMENT_SPOOL_KEY = 'filament-spool';
const MAINTENANCE_LOG_KEY = 'maintenance-log-v1';
const MAINTENANCE_CHECKLIST_KEY = 'maintenance-checklist-v1';
const BED_MESH_HISTORY_KEY = 'bed-mesh-history-v1';

const QUICK_COMMANDS = [
    {
        id: 'pid-nozzle',
        title: '노즐 PID 튜닝',
        description: '온도 흔들림 줄이고 첫 레이어 안정화',
        script: 'PID_CALIBRATE HEATER=extruder TARGET=220'
    },
    {
        id: 'pid-bed',
        title: '베드 PID 튜닝',
        description: '베드 온도 편차 줄여 워핑 방지',
        script: 'PID_CALIBRATE HEATER=heater_bed TARGET=60'
    },
    {
        id: 'mesh',
        title: '베드 메쉬 캘리브레이션',
        description: '자동 레벨링 맵 재생성',
        script: 'BED_MESH_CALIBRATE'
    },
    {
        id: 'save',
        title: '설정 저장',
        description: '튜닝 결과를 설정 파일에 반영',
        script: 'SAVE_CONFIG'
    }
];

const DEFAULT_CHECKLIST = [
    { id: 'clean-bed', label: '베드 표면 청소', period: '매 출력 전' },
    { id: 'check-nozzle', label: '노즐 끝 상태 확인', period: '매일' },
    { id: 'belt-check', label: '벨트 장력 확인', period: '주간' },
    { id: 'rail-lube', label: '레일/리니어 축 윤활 확인', period: '주간' },
    { id: 'connector-check', label: '히터/센서 커넥터 점검', period: '월간' }
];

const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

const nowString = () => new Date().toLocaleString('ko-KR', { hour12: false });

const clampNumber = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function getMeshCellVisual(value, absMax, isDark) {
    const normalized = absMax > 0 ? clamp(value / absMax, -1, 1) : 0;
    const strength = Math.abs(normalized);

    if (strength < 0.05) {
        return {
            backgroundColor: isDark ? 'rgba(51,65,85,0.55)' : 'rgba(226,232,240,0.9)',
            textClass: isDark ? 'text-slate-100' : 'text-slate-800'
        };
    }
    if (normalized > 0) {
        return {
            backgroundColor: isDark
                ? `rgba(239,68,68,${0.28 + (0.45 * strength)})`
                : `rgba(254,202,202,${0.50 + (0.35 * strength)})`,
            textClass: isDark ? 'text-red-100' : 'text-red-900'
        };
    }
    return {
        backgroundColor: isDark
            ? `rgba(59,130,246,${0.28 + (0.45 * strength)})`
            : `rgba(191,219,254,${0.50 + (0.35 * strength)})`,
        textClass: isDark ? 'text-blue-100' : 'text-blue-900'
    };
}

const getMeshAbsMax = (matrix) => {
    if (!Array.isArray(matrix) || matrix.length === 0) return 0.0001;
    const values = matrix
        .flat()
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (values.length === 0) return 0.0001;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return Math.max(Math.abs(min), Math.abs(max), 0.0001);
};

const MeshHeatmap = ({ itemId, matrix, isDark, className = '' }) => {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;

    const absMax = getMeshAbsMax(matrix);

    return (
        <div className={cn('space-y-1', className)}>
            <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className={cn(isDark ? 'text-blue-300' : 'text-blue-700')}>낮음(-)</span>
                <span className={cn(isDark ? 'text-slate-300' : 'text-slate-700')}>기준(0)</span>
                <span className={cn(isDark ? 'text-red-300' : 'text-red-700')}>높음(+)</span>
            </div>
            {matrix.map((row, rowIdx) => {
                const rowValues = Array.isArray(row) ? row : [];
                return (
                <div key={`${itemId}-heat-row-${rowIdx}`} className="flex items-center gap-1">
                    <div className={cn('w-4 text-[9px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {rowIdx + 1}
                    </div>
                    <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: `repeat(${rowValues.length}, minmax(0, 1fr))` }}>
                        {rowValues.map((value, colIdx) => {
                            const parsed = Number(value);
                            const safeValue = Number.isFinite(parsed) ? parsed : 0;
                            const visual = getMeshCellVisual(safeValue, absMax, isDark);
                            return (
                                <div
                                    key={`${itemId}-heat-cell-${rowIdx}-${colIdx}`}
                                    className={cn(
                                        'rounded px-1 py-0.5 text-[10px] text-center font-mono border',
                                        isDark ? 'border-slate-700' : 'border-slate-300',
                                        visual.textClass
                                    )}
                                    style={{ backgroundColor: visual.backgroundColor }}
                                    title={`${safeValue.toFixed(3)} mm`}
                                >
                                    {safeValue.toFixed(3)}
                                </div>
                            );
                        })}
                    </div>
                </div>
                );
            })}
        </div>
    );
};

const MaintenancePage = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const jobStats = useKlipperJobStats();

    const [filamentName, setFilamentName] = useState('');
    const [filamentTotalLength, setFilamentTotalLength] = useState('1000');
    const [filamentUsedLength, setFilamentUsedLength] = useState('0');
    const [filamentMode, setFilamentMode] = useState('auto');

    const [nozzleLastReset, setNozzleLastReset] = useState(0);
    const [greaseLastReset, setGreaseLastReset] = useState(0);
    const [maintenanceMode, setMaintenanceMode] = useState('auto');
    const [manualTotalHours, setManualTotalHours] = useState('0');

    const [showSaved, setShowSaved] = useState(false);
    const [copiedScript, setCopiedScript] = useState('');
    const [runningScript, setRunningScript] = useState('');
    const [checklist, setChecklist] = useState(() => DEFAULT_CHECKLIST.map((item) => ({ ...item, done: false })));
    const [logs, setLogs] = useState([]);
    const [customLog, setCustomLog] = useState('');
    const [bedMeshHistory, setBedMeshHistory] = useState([]);
    const [selectedMeshId, setSelectedMeshId] = useState(null);

    const appendLog = (action, detail) => {
        const item = { id: Date.now(), time: nowString(), action, detail, createdAt: new Date().toISOString() };
        setLogs((prev) => {
            const next = [item, ...prev].slice(0, 80);
            localStorage.setItem(MAINTENANCE_LOG_KEY, JSON.stringify(next));
            return next;
        });
        addMaintenanceLog(item).catch(() => {
            // offline/local fallback mode
        });
    };

    const loadRemoteMaintenance = useCallback(async () => {
        try {
            const [remoteState, remoteLogs, remoteChecklist, remoteMesh] = await Promise.all([
                getMaintenanceState(),
                getMaintenanceLogs(100),
                getMaintenanceChecklist(),
                getMeshHistory(20)
            ]);

            if (remoteState && typeof remoteState === 'object') {
                if (remoteState.filamentName !== undefined) setFilamentName(remoteState.filamentName || '');
                if (remoteState.filamentTotalLength !== undefined) setFilamentTotalLength(String(remoteState.filamentTotalLength ?? '1000'));
                if (remoteState.filamentUsedLength !== undefined) setFilamentUsedLength(String(remoteState.filamentUsedLength ?? '0'));
                if (remoteState.filamentMode) setFilamentMode(remoteState.filamentMode);
                if (remoteState.nozzleLastReset !== undefined) setNozzleLastReset(Number(remoteState.nozzleLastReset || 0));
                if (remoteState.greaseLastReset !== undefined) setGreaseLastReset(Number(remoteState.greaseLastReset || 0));
                if (remoteState.mode) setMaintenanceMode(remoteState.mode);
                if (remoteState.manualTotalHours !== undefined) setManualTotalHours(String(remoteState.manualTotalHours ?? 0));
            }
            if (Array.isArray(remoteLogs) && remoteLogs.length > 0) {
                setLogs(remoteLogs);
                localStorage.setItem(MAINTENANCE_LOG_KEY, JSON.stringify(remoteLogs));
            }
            if (Array.isArray(remoteChecklist) && remoteChecklist.length > 0) {
                const safeItems = DEFAULT_CHECKLIST.map((item) => {
                    const found = remoteChecklist.find((saved) => saved.id === item.id || saved.checklistKey === item.id);
                    return { ...item, done: Boolean(found?.done) };
                });
                setChecklist(safeItems);
                localStorage.setItem(MAINTENANCE_CHECKLIST_KEY, JSON.stringify(safeItems));
            }
            if (Array.isArray(remoteMesh) && remoteMesh.length > 0) {
                setBedMeshHistory(remoteMesh);
                localStorage.setItem(BED_MESH_HISTORY_KEY, JSON.stringify(remoteMesh));
            }
        } catch {
            // offline/local fallback mode
        }
    }, []);

    useEffect(() => {
        try {
            const filamentData = JSON.parse(localStorage.getItem(FILAMENT_SPOOL_KEY) || '{}');
            setFilamentName(filamentData.name || '');
            setFilamentTotalLength((filamentData.totalLength ?? 1000).toString());
            setFilamentUsedLength((filamentData.usedLength ?? 0).toString());
            setFilamentMode(filamentData.mode || 'auto');

            const maintenanceData = JSON.parse(localStorage.getItem(MAINTENANCE_SCHEDULE_KEY) || '{}');
            setNozzleLastReset(maintenanceData.nozzleLastReset || 0);
            setGreaseLastReset(maintenanceData.greaseLastReset || 0);
            setMaintenanceMode(maintenanceData.mode || 'auto');
            setManualTotalHours((maintenanceData.manualTotalHours ?? 0).toString());

            const logData = JSON.parse(localStorage.getItem(MAINTENANCE_LOG_KEY) || '[]');
            if (Array.isArray(logData)) setLogs(logData);

            const checklistData = JSON.parse(localStorage.getItem(MAINTENANCE_CHECKLIST_KEY) || '[]');
            if (Array.isArray(checklistData) && checklistData.length > 0) {
                const safeItems = DEFAULT_CHECKLIST.map((item) => {
                    const found = checklistData.find((saved) => saved.id === item.id);
                    return { ...item, done: Boolean(found?.done) };
                });
                setChecklist(safeItems);
            }

            const meshData = JSON.parse(localStorage.getItem(BED_MESH_HISTORY_KEY) || '[]');
            if (Array.isArray(meshData)) setBedMeshHistory(meshData);
        } catch {
            setChecklist(DEFAULT_CHECKLIST.map((item) => ({ ...item, done: false })));
        }

        loadRemoteMaintenance();
    }, [loadRemoteMaintenance]);

    useEffect(() => {
        const onStorage = () => {
            try {
                const meshData = JSON.parse(localStorage.getItem(BED_MESH_HISTORY_KEY) || '[]');
                setBedMeshHistory(Array.isArray(meshData) ? meshData : []);
            } catch {
                setBedMeshHistory([]);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeServerEvents((event) => {
            if (!event || !event.type) return;
            if (event.type === 'maintenance.state.updated' && event.data && typeof event.data === 'object') {
                const remoteState = event.data;
                if (remoteState.filamentName !== undefined) setFilamentName(remoteState.filamentName || '');
                if (remoteState.filamentTotalLength !== undefined) setFilamentTotalLength(String(remoteState.filamentTotalLength ?? '1000'));
                if (remoteState.filamentUsedLength !== undefined) setFilamentUsedLength(String(remoteState.filamentUsedLength ?? '0'));
                if (remoteState.filamentMode) setFilamentMode(remoteState.filamentMode);
                if (remoteState.nozzleLastReset !== undefined) setNozzleLastReset(Number(remoteState.nozzleLastReset || 0));
                if (remoteState.greaseLastReset !== undefined) setGreaseLastReset(Number(remoteState.greaseLastReset || 0));
                if (remoteState.mode) setMaintenanceMode(remoteState.mode);
                if (remoteState.manualTotalHours !== undefined) setManualTotalHours(String(remoteState.manualTotalHours ?? 0));
                return;
            }
            if (event.type === 'maintenance.logs.updated') {
                if (event.action === 'add' && event.item) {
                    setLogs((prev) => [event.item, ...prev.filter((item) => String(item.id) !== String(event.item.id))].slice(0, 80));
                    return;
                }
                if (event.action === 'clear') {
                    setLogs([]);
                    return;
                }
                getMaintenanceLogs(100).then((items) => {
                    if (Array.isArray(items)) setLogs(items);
                }).catch(() => {});
                return;
            }
            if (event.type === 'maintenance.checklist.updated') {
                if (Array.isArray(event.items)) {
                    const safeItems = DEFAULT_CHECKLIST.map((item) => {
                        const found = event.items.find((saved) => saved.id === item.id || saved.checklistKey === item.id);
                        return { ...item, done: Boolean(found?.done) };
                    });
                    setChecklist(safeItems);
                    return;
                }
                getMaintenanceChecklist().then((items) => {
                    if (!Array.isArray(items)) return;
                    const safeItems = DEFAULT_CHECKLIST.map((item) => {
                        const found = items.find((saved) => saved.id === item.id || saved.checklistKey === item.id);
                        return { ...item, done: Boolean(found?.done) };
                    });
                    setChecklist(safeItems);
                }).catch(() => {});
                return;
            }
            if (event.type === 'mesh.updated') {
                if (event.action === 'upsert' && event.item) {
                    setBedMeshHistory((prev) => [event.item, ...prev.filter((item) => String(item.id) !== String(event.item.id))].slice(0, 20));
                    return;
                }
                if (event.action === 'clear') {
                    setBedMeshHistory([]);
                    return;
                }
                getMeshHistory(20).then((items) => {
                    if (Array.isArray(items)) setBedMeshHistory(items);
                }).catch(() => {});
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSaveAll = () => {
        const filamentData = {
            name: filamentName,
            totalLength: clampNumber(filamentTotalLength, 1000),
            usedLength: clampNumber(filamentUsedLength, 0),
            mode: filamentMode
        };
        localStorage.setItem(FILAMENT_SPOOL_KEY, JSON.stringify(filamentData));

        const maintenanceData = {
            nozzleLastReset,
            greaseLastReset,
            mode: maintenanceMode,
            manualTotalHours: clampNumber(manualTotalHours, 0)
        };
        localStorage.setItem(MAINTENANCE_SCHEDULE_KEY, JSON.stringify(maintenanceData));

        localStorage.setItem(MAINTENANCE_CHECKLIST_KEY, JSON.stringify(checklist));

        window.dispatchEvent(new Event('storage'));
        setShowSaved(true);
        appendLog('설정 저장', `필라멘트:${filamentName || '미지정'} / 모드:${maintenanceMode}`);
        putMaintenanceState({
            nozzleLastReset,
            greaseLastReset,
            mode: maintenanceMode,
            manualTotalHours: clampNumber(manualTotalHours, 0),
            filamentName,
            filamentTotalLength: clampNumber(filamentTotalLength, 1000),
            filamentUsedLength: clampNumber(filamentUsedLength, 0),
            filamentMode
        }).catch(() => {
            // offline/local fallback mode
        });
        putMaintenanceChecklist(checklist).catch(() => {
            // offline/local fallback mode
        });
        setTimeout(() => setShowSaved(false), 1600);
    };

    const totalHours = maintenanceMode === 'auto'
        ? (jobStats.totalPrintTime || 0) / 3600
        : clampNumber(manualTotalHours, 0);

    const nozzleHours = Math.max(0, totalHours - nozzleLastReset);
    const greaseHours = Math.max(0, totalHours - greaseLastReset);

    const nozzleProgress = Math.min(100, (nozzleHours / 500) * 100);
    const greaseProgress = Math.min(100, (greaseHours / 200) * 100);

    const nozzleNeedsReplacement = nozzleHours >= 450;
    const greaseNeedsMaintenance = greaseHours >= 180;

    const displayedUsedLength = filamentMode === 'auto'
        ? jobStats.totalFilament || 0
        : clampNumber(filamentUsedLength, 0);

    const totalFilament = Math.max(1, clampNumber(filamentTotalLength, 1000));
    const remainingFilament = Math.max(0, totalFilament - displayedUsedLength);
    const filamentPercentage = Math.max(0, Math.min(100, (remainingFilament / totalFilament) * 100));

    const avgFilamentPerJob = jobStats.totalJobs > 0 ? (jobStats.totalFilament / jobStats.totalJobs) : 0;
    const remainingJobsEstimate = avgFilamentPerJob > 0 ? Math.floor(remainingFilament / avgFilamentPerJob) : 0;

    const healthScore = useMemo(() => {
        const nozzleScore = Math.max(0, 100 - nozzleProgress);
        const greaseScore = Math.max(0, 100 - greaseProgress);
        const filamentScore = filamentPercentage;
        return Math.round((nozzleScore * 0.4) + (greaseScore * 0.35) + (filamentScore * 0.25));
    }, [nozzleProgress, greaseProgress, filamentPercentage]);

    const selectedMesh = useMemo(() => (
        bedMeshHistory.find((item) => String(item.id) === String(selectedMeshId)) || null
    ), [bedMeshHistory, selectedMeshId]);

    useEffect(() => {
        if (selectedMeshId && !selectedMesh) {
            setSelectedMeshId(null);
        }
    }, [selectedMesh, selectedMeshId]);

    useEffect(() => {
        if (!selectedMesh) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSelectedMeshId(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedMesh]);

    const handleResetNozzle = () => {
        setNozzleLastReset(totalHours);
        appendLog('노즐 교체 주기 리셋', `기준 ${totalHours.toFixed(1)}h`);
    };

    const handleResetGrease = () => {
        setGreaseLastReset(totalHours);
        appendLog('윤활 주기 리셋', `기준 ${totalHours.toFixed(1)}h`);
    };

    const toggleChecklist = (id) => {
        setChecklist((prev) => {
            const next = prev.map((item) => item.id === id ? { ...item, done: !item.done } : item);
            localStorage.setItem(MAINTENANCE_CHECKLIST_KEY, JSON.stringify(next));
            putMaintenanceChecklist(next).catch(() => {
                // offline/local fallback mode
            });
            const selected = next.find((item) => item.id === id);
            if (selected) {
                appendLog(selected.done ? '체크리스트 완료' : '체크리스트 해제', selected.label);
            }
            return next;
        });
    };

    const resetChecklist = () => {
        const next = DEFAULT_CHECKLIST.map((item) => ({ ...item, done: false }));
        setChecklist(next);
        localStorage.setItem(MAINTENANCE_CHECKLIST_KEY, JSON.stringify(next));
        putMaintenanceChecklist(next).catch(() => {
            // offline/local fallback mode
        });
        appendLog('체크리스트 초기화', '모든 항목 미완료 처리');
    };

    const copyScript = async (script) => {
        try {
            await navigator.clipboard.writeText(script);
            setCopiedScript(script);
            setTimeout(() => setCopiedScript(''), 1200);
        } catch {
            setCopiedScript('');
        }
    };

    const runQuickCommand = async (cmd) => {
        const ok = confirm(`아래 G-code를 실행할까요?\n\n${cmd.script}`);
        if (!ok) return;

        setRunningScript(cmd.script);
        try {
            const result = await sendGcode(cmd.script);
            if (result.success) {
                appendLog('빠른 명령 실행', cmd.title);
            } else {
                appendLog('명령 실행 실패', `${cmd.title} (${result.error || 'Unknown'})`);
                alert(`실행 실패: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            appendLog('명령 실행 실패', `${cmd.title} (${error?.message || 'Unknown'})`);
            alert(`실행 실패: ${error?.message || 'Unknown error'}`);
        } finally {
            setRunningScript('');
        }
    };

    const addCustomLog = () => {
        const value = customLog.trim();
        if (!value) return;
        appendLog('사용자 메모', value);
        setCustomLog('');
    };

    const clearLogs = () => {
        const ok = confirm('유지보수 로그를 모두 삭제할까요?');
        if (!ok) return;
        setLogs([]);
        localStorage.setItem(MAINTENANCE_LOG_KEY, JSON.stringify([]));
        clearMaintenanceLogsRemote().catch(() => {
            // offline/local fallback mode
        });
    };

    const clearBedMeshHistory = () => {
        const ok = confirm('레벨링 이력을 모두 삭제할까요?');
        if (!ok) return;
        setBedMeshHistory([]);
        setSelectedMeshId(null);
        localStorage.setItem(BED_MESH_HISTORY_KEY, JSON.stringify([]));
        appendLog('레벨링 이력 삭제', '저장된 베드 메쉬 결과 비움');
        clearMeshHistoryRemote().catch(() => {
            // offline/local fallback mode
        });
    };

    const headerMutedText = isDark ? 'text-slate-400' : 'text-slate-600';
    const softText = isDark ? 'text-slate-500' : 'text-slate-500';
    const titleText = isDark ? 'text-white' : 'text-slate-900';

    return (
        <div className="w-full space-y-6 animate-fade-in px-3 md:px-4 pb-4">
            <header className={cn('premium-card', !isDark && 'shadow-sm')}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 animate-glow-pulse">
                            <Wrench className="w-6 h-6 md:w-8 md:h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black gradient-primary gradient-text">유지보수 랩</h1>
                            <p className={cn('text-sm md:text-base mt-1', headerMutedText)}>
                                점검, 튜닝, 로그 관리를 한 화면에서 처리합니다.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveAll}
                        className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl transition-all text-sm md:text-base font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        {showSaved ? '✓ 저장됨' : '설정 저장'}
                    </button>
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <div className="premium-card">
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-400"><Gauge className="w-4 h-4" /> Health Score</div>
                    <div className={cn('mt-2 text-3xl font-black', healthScore >= 70 ? 'text-emerald-400' : healthScore >= 45 ? 'text-amber-400' : 'text-red-400')}>
                        {healthScore}
                    </div>
                    <p className={cn('text-xs mt-1', softText)}>노즐/윤활/필라멘트 상태 기반 점수</p>
                </div>

                <div className="premium-card">
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-400"><AlertCircle className="w-4 h-4" /> 노즐 교체</div>
                    <div className={cn('mt-2 text-2xl font-black', nozzleNeedsReplacement ? 'text-red-400' : titleText)}>{nozzleHours.toFixed(1)}h</div>
                    <p className={cn('text-xs mt-1', softText)}>{Math.max(0, 500 - nozzleHours).toFixed(1)}h 남음</p>
                </div>

                <div className="premium-card">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-400"><Activity className="w-4 h-4" /> 윤활 주기</div>
                    <div className={cn('mt-2 text-2xl font-black', greaseNeedsMaintenance ? 'text-amber-400' : titleText)}>{greaseHours.toFixed(1)}h</div>
                    <p className={cn('text-xs mt-1', softText)}>{Math.max(0, 200 - greaseHours).toFixed(1)}h 남음</p>
                </div>

                <div className="premium-card">
                    <div className="flex items-center gap-2 text-sm font-bold text-purple-400"><Sparkles className="w-4 h-4" /> 스풀 예측</div>
                    <div className={cn('mt-2 text-2xl font-black', titleText)}>{remainingFilament.toFixed(1)}m</div>
                    <p className={cn('text-xs mt-1', softText)}>
                        평균 기준 약 {remainingJobsEstimate}회 출력 가능
                    </p>
                </div>
            </section>

            <section className="premium-card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black gradient-primary gradient-text flex items-center gap-2">
                        <History className="w-5 h-5" /> 베드 레벨링 이력
                    </h3>
                    <button
                        onClick={clearBedMeshHistory}
                        className={cn('px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
                    >
                        <Trash2 className="w-3.5 h-3.5" /> 비우기
                    </button>
                </div>

                {bedMeshHistory.length === 0 && (
                    <div className={cn('text-sm', headerMutedText)}>
                        아직 저장된 레벨링 이력이 없습니다. 홈 탭의 `BLTouch 자동 레벨링` 실행 후 저장됩니다.
                    </div>
                )}

                {bedMeshHistory.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {bedMeshHistory.slice(0, 8).map((item) => {
                            const matrix = Array.isArray(item.matrix) ? item.matrix : [];
                            const rows = Number(item.rows || matrix.length || 0);
                            const cols = Number(item.cols || matrix[0]?.length || 0);
                            const min = Number(item.min);
                            const max = Number(item.max);
                            const avg = Number(item.avg);
                            return (
                                <div key={item.id} className={cn('rounded-xl border p-3', isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className={cn('text-sm font-black', titleText)}>
                                            {rows > 0 && cols > 0 ? `${rows}x${cols} 메쉬` : '메쉬'}
                                        </div>
                                        <div className={cn('text-[11px]', softText)}>
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR', { hour12: false }) : '-'}
                                        </div>
                                    </div>
                                    {item.filename && (
                                        <div className={cn('mt-1 text-[11px]', headerMutedText)}>
                                            파일: {item.filename}
                                        </div>
                                    )}
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className={cn('rounded-lg px-2 py-1.5 border text-center', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white')}>
                                            <div className="text-[10px] text-slate-500">Min</div>
                                            <div className={cn('text-xs font-mono font-bold', titleText)}>{Number.isFinite(min) ? min.toFixed(3) : '-'}</div>
                                        </div>
                                        <div className={cn('rounded-lg px-2 py-1.5 border text-center', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white')}>
                                            <div className="text-[10px] text-slate-500">Avg</div>
                                            <div className={cn('text-xs font-mono font-bold', titleText)}>{Number.isFinite(avg) ? avg.toFixed(3) : '-'}</div>
                                        </div>
                                        <div className={cn('rounded-lg px-2 py-1.5 border text-center', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white')}>
                                            <div className="text-[10px] text-slate-500">Max</div>
                                            <div className={cn('text-xs font-mono font-bold', titleText)}>{Number.isFinite(max) ? max.toFixed(3) : '-'}</div>
                                        </div>
                                    </div>

                                    {matrix.length > 0 && (
                                        <div className={cn('mt-2 rounded-lg border p-2', isDark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-white')}>
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <div className={cn('text-xs font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
                                                    베드 높이 편차 히트맵
                                                </div>
                                                <button
                                                    onClick={() => setSelectedMeshId(item.id)}
                                                    className={cn(
                                                        'px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 border',
                                                        isDark
                                                            ? 'border-cyan-700/70 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/40'
                                                            : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                                    )}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    3D 보기
                                                </button>
                                            </div>
                                            <MeshHeatmap itemId={item.id} matrix={matrix} isDark={isDark} />
                                            <p className={cn('mt-2 text-[11px]', headerMutedText)}>
                                                3D 그래프는 선택한 이력 1개만 열어 메모리 사용량을 줄였습니다.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <div className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-black gradient-primary gradient-text">필라멘트 관리</h3>
                    </div>

                    <div className={cn('p-3 rounded-xl mb-4 flex items-center justify-between border', isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                        <span className={cn('text-sm font-bold', headerMutedText)}>데이터 소스</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilamentMode('auto')}
                                className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all border',
                                    filamentMode === 'auto'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDark
                                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                )}
                            >
                                자동 (API)
                            </button>
                            <button
                                onClick={() => setFilamentMode('manual')}
                                className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all border',
                                    filamentMode === 'manual'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDark
                                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                )}
                            >
                                수동 입력
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className={cn('block text-sm font-bold mb-2', headerMutedText)}>필라멘트 이름</label>
                            <input
                                type="text"
                                value={filamentName}
                                onChange={(e) => setFilamentName(e.target.value)}
                                placeholder="예: eSun PLA+ White"
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-xl border text-sm font-semibold outline-none',
                                    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                                )}
                            />
                        </div>

                        <div>
                            <label className={cn('block text-sm font-bold mb-2', headerMutedText)}>전체 길이 (m)</label>
                            <input
                                type="number"
                                value={filamentTotalLength}
                                onChange={(e) => setFilamentTotalLength(e.target.value)}
                                min="0"
                                step="1"
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none',
                                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                                )}
                            />
                        </div>

                        {filamentMode === 'manual' && (
                            <div>
                                <label className={cn('block text-sm font-bold mb-2', headerMutedText)}>이미 사용된 길이 (m)</label>
                                <input
                                    type="number"
                                    value={filamentUsedLength}
                                    onChange={(e) => setFilamentUsedLength(e.target.value)}
                                    min="0"
                                    step="0.1"
                                    className={cn(
                                        'w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none',
                                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                                    )}
                                />
                            </div>
                        )}

                        {filamentMode === 'auto' && (
                            <div className={cn('p-3 rounded-lg border text-sm', isDark ? 'bg-slate-900/60 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                                API 자동 사용량: <strong className={cn(isDark ? 'text-purple-300' : 'text-purple-700')}>{displayedUsedLength.toFixed(1)} m</strong>
                            </div>
                        )}

                        <div className={cn('p-4 rounded-xl border', isDark ? 'bg-slate-900/60 border-purple-500/40' : 'bg-purple-50 border-purple-200')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={cn('text-sm font-bold', headerMutedText)}>남은 필라멘트</span>
                                <span className={cn('text-xl font-black', isDark ? 'text-purple-300' : 'text-purple-700')}>
                                    {remainingFilament.toFixed(1)} m
                                </span>
                            </div>
                            <div className={cn('h-3 rounded-full overflow-hidden', isDark ? 'bg-slate-800' : 'bg-purple-100')}>
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                    style={{ width: `${filamentPercentage}%` }}
                                />
                            </div>
                            <p className={cn('text-xs mt-2 font-semibold', softText)}>{filamentPercentage.toFixed(1)}% 남음</p>
                        </div>
                    </div>
                </div>

                <div className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-500">
                            <CalendarClock className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-black gradient-primary gradient-text">유지보수 스케줄</h3>
                    </div>

                    <div className={cn('p-3 rounded-xl mb-4 flex items-center justify-between border', isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                        <span className={cn('text-sm font-bold', headerMutedText)}>시간 계산 방식</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMaintenanceMode('auto')}
                                className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all border',
                                    maintenanceMode === 'auto'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDark
                                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                )}
                            >
                                자동 (API)
                            </button>
                            <button
                                onClick={() => setMaintenanceMode('manual')}
                                className={cn(
                                    'px-3 py-1 rounded-lg text-xs font-bold transition-all border',
                                    maintenanceMode === 'manual'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : isDark
                                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                )}
                            >
                                수동 입력
                            </button>
                        </div>
                    </div>

                    {maintenanceMode === 'manual' && (
                        <div className={cn('p-3 rounded-xl mb-4 border', isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <label className={cn('block text-sm font-bold mb-2', headerMutedText)}>총 출력 시간 (시간)</label>
                            <input
                                type="number"
                                value={manualTotalHours}
                                onChange={(e) => setManualTotalHours(e.target.value)}
                                min="0"
                                step="0.1"
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none',
                                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                                )}
                            />
                        </div>
                    )}

                    {maintenanceMode === 'auto' && (
                        <div className={cn('p-3 rounded-lg mb-4 border text-sm', isDark ? 'bg-slate-900/60 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')}>
                            API 누적 시간: <strong className={cn(isDark ? 'text-blue-300' : 'text-blue-700')}>{formatTime(jobStats.totalPrintTime)}</strong>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className={cn('p-4 rounded-xl border', nozzleNeedsReplacement ? 'border-red-500/50' : isDark ? 'border-slate-700' : 'border-slate-200')}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className={cn('w-4 h-4', nozzleNeedsReplacement ? 'text-red-400' : headerMutedText)} />
                                    <span className={cn('font-bold', titleText)}>노즐 교체</span>
                                </div>
                                <span className={cn('text-sm font-black', nozzleNeedsReplacement ? 'text-red-400' : 'text-emerald-500')}>
                                    {nozzleHours.toFixed(1)} / 500h
                                </span>
                            </div>
                            <div className={cn('h-2.5 rounded-full overflow-hidden mb-2', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
                                <div className={cn('h-full rounded-full transition-all', nozzleNeedsReplacement ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-green-500')} style={{ width: `${nozzleProgress}%` }} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={cn('text-xs', softText)}>{Math.max(0, 500 - nozzleHours).toFixed(1)}시간 남음</span>
                                <button onClick={handleResetNozzle} className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white">정비 완료</button>
                            </div>
                        </div>

                        <div className={cn('p-4 rounded-xl border', greaseNeedsMaintenance ? 'border-amber-500/50' : isDark ? 'border-slate-700' : 'border-slate-200')}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className={cn('w-4 h-4', greaseNeedsMaintenance ? 'text-amber-400' : headerMutedText)} />
                                    <span className={cn('font-bold', titleText)}>윤활 점검</span>
                                </div>
                                <span className={cn('text-sm font-black', greaseNeedsMaintenance ? 'text-amber-400' : 'text-emerald-500')}>
                                    {greaseHours.toFixed(1)} / 200h
                                </span>
                            </div>
                            <div className={cn('h-2.5 rounded-full overflow-hidden mb-2', isDark ? 'bg-slate-800' : 'bg-slate-200')}>
                                <div className={cn('h-full rounded-full transition-all', greaseNeedsMaintenance ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-gradient-to-r from-emerald-500 to-green-500')} style={{ width: `${greaseProgress}%` }} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={cn('text-xs', softText)}>{Math.max(0, 200 - greaseHours).toFixed(1)}시간 남음</span>
                                <button onClick={handleResetGrease} className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white">정비 완료</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <div className="premium-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black gradient-primary gradient-text flex items-center gap-2">
                            <Sparkles className="w-5 h-5" /> 빠른 정비 명령
                        </h3>
                        <span className={cn('text-xs', softText)}>실행 전 확인 팝업 제공</span>
                    </div>

                    <div className="space-y-2.5">
                        {QUICK_COMMANDS.map((cmd) => (
                            <div key={cmd.id} className={cn('rounded-xl border p-3', isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className={cn('font-bold text-sm', titleText)}>{cmd.title}</p>
                                        <p className={cn('text-xs mt-1', headerMutedText)}>{cmd.description}</p>
                                        <p className={cn('mt-2 text-[11px] font-mono break-all', isDark ? 'text-slate-400' : 'text-slate-600')}>{cmd.script}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => copyScript(cmd.script)}
                                            className={cn('px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1', isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
                                        >
                                            {copiedScript === cmd.script ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            복사
                                        </button>
                                        <button
                                            onClick={() => runQuickCommand(cmd)}
                                            disabled={runningScript === cmd.script}
                                            className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 text-white', runningScript === cmd.script ? 'bg-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500')}
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            실행
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="premium-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black gradient-primary gradient-text flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" /> 정비 체크리스트
                        </h3>
                        <button
                            onClick={resetChecklist}
                            className={cn('px-2.5 py-1.5 rounded-lg border text-xs font-bold', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
                        >
                            초기화
                        </button>
                    </div>

                    <div className="space-y-2">
                        {checklist.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => toggleChecklist(item.id)}
                                className={cn(
                                    'w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3',
                                    item.done
                                        ? isDark
                                            ? 'bg-emerald-900/20 border-emerald-700/50'
                                            : 'bg-emerald-50 border-emerald-200'
                                        : isDark
                                            ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-800/70'
                                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                )}
                            >
                                <div>
                                    <p className={cn('text-sm font-bold', titleText)}>{item.label}</p>
                                    <p className={cn('text-xs mt-0.5', headerMutedText)}>{item.period}</p>
                                </div>
                                <CircleCheckBig className={cn('w-5 h-5 shrink-0', item.done ? 'text-emerald-500' : isDark ? 'text-slate-500' : 'text-slate-400')} />
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="premium-card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-black gradient-primary gradient-text flex items-center gap-2">
                        <History className="w-5 h-5" /> 유지보수 로그
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50')}>
                            <Plus className={cn('w-3.5 h-3.5', headerMutedText)} />
                            <input
                                value={customLog}
                                onChange={(e) => setCustomLog(e.target.value)}
                                placeholder="직접 메모 추가"
                                className={cn('bg-transparent text-xs outline-none w-40 md:w-56', isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400')}
                            />
                            <button
                                onClick={addCustomLog}
                                className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                            >
                                추가
                            </button>
                        </div>
                        <button
                            onClick={clearLogs}
                            className={cn('px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1', isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100')}
                        >
                            <Trash2 className="w-3.5 h-3.5" /> 비우기
                        </button>
                    </div>
                </div>

                <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-slate-200')}>
                    {logs.length === 0 && (
                        <div className={cn('px-4 py-8 text-center text-sm', headerMutedText)}>
                            아직 기록이 없습니다. 정비 완료/빠른 명령 실행 시 자동 기록됩니다.
                        </div>
                    )}
                    {logs.length > 0 && (
                        <div className="max-h-64 overflow-auto custom-scrollbar">
                            {logs.map((log) => (
                                <div key={log.id} className={cn('px-4 py-3 border-b last:border-b-0', isDark ? 'border-slate-700/70' : 'border-slate-200')}>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className={cn('text-sm font-bold', titleText)}>{log.action}</p>
                                        <span className={cn('text-xs shrink-0', softText)}>{log.time}</span>
                                    </div>
                                    <p className={cn('text-xs mt-1', headerMutedText)}>{log.detail}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {selectedMesh && (
                <div
                    className={cn(
                        'fixed inset-0 z-[120] backdrop-blur-[1px] flex items-center justify-center p-4',
                        isDark ? 'bg-black/70' : 'bg-slate-900/45'
                    )}
                    onClick={() => setSelectedMeshId(null)}
                >
                    <div
                        className={cn(
                            'relative w-full max-w-4xl rounded-xl overflow-hidden border',
                            isDark
                                ? 'border-slate-700 bg-slate-900'
                                : 'border-slate-300 bg-white shadow-2xl'
                        )}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={cn(
                                'absolute right-2 top-2 z-10 p-2 rounded-lg',
                                isDark
                                    ? 'bg-black/50 hover:bg-black/70 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            )}
                            onClick={() => setSelectedMeshId(null)}
                            aria-label="레벨링 결과 닫기"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <div className={cn('px-4 py-3 border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                            <div className={cn('text-lg font-black', isDark ? 'text-cyan-300' : 'text-cyan-700')}>
                                베드 레벨링 3D 뷰
                            </div>
                            <div className={cn('text-sm mt-1', isDark ? 'text-slate-300' : 'text-slate-600')}>
                                {selectedMesh.createdAt
                                    ? new Date(selectedMesh.createdAt).toLocaleString('ko-KR', { hour12: false })
                                    : '기록 시각 없음'}
                                {selectedMesh.filename ? ` · ${selectedMesh.filename}` : ''}
                            </div>
                        </div>
                        <div className="p-4 max-h-[80vh] overflow-auto">
                            <div className="space-y-4">
                                <BedMeshSurfaceChart
                                    matrix={Array.isArray(selectedMesh.matrix) ? selectedMesh.matrix : []}
                                    isDark={isDark}
                                    title="평탄도 3D 그래프"
                                />
                                <div className={cn(
                                    'rounded-xl border p-3',
                                    isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
                                )}>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className={cn('text-xs font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>
                                            베드 높이 편차 히트맵 (단위: mm)
                                        </div>
                                        <div className={cn('text-[11px] font-mono', isDark ? 'text-slate-400' : 'text-slate-600')}>
                                            {Number(selectedMesh.rows || selectedMesh.matrix?.length || 0)}x{Number(selectedMesh.cols || selectedMesh.matrix?.[0]?.length || 0)}
                                        </div>
                                    </div>
                                    <MeshHeatmap
                                        itemId={`${selectedMesh.id}-modal`}
                                        matrix={Array.isArray(selectedMesh.matrix) ? selectedMesh.matrix : []}
                                        isDark={isDark}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenancePage;
