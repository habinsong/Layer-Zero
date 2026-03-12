import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Trash2, FileText, AlertTriangle, Coins, Clock3, Filter, ChevronDown, ChevronUp, TrendingUp, Activity } from 'lucide-react';
import { clearPrintReports, deletePrintReport, getPrintReports, removePrintReport, setPrintReports, syncPrintReportsFromServer, upsertPrintReport } from '../utils/reportManager';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { subscribeServerEvents } from '../utils/centralApi';

const toMinuteText = (seconds) => `${Math.round((Number(seconds || 0)) / 60)}분`;

const buildSparklinePath = (values, width = 360, height = 72) => {
    if (!Array.isArray(values) || values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - (((value - min) / range) * height);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
};

const ReportsPage = () => {
    const { theme } = useTheme();
    const [reports, setReports] = useState([]);
    const [filter, setFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);

    const reloadReports = useCallback(async () => {
        setReports(getPrintReports());
        const synced = await syncPrintReportsFromServer();
        setReports(Array.isArray(synced) ? synced : getPrintReports());
    }, []);

    useEffect(() => {
        reloadReports();
        const onStorage = () => { reloadReports(); };
        const onReportUpdated = () => { reloadReports(); };
        window.addEventListener('storage', onStorage);
        window.addEventListener('reportUpdated', onReportUpdated);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('reportUpdated', onReportUpdated);
        };
    }, [reloadReports]);

    useEffect(() => {
        const unsubscribe = subscribeServerEvents((event) => {
            if (!event || event.type !== 'reports.updated') return;
            if (event.action === 'upsert' && event.item) {
                setReports(upsertPrintReport(event.item));
                return;
            }
            if (event.action === 'delete') {
                setReports(deletePrintReport(event.id));
                return;
            }
            if (event.action === 'clear') {
                setReports(setPrintReports([]));
                return;
            }
            reloadReports();
        });
        return () => unsubscribe();
    }, [reloadReports]);

    const filteredReports = useMemo(() => {
        if (filter === 'all') return reports;
        if (filter === 'risk') return reports.filter((r) => (r.quality?.score || 0) < 75);
        if (filter === 'errors') return reports.filter((r) => (r.alerts?.errorCount || 0) > 0);
        return reports;
    }, [filter, reports]);

    const handleDeleteOne = (id) => {
        if (!confirm('이 리포트를 삭제할까요?')) return;
        removePrintReport(id);
        reloadReports();
    };

    const handleDeleteAll = () => {
        if (!confirm('모든 리포트를 삭제할까요?')) return;
        clearPrintReports();
        reloadReports();
    };

    return (
        <div className="page-shell">
            <section className="premium-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-black gradient-primary gradient-text">출력 리포트</h1>
                            <p className="text-xs md:text-sm text-slate-500 break-words">출력 완료 시 자동 저장되는 결과 기록</p>
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <div className={cn(
                            "px-3 py-2 rounded-lg text-xs font-bold border text-center",
                            theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                        )}>
                            총 {reports.length}개
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteAll}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white inline-flex items-center justify-center gap-1.5 w-full sm:w-auto"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            전체 삭제
                        </button>
                    </div>
                </div>
            </section>

            <section className="premium-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Filter className="w-3.5 h-3.5" />
                        필터
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:flex-1">
                        {[
                            { id: 'all', label: '전체' },
                            { id: 'risk', label: '품질 주의' },
                            { id: 'errors', label: '에러 포함' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setFilter(item.id)}
                                className={cn(
                                    "px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
                                    filter === item.id
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : (theme === 'dark'
                                            ? "bg-slate-800 border-slate-700 text-slate-300"
                                            : "bg-white border-slate-200 text-slate-600")
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="premium-card min-h-[280px]">
                {filteredReports.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-500 gap-2">
                        <FileText className="w-8 h-8 opacity-60" />
                        <p className="text-sm font-bold">저장된 리포트가 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredReports.map((report) => (
                            <article
                                key={report.id}
                                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                                className={cn(
                                    "rounded-xl border p-3 md:p-4 cursor-pointer",
                                    theme === 'dark' ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-white"
                                )}
                            >
                                {(() => {
                                    const isExpanded = expandedId === report.id;
                                    const keyIssues = Array.isArray(report.keyIssues) && report.keyIssues.length > 0
                                        ? report.keyIssues
                                        : ((Array.isArray(report.quality?.reasons)
                                            ? report.quality.reasons.filter((reason) => reason && !reason.includes('준비 중'))
                                            : []));
                                    if (keyIssues.length === 0) {
                                        if ((report.alerts?.errorCount || 0) > 0) keyIssues.push(`에러 ${report.alerts.errorCount}회 발생`);
                                        if ((report.alerts?.warnCount || 0) > 0) keyIssues.push(`경고 ${report.alerts.warnCount}회 발생`);
                                    }
                                    if (keyIssues.length === 0) keyIssues.push('특이사항 없음');
                                    const qualityTimeline = Array.isArray(report.qualityTimeline) ? report.qualityTimeline : [];
                                    const qualityActive = qualityTimeline.filter((row) => row.started === true);
                                    const qualityPool = qualityActive.length > 0 ? qualityActive : qualityTimeline;
                                    const qualityLowest = qualityPool.length > 0
                                        ? Math.min(...qualityPool.map((row) => Number(row.score || 0)))
                                        : Number(report.quality?.score || 0);
                                    const qualityDropCount = qualityPool.filter((row) => Number(row.score || 0) < 90).length;
                                    const alertTimeline = Array.isArray(report.alertTimeline)
                                        ? report.alertTimeline
                                        : [];
                                    const costTimeline = Array.isArray(report.costTimeline)
                                        ? report.costTimeline
                                        : [];
                                    let costValues = costTimeline.map((row) => Number(row.total || 0)).filter((v) => Number.isFinite(v));
                                    if (costValues.length < 2) {
                                        const total = Number(report.cost?.total || 0);
                                        costValues = [0, total];
                                    }
                                    const costPath = buildSparklinePath(costValues, 340, 66);

                                    return (
                                        <>
                                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-sm md:text-base font-black text-slate-700 dark:text-slate-100 break-words">
                                            {report.filename || '(파일명 없음)'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 break-words">
                                            {new Date(report.createdAt).toLocaleString('ko-KR')}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-black",
                                            (report.quality?.score || 0) >= 90
                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                : (report.quality?.score || 0) >= 75
                                                    ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
                                                    : (report.quality?.score || 0) >= 60
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                        )}>
                                            품질 {report.quality?.score ?? 0}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedId(isExpanded ? null : report.id);
                                            }}
                                            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            title={isExpanded ? "상세 닫기" : "상세 보기"}
                                        >
                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteOne(report.id);
                                            }}
                                            className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                                            title="리포트 삭제"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2.5 py-2">
                                        <div className="text-slate-500 mb-0.5 inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> 출력 시간</div>
                                        <div className="font-bold text-slate-700 dark:text-slate-200">{Math.round((report.durationSec || 0) / 60)}분</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2.5 py-2">
                                        <div className="text-slate-500 mb-0.5 inline-flex items-center gap-1"><Coins className="w-3 h-3" /> 총 비용</div>
                                        <div className="font-bold text-slate-700 dark:text-slate-200">{(report.cost?.total || 0).toLocaleString()}원</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2.5 py-2">
                                        <div className="text-slate-500 mb-0.5">필라멘트</div>
                                        <div className="font-bold text-slate-700 dark:text-slate-200">{(report.filamentUsedM || 0).toFixed(2)}m</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-100 dark:bg-slate-800/70 px-2.5 py-2">
                                        <div className="text-slate-500 mb-0.5 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 경고/에러</div>
                                        <div className="font-bold text-slate-700 dark:text-slate-200">
                                            {report.alerts?.warnCount || 0}/{report.alerts?.errorCount || 0}
                                        </div>
                                    </div>
                                </div>

                                {keyIssues.length > 0 && (
                                    <div className="mt-2 text-[11px] text-slate-500 break-words">
                                        주요 이슈: {keyIssues.slice(0, 3).join(' / ')}
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                                        <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                                            <div className="text-xs font-black mb-2 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                <Activity className="w-3.5 h-3.5" />
                                                품질 하락 원인
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                                {(keyIssues.length > 0 ? keyIssues : ['특이사항 없음']).map((item, idx) => (
                                                    <div key={`issue-${report.id}-${idx}`}>• {item}</div>
                                                ))}
                                                <div className="pt-1 text-[11px] text-slate-500">
                                                    최저 점수 {Math.round(qualityLowest)} / 저하 구간 {qualityDropCount}회
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                                            <div className="text-xs font-black mb-2 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                경고 타임라인
                                            </div>
                                            {alertTimeline.length === 0 ? (
                                                <div className="text-xs text-slate-500">기록된 경고가 없습니다.</div>
                                            ) : (
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {alertTimeline.map((item, idx) => (
                                                        <div key={`timeline-${report.id}-${idx}`} className="text-xs flex items-start gap-2">
                                                            <span className={cn(
                                                                "mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
                                                                item.level === 'error'
                                                                    ? "bg-red-500 text-white"
                                                                    : item.level === 'warn'
                                                                        ? "bg-amber-500 text-white"
                                                                        : "bg-slate-500 text-white"
                                                            )}>
                                                                {item.level}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="text-slate-700 dark:text-slate-200 break-words">
                                                                    [{item.source}] {item.message}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    T+{toMinuteText(item.elapsedSec || 0)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                                            <div className="text-xs font-black mb-2 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                비용 추이
                                            </div>
                                            {costValues.length < 2 ? (
                                                <div className="text-xs text-slate-500">비용 샘플이 충분하지 않습니다.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <svg viewBox="0 0 340 66" className="w-full h-16">
                                                        <path d={costPath} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-500" />
                                                    </svg>
                                                    <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                                                        <div className="rounded-md bg-white dark:bg-slate-800 px-2 py-1 border border-slate-200 dark:border-slate-700 break-words">
                                                            시작 {Math.round(costValues[0] || 0).toLocaleString()}원
                                                        </div>
                                                        <div className="rounded-md bg-white dark:bg-slate-800 px-2 py-1 border border-slate-200 dark:border-slate-700 break-words">
                                                            현재 {Math.round(costValues[costValues.length - 1] || 0).toLocaleString()}원
                                                        </div>
                                                        <div className="rounded-md bg-white dark:bg-slate-800 px-2 py-1 border border-slate-200 dark:border-slate-700 break-words">
                                                            증가 {(Math.round(costValues[costValues.length - 1] || 0) - Math.round(costValues[0] || 0)).toLocaleString()}원
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                        </>
                                    );
                                })()}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default ReportsPage;
