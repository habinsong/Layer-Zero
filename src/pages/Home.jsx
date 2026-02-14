import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Clock, Lightbulb, Activity, Thermometer, Droplets, Zap, TrendingUp, Cpu, Layers, Gauge, Wind, Flame, FileCode, Fan, ArrowUpFromLine, Cloud, AlertTriangle, Play, Pause, CheckCircle2, LayoutDashboard, Timer, Ruler, Radio, Image as ImageIcon, Receipt, Coins, TerminalSquare, Send, Check, X, Home as HomeIcon } from 'lucide-react';
import { useKlipperDashboardData } from '../hooks/useKlipperData';
import { sendGcode, emergencyStop, pausePrint, resumePrint, setZOffset, getGcodeMacroList, resetPrintState } from '../utils/moonrakerApi';
import { useWeather } from '../hooks/useWeather';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';
import TemperatureChart from '../components/TemperatureChart';
import FileManager from '../components/FileManager';
import CollapsibleSection from '../components/CollapsibleSection';
import { sendPrintCompleteNotification } from '../utils/notificationManager';
import { savePrintReport } from '../utils/reportManager';

const HomePage = () => {
    const CONSOLE_HISTORY_KEY = 'home-console-history-v1';
    const { theme } = useTheme();
    const { settings } = useSettings();
    const [time, setTime] = useState(new Date());
    const dashboard = useKlipperDashboardData({
        enabled: true,
        pollIntervalMs: Math.max(1000, Number(settings.dashboardPollMs) || 5000),
        statsIntervalMs: Math.max(10000, Number(settings.dashboardStatsPollMs) || 60000),
        costConfig: {
            filamentCostPerKg: Number(settings.filamentCostPerKg) || 18000,
            electricityCostPerKwh: Number(settings.electricityCostPerKwh) || 200
        }
    });
    const printProgress = dashboard.printProgress;
    const printerStatus = dashboard.status;
    const realtime = dashboard.realtime || { connected: false, mode: 'polling' };
    const quality = dashboard.quality || { score: 0, level: 'warmingup', reasons: ['준비 중'], started: false };
    const extraStatus = dashboard.extraStatus;
    const alerts = dashboard.alerts || [];
    const weather = useWeather();

    const [isEmergencyConfirm, setIsEmergencyConfirm] = useState(false);
    const [controlLoading, setControlLoading] = useState(false);
    const [consoleCommand, setConsoleCommand] = useState('');
    const [consoleStatus, setConsoleStatus] = useState({ type: '', text: '' });
    const [consoleHistory, setConsoleHistory] = useState(() => {
        try {
            const raw = localStorage.getItem(CONSOLE_HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });
    const [macros, setMacros] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [thumbnailView, setThumbnailView] = useState({ src: '', status: 'idle', idx: 0, key: '' });
    const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);
    const hasSeenActivePrintRef = useRef(false);
    const completionNotifiedRef = useRef(false);
    const activePrintStartedAtRef = useRef(null);
    const prevProgressRef = useRef(0);
    const prevPrinterStateRef = useRef('offline');
    const qualityTimelineRef = useRef([]);
    const costTimelineRef = useRef([]);
    const alertTimelineRef = useRef([]);
    const alertSeenRef = useRef(new Set());
    const lastSampleAtRef = useRef(0);
    const lastQualitySampleRef = useRef(null);
    const lastCostSampleRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [, setFilamentData] = useState({ totalLength: 1000, usedLength: 0, name: '' });

    useEffect(() => {
        async function fetchMacros() {
            const result = await getGcodeMacroList();
            if (result.success) {
                const favorites = ['PRINT_START', 'PRINT_END', 'CANCEL_PRINT', 'PAUSE', 'RESUME', 'BED_MESH_CALIBRATE'];
                const sorted = result.result.sort((a, b) => {
                    const aFav = favorites.includes(a);
                    const bFav = favorites.includes(b);
                    if (aFav && !bFav) return -1;
                    if (!aFav && bFav) return 1;
                    return a.localeCompare(b);
                });
                setMacros(sorted);
            }
        }
        fetchMacros();
    }, []);

    useEffect(() => {
        const data = JSON.parse(localStorage.getItem('filament-spool') || '{}');
        setFilamentData({
            totalLength: data.totalLength || 1000,
            usedLength: data.usedLength || 0,
            name: data.name || ''
        });
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const chain = String(printProgress.thumbnail || '').split('||').filter(Boolean);
        if (chain.length === 0) {
            setThumbnailView({ src: '', status: 'idle', idx: 0, key: '' });
            return;
        }
        const key = chain.join('|');
        setThumbnailView({
            src: chain[0],
            status: 'loading',
            idx: 0,
            key
        });
    }, [printProgress.thumbnail]);

    useEffect(() => {
        if (!isThumbnailModalOpen) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setIsThumbnailModalOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isThumbnailModalOpen]);

    const buildKeyIssues = useCallback((qualitySamples, alertSamples, qualityReasons) => {
        const issues = [];
        const safeReasons = (Array.isArray(qualityReasons) ? qualityReasons : [])
            .filter((reason) => reason && !reason.includes('준비 중'));
        safeReasons.forEach((reason) => issues.push(reason));

        const validQuality = qualitySamples.filter((s) => s.started === true);
        const qualityPool = validQuality.length > 0 ? validQuality : qualitySamples;
        if (qualityPool.length > 0) {
            const lowest = qualityPool.reduce((acc, cur) => (Number(cur.score || 0) < acc ? Number(cur.score || 0) : acc), 100);
            const noisyCount = qualityPool.filter((s) => Number(s.score || 0) < 90).length;
            if (noisyCount > 0) {
                issues.push(`품질 변동 샘플 ${noisyCount}회 (최저 ${Math.round(lowest)}점)`);
            }
        }

        const errorCount = alertSamples.filter((a) => a.level === 'error').length;
        const warnCount = alertSamples.filter((a) => a.level === 'warn').length;
        if (errorCount > 0) issues.push(`에러 ${errorCount}회 발생`);
        if (warnCount > 0) issues.push(`경고 ${warnCount}회 발생`);

        const deduped = [];
        const seen = new Set();
        issues.forEach((item) => {
            const normalized = String(item).trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            deduped.push(normalized);
        });
        return deduped.length > 0 ? deduped.slice(0, 6) : ['특이사항 없음'];
    }, []);

    useEffect(() => {
        const isPrinting = printerStatus.state === 'printing' || (printProgress.progress > 0 && printProgress.progress < 100);
        if (isPrinting) {
            hasSeenActivePrintRef.current = true;
            completionNotifiedRef.current = false;
            if (!activePrintStartedAtRef.current) {
                activePrintStartedAtRef.current = Date.now();
                qualityTimelineRef.current = [];
                costTimelineRef.current = [];
                alertTimelineRef.current = [];
                alertSeenRef.current = new Set();
                lastSampleAtRef.current = 0;
                lastQualitySampleRef.current = null;
                lastCostSampleRef.current = null;
            }

            const now = Date.now();
            const startedAt = activePrintStartedAtRef.current || now;
            const elapsedSec = Math.max(0, Math.round((now - startedAt) / 1000));
            const qualityScore = Number(quality.score || 0);
            const totalCost = Number(printProgress.cost?.total || 0);

            const shouldSample = (
                now - lastSampleAtRef.current >= 5000 ||
                lastQualitySampleRef.current === null ||
                Math.abs(qualityScore - Number(lastQualitySampleRef.current || 0)) >= 2 ||
                lastCostSampleRef.current === null ||
                Math.abs(totalCost - Number(lastCostSampleRef.current || 0)) >= 10
            );

            if (shouldSample) {
                qualityTimelineRef.current.push({
                    ts: new Date(now).toISOString(),
                    elapsedSec,
                    score: qualityScore,
                    level: quality.level || 'warmingup',
                    started: Boolean(quality.started)
                });
                costTimelineRef.current.push({
                    ts: new Date(now).toISOString(),
                    elapsedSec,
                    filament: Number(printProgress.cost?.filament || 0),
                    electricity: Number(printProgress.cost?.electricity || 0),
                    total: totalCost
                });
                if (qualityTimelineRef.current.length > 600) qualityTimelineRef.current.shift();
                if (costTimelineRef.current.length > 600) costTimelineRef.current.shift();
                lastSampleAtRef.current = now;
                lastQualitySampleRef.current = qualityScore;
                lastCostSampleRef.current = totalCost;
            }

            alerts.forEach((alert) => {
                if (!alert) return;
                const dedupeKey = `${alert.level}:${alert.source}:${alert.message}`;
                if (alertSeenRef.current.has(dedupeKey)) return;
                alertSeenRef.current.add(dedupeKey);
                alertTimelineRef.current.push({
                    ts: new Date(now).toISOString(),
                    elapsedSec,
                    level: alert.level || 'info',
                    source: alert.source || 'unknown',
                    message: alert.message || ''
                });
            });
            if (alertTimelineRef.current.length > 300) {
                alertTimelineRef.current = alertTimelineRef.current.slice(-300);
            }

            prevProgressRef.current = Number(printProgress.progress || 0);
            prevPrinterStateRef.current = printerStatus.state;
            return;
        }

        const isCompleted = printerStatus.state === 'complete' || printProgress.progress >= 100;
        const likelyCompletedByTransition = (
            hasSeenActivePrintRef.current &&
            prevProgressRef.current >= 95 &&
            printerStatus.state !== 'error'
        );
        if (!isCompleted && !likelyCompletedByTransition) {
            if (printerStatus.state === 'standby' || printerStatus.state === 'idle' || printerStatus.state === 'error') {
                activePrintStartedAtRef.current = null;
            }
            prevProgressRef.current = Number(printProgress.progress || 0);
            prevPrinterStateRef.current = printerStatus.state;
            return;
        }
        if (!hasSeenActivePrintRef.current || completionNotifiedRef.current) return;

        completionNotifiedRef.current = true;
        hasSeenActivePrintRef.current = false;

        const formatDuration = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return `${h}시 ${m}분 ${s}초`;
        };

        const duration = formatDuration(printProgress.printDuration);
        if (settings.notifyPrintComplete !== false) {
            sendPrintCompleteNotification(printProgress.filename, duration);
        }

        const endedAt = Date.now();
        const startedAt = activePrintStartedAtRef.current || (endedAt - (printProgress.printDuration * 1000));
        const elapsedSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));
        const qualityTimeline = Array.isArray(qualityTimelineRef.current) ? qualityTimelineRef.current.slice(-600) : [];
        const costTimeline = Array.isArray(costTimelineRef.current) ? costTimelineRef.current.slice(-600) : [];
        const alertTimeline = Array.isArray(alertTimelineRef.current) ? alertTimelineRef.current.slice(-300) : [];
        const needFinalQualitySample = qualityTimeline.length === 0 || Math.abs(Date.parse(qualityTimeline[qualityTimeline.length - 1]?.ts || 0) - endedAt) > 2500;
        if (needFinalQualitySample) {
            qualityTimeline.push({
                ts: new Date(endedAt).toISOString(),
                elapsedSec,
                score: Number(quality.score || 0),
                level: quality.level || 'warmingup',
                started: Boolean(quality.started)
            });
        }
        const needFinalCostSample = costTimeline.length === 0 || Math.abs(Date.parse(costTimeline[costTimeline.length - 1]?.ts || 0) - endedAt) > 2500;
        if (needFinalCostSample) {
            costTimeline.push({
                ts: new Date(endedAt).toISOString(),
                elapsedSec,
                filament: Number(printProgress.cost?.filament || 0),
                electricity: Number(printProgress.cost?.electricity || 0),
                total: Number(printProgress.cost?.total || 0)
            });
        }
        if (costTimeline.length < 2) {
            const finalTotal = Number(printProgress.cost?.total || 0);
            costTimeline.unshift({
                ts: new Date(startedAt).toISOString(),
                elapsedSec: 0,
                filament: 0,
                electricity: 0,
                total: 0
            });
            if (costTimeline[costTimeline.length - 1]?.total !== finalTotal) {
                costTimeline.push({
                    ts: new Date(endedAt).toISOString(),
                    elapsedSec,
                    filament: Number(printProgress.cost?.filament || 0),
                    electricity: Number(printProgress.cost?.electricity || 0),
                    total: finalTotal
                });
            }
        }
        const qualityPool = qualityTimeline.filter((item) => item.started === true);
        const qualityForScore = qualityPool.length > 0 ? qualityPool : qualityTimeline;
        const representativeScore = qualityForScore.length > 0
            ? Math.round(qualityForScore.reduce((sum, item) => sum + Number(item.score || 0), 0) / qualityForScore.length)
            : Number(quality.score || 0);
        const representativeLevel = representativeScore >= 90
            ? 'excellent'
            : representativeScore >= 75
                ? 'stable'
                : representativeScore >= 60
                    ? 'caution'
                    : 'risk';
        const keyIssues = buildKeyIssues(qualityTimeline, alertTimeline, quality.reasons);
        const report = {
            id: `report-${endedAt}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date(endedAt).toISOString(),
            startedAt: new Date(startedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            filename: printProgress.filename || '(unknown)',
            state: printerStatus.state || 'complete',
            durationSec: Math.round(printProgress.printDuration || 0),
            progress: Math.round(printProgress.progress || 100),
            quality: {
                score: representativeScore,
                level: representativeLevel,
                reasons: keyIssues.slice(0, 3)
            },
            keyIssues,
            cost: {
                filament: printProgress.cost?.filament || 0,
                electricity: printProgress.cost?.electricity || 0,
                total: printProgress.cost?.total || 0
            },
            qualityTimeline,
            costTimeline,
            alertTimeline,
            filamentUsedM: Number(extraStatus.filamentUsed || 0),
            speed: {
                current: Number(printProgress.speed || 0),
                flowRate: Number(printProgress.flowRate || 0)
            },
            temperatures: {
                extruderCurrent: Number(extraStatus.extruderTemp || 0),
                extruderTarget: Number(extraStatus.extruderTarget || 0),
                bedCurrent: Number(extraStatus.bedTemp || 0),
                bedTarget: Number(extraStatus.bedTarget || 0)
            },
            alerts: {
                errorCount: alerts.filter((a) => a.level === 'error').length,
                warnCount: alerts.filter((a) => a.level === 'warn').length,
                infoCount: alerts.filter((a) => a.level === 'info').length,
                messages: alerts.map((a) => `[${a.source}] ${a.message}`).slice(0, 6)
            }
        };
        const saveResult = savePrintReport(report);
        if (saveResult.saved) {
            window.dispatchEvent(new Event('reportUpdated'));
        }

        const usedFilament = extraStatus.filamentUsed;
        if (usedFilament > 0) {
            setFilamentData(prev => {
                const updated = { ...prev, usedLength: prev.usedLength + usedFilament };
                localStorage.setItem('filament-spool', JSON.stringify(updated));
                return updated;
            });
        }
        activePrintStartedAtRef.current = null;
        qualityTimelineRef.current = [];
        costTimelineRef.current = [];
        alertTimelineRef.current = [];
        alertSeenRef.current = new Set();
        lastSampleAtRef.current = 0;
        lastQualitySampleRef.current = null;
        lastCostSampleRef.current = null;
        prevProgressRef.current = Number(printProgress.progress || 0);
        prevPrinterStateRef.current = printerStatus.state;
    }, [
        printerStatus.state,
        printProgress.progress,
        printProgress.filename,
        printProgress.printDuration,
        printProgress.cost?.filament,
        printProgress.cost?.electricity,
        printProgress.cost?.total,
        printProgress.speed,
        printProgress.flowRate,
        extraStatus.filamentUsed,
        extraStatus.extruderTemp,
        extraStatus.extruderTarget,
        extraStatus.bedTemp,
        extraStatus.bedTarget,
        settings.notifyPrintComplete,
        buildKeyIssues,
        quality.score,
        quality.level,
        quality.started,
        quality.reasons,
        alerts
    ]);

    const handleEmergencyStop = useCallback(async () => {
        if (!isEmergencyConfirm) {
            setIsEmergencyConfirm(true);
            setTimeout(() => setIsEmergencyConfirm(false), 3000);
            return;
        }
        setControlLoading(true);
        try {
            await emergencyStop();
            alert('⚠️ 비상정지 실행됨');
        } catch (error) {
            alert('비상정지 실패: ' + error.message);
        } finally {
            setControlLoading(false);
        }
    }, [printerStatus.state, isEmergencyConfirm]);

    const handlePauseResume = useCallback(async () => {
        if (printerStatus.state === 'complete' || (printProgress.progress >= 1 && printerStatus.state !== 'printing')) {
            if (!confirm('출력 상태를 초기화하시겠습니까?')) return;
            setControlLoading(true);
            try {
                await resetPrintState();
            } catch (error) {
                alert('초기화 실패: ' + error.message);
            } finally {
                setControlLoading(false);
            }
            return;
        }
        if (printerStatus.state !== 'printing' && printerStatus.state !== 'paused') return;
        setControlLoading(true);
        try {
            if (printerStatus.state === 'paused') {
                await resumePrint();
            } else {
                await pausePrint();
            }
        } catch (error) {
            alert('동작 실패: ' + error.message);
        } finally {
            setControlLoading(false);
        }
    }, [printerStatus.state, printProgress.progress]);

    const handlePreheatPLA = useCallback(async () => {
        setControlLoading(true);
        try {
            await sendGcode('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=215');
            await sendGcode('SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=55');
            alert('🔥 PLA 예열 시작 (노즐: 215°C, 베드: 55°C)');
        } catch (error) {
            alert('예열 실패: ' + error.message);
        } finally {
            setControlLoading(false);
        }
    }, []);

    const handleZOffset = useCallback(async (offset) => {
        setControlLoading(true);
        try {
            await setZOffset(offset);
        } catch (error) {
            alert('Z-Offset 조절 실패: ' + error.message);
        } finally {
            setControlLoading(false);
        }
    }, []);

    const handleMacro = useCallback(async (macroName) => {
        if (!confirm(`'${macroName}' 매크로를 실행하시겠습니까?`)) return;
        setControlLoading(true);
        try {
            await sendGcode(macroName);
        } catch (error) {
            alert('매크로 실행 실패: ' + error.message);
        } finally {
            setControlLoading(false);
        }
    }, []);

    const appendConsoleHistory = useCallback((entry) => {
        setConsoleHistory((prev) => {
            const next = [entry, ...prev].slice(0, 12);
            localStorage.setItem(CONSOLE_HISTORY_KEY, JSON.stringify(next));
            return next;
        });
    }, [CONSOLE_HISTORY_KEY]);

    const handleSendConsoleCommand = useCallback(async (script) => {
        const command = (script ?? consoleCommand).trim();
        if (!command) return;

        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        setControlLoading(true);
        setConsoleStatus({ type: '', text: '' });
        try {
            const result = await sendGcode(command);
            if (!result.success) throw new Error(result.error || 'Unknown error');
            setConsoleStatus({ type: 'success', text: '명령 전송 완료' });
            setConsoleCommand('');
            appendConsoleHistory({ id: `${Date.now()}-${Math.random()}`, command, timestamp, success: true });
        } catch (error) {
            setConsoleStatus({ type: 'error', text: `전송 실패: ${error.message}` });
            appendConsoleHistory({ id: `${Date.now()}-${Math.random()}`, command, timestamp, success: false });
        } finally {
            setControlLoading(false);
        }
    }, [appendConsoleHistory, consoleCommand]);

    const handleQuickActionCommand = useCallback(async (action) => {
        if (!action?.script) return;
        if (action.confirm && !confirm(`'${action.label || action.script}' 명령을 실행할까요?`)) return;
        setControlLoading(true);
        try {
            const result = await sendGcode(action.script);
            if (!result.success) throw new Error(result.error || 'Unknown error');
            setConsoleStatus({ type: 'success', text: `${action.label || action.script} 실행 완료` });
            appendConsoleHistory({
                id: `${Date.now()}-${Math.random()}`,
                command: action.script,
                timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
                success: true
            });
        } catch (error) {
            setConsoleStatus({ type: 'error', text: `명령 실패: ${error.message}` });
        } finally {
            setControlLoading(false);
        }
    }, [appendConsoleHistory]);

    const formatTime = useCallback((seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}시 ${m}분 ${s}초`;
    }, []);

    const formatTimeShort = useCallback((seconds) => {
        if (seconds <= 0 || !isFinite(seconds)) return '계산 중';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}시간 ${m}분`;
        return `${m}분`;
    }, []);

    const calculateETA = useCallback((secondsLeft) => {
        if (!secondsLeft || secondsLeft <= 0) return '-';
        const now = new Date();
        const eta = new Date(now.getTime() + secondsLeft * 1000);
        return eta.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }, []);

    const qualityMeta = useMemo(() => {
        if (quality.level === 'warmingup') return { text: '준비 중', color: 'text-slate-500' };
        if (quality.level === 'excellent') return { text: '매우 안정', color: 'text-emerald-500' };
        if (quality.level === 'stable') return { text: '안정', color: 'text-cyan-500' };
        if (quality.level === 'caution') return { text: '주의', color: 'text-amber-500' };
        return { text: '위험', color: 'text-red-500' };
    }, [quality.level]);
    const qualityInlineText = useMemo(() => (
        quality.started ? `${quality.score}/100 · ${qualityMeta.text}` : '준비 중'
    ), [quality.started, quality.score, qualityMeta.text]);

    const progressValue = useMemo(() => {
        const value = Number(
            printProgress.progressExact !== undefined
                ? printProgress.progressExact
                : (printProgress.progress || 0)
        );
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.min(100, value));
    }, [printProgress.progress, printProgress.progressExact]);
    const progressLabel = useMemo(() => {
        if (progressValue >= 99.995) return '100%';
        return `${progressValue.toFixed(2)}%`;
    }, [progressValue]);
    const useExpandedWeather = !isMobile && alerts.length === 0;
    const weatherAqiLabel = useMemo(() => {
        const aqi = Number(weather.usAqi || 0);
        if (!aqi) return '측정중';
        if (aqi <= 50) return '좋음';
        if (aqi <= 100) return '보통';
        if (aqi <= 150) return '민감군 주의';
        if (aqi <= 200) return '나쁨';
        return '매우 나쁨';
    }, [weather.usAqi]);
    const weatherText = useMemo(() => ({
        wind: Number(weather.windSpeed || 0) > 0 ? `${Number(weather.windSpeed || 0).toFixed(1)} m/s (${Math.round(Number(weather.windDirection || 0))}°)` : '-',
        pressure: Number(weather.pressure || 0) > 0 ? `${weather.pressure} hPa` : '-',
        cloudRain: (Number(weather.cloudCover || 0) > 0 || Number(weather.precipitation || 0) > 0)
            ? `${weather.cloudCover || 0}% / ${Number(weather.precipitation || 0).toFixed(1)}mm`
            : '-',
        pm: (Number(weather.pm25 || 0) > 0 || Number(weather.pm10 || 0) > 0)
            ? `PM2.5 ${Number(weather.pm25 || 0).toFixed(1)} / PM10 ${Number(weather.pm10 || 0).toFixed(1)}`
            : 'PM 측정중',
        aqi: Number(weather.usAqi || 0) > 0 ? `${weather.usAqi || 0} / ${weather.euAqi || 0} · ${weatherAqiLabel}` : '-',
        gases: (Number(weather.ozone || 0) > 0 || Number(weather.no2 || 0) > 0)
            ? `${weather.ozone || 0} / ${weather.no2 || 0} μg/m³`
            : '-'
    }), [weather.windSpeed, weather.windDirection, weather.pressure, weather.cloudCover, weather.precipitation, weather.pm25, weather.pm10, weather.usAqi, weather.euAqi, weather.ozone, weather.no2, weatherAqiLabel]);
    const circleSize = 84;
    const circleCenter = circleSize / 2;
    const circleRadius = 32;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const progressStroke = circleCircumference * (1 - (progressValue / 100));

    const getStatusText = (status) => {
        switch (status) {
            case 'printing': return '출력 중';
            case 'paused': return '일시정지';
            case 'complete': return '완료됨';
            case 'idle': return '대기 중';
            case 'error': return '오류';
            default: return status?.toUpperCase() || '알 수 없음';
        }
    };
    return (
        <div className="w-full space-y-4 animate-fade-in">
            {/* 1. 상태 대시보드 */}
            <CollapsibleSection title="상태 대시보드" icon={Activity} defaultOpen={true}>
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 시계 & 날씨 */}
                        <div className="premium-card p-4 flex flex-col h-full">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-bold text-slate-400">시스템 시간</div>
                                    <Clock className="w-4 h-4 text-slate-500" />
                                </div>
                                <div className="text-3xl font-black gradient-text gradient-primary tabular-nums">
                                    {time.toLocaleTimeString('ko-KR', { hour12: false })}
                                </div>
                            <div className="text-sm text-slate-400 mt-1">
                                {time.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                            </div>

                            {alerts.length > 0 && (
                                <div className={cn(
                                    "mt-4 p-3 rounded-xl border",
                                    "bg-amber-50 border-amber-200 text-amber-800",
                                    "dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-200"
                                )}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-wider">경고 / 알림</span>
                                    </div>
                                    <div className="space-y-2">
                                        {alerts.map((alert) => (
                                            <div
                                                key={alert.id}
                                                className={cn(
                                                    "rounded-lg border p-2.5 text-xs md:text-sm",
                                                    alert.level === 'error'
                                                        ? "border-red-300/70 bg-red-100/50 dark:border-red-700/50 dark:bg-red-900/20"
                                                        : "border-amber-300/70 bg-amber-100/40 dark:border-amber-700/50 dark:bg-amber-900/15"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide",
                                                        alert.level === 'error'
                                                            ? "bg-red-500 text-white"
                                                            : alert.level === 'warn'
                                                                ? "bg-amber-500 text-white"
                                                                : "bg-slate-500 text-white"
                                                    )}>
                                                        {alert.level}
                                                    </span>
                                                    <span className="font-bold text-[11px]">[{alert.source}] {alert.card?.title || '알림'}</span>
                                                </div>
                                                <div className="leading-snug mb-1.5">
                                                    <span className="font-semibold mr-1">원문:</span>
                                                    <span>{alert.message}</span>
                                                </div>
                                                {alert.card?.causes?.length > 0 && (
                                                    <div className="leading-snug mb-1">
                                                        <span className="font-semibold mr-1">가능 원인:</span>
                                                        <span>{alert.card.causes.join(' / ')}</span>
                                                    </div>
                                                )}
                                                {alert.card?.actions?.length > 0 && (
                                                    <div className="leading-snug">
                                                        <span className="font-semibold mr-1">즉시 조치:</span>
                                                        <span>{alert.card.actions.join(' / ')}</span>
                                                    </div>
                                                )}
                                                {alert.card?.quickActions?.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {alert.card.quickActions.map((action, idx) => (
                                                            <button
                                                                key={`${alert.id}-qa-${idx}`}
                                                                type="button"
                                                                onClick={() => handleQuickActionCommand(action)}
                                                                disabled={controlLoading}
                                                                className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold disabled:opacity-50"
                                                            >
                                                                {action.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={cn("pt-4 border-t border-slate-100 dark:border-slate-800", alerts.length > 0 ? "mt-4" : "mt-3")}>
                            {useExpandedWeather ? (
                                <div className={cn(
                                    "rounded-2xl p-4 border",
                                    "bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 border-cyan-100",
                                    "dark:bg-gradient-to-br dark:from-slate-900/70 dark:via-slate-900/50 dark:to-slate-800/60 dark:border-slate-700/70"
                                )}>
                                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
                                        <div className="min-w-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="md:col-span-2 rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-300">
                                                    <Cloud className="w-4 h-4" />
                                                    <span className="text-sm font-black tracking-wide">외부 환경</span>
                                                </div>
                                                <div className="mt-1.5 flex items-end gap-2">
                                                    <span className="text-3xl md:text-4xl font-black text-cyan-500">{weather.temperature}°C</span>
                                                    <span className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-0.5">{weather.description || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">체감/위치</div>
                                                <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                                                    {weather.feelsLike}°C · {weather.city || '서울시'}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">미세먼지</div>
                                                <div className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">
                                                    {weatherText.pm}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2">
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">습도</div>
                                                <div className="text-lg font-black text-cyan-500">{weather.humidity}%</div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">풍속</div>
                                                <div className="text-lg font-black text-violet-500">{weatherText.wind}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">기압</div>
                                                <div className="text-lg font-black text-amber-500">{weatherText.pressure}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">구름/강수</div>
                                                <div className="text-lg font-black text-emerald-500">{weatherText.cloudRain}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">AQI(US/EU)</div>
                                                <div className="text-lg font-black text-rose-500">{weatherText.aqi}</div>
                                            </div>
                                            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 px-3 py-2 border border-cyan-100 dark:border-slate-700">
                                                <div className="text-[11px] text-slate-500">오존/이산화질소</div>
                                                <div className="text-lg font-black text-indigo-500">{weatherText.gases}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                        업데이트: {weather.updatedAt || '-'}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Cloud className="w-4 h-4 text-cyan-400" />
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">외부 환경</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-bold text-cyan-500">{weather.temperature}°C</span>
                                            <span className="text-sm text-slate-400">{weather.humidity}%</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 text-right">{weather.description || '-'}</div>
                                </>
                            )}
                        </div>
                        </div>

                        {/* 프린터 상태 */}
                        <div className="premium-card p-4 md:p-6 min-w-0">
                            <div className="grid grid-cols-[56px_minmax(0,1fr)_84px] sm:grid-cols-[96px_minmax(0,1fr)_96px] items-center gap-3 mb-4 min-w-0">
                                <div className="min-w-0">
                                    {printProgress.thumbnail ? (
                                        <div className="block w-14 h-14 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-900 relative">
                                            <img
                                                key={thumbnailView.key}
                                                src={thumbnailView.src}
                                                alt="Thumbnail"
                                                className={cn(
                                                    "w-full h-full object-cover transition-opacity cursor-zoom-in",
                                                    thumbnailView.status === 'loading' ? "opacity-60" : "opacity-100"
                                                )}
                                                onClick={() => {
                                                    if (thumbnailView.status === 'success') setIsThumbnailModalOpen(true);
                                                }}
                                                onLoad={() => {
                                                    setThumbnailView((prev) => ({ ...prev, status: 'success' }));
                                                }}
                                                onError={(e) => {
                                                    const chain = String(printProgress.thumbnail || '').split('||').filter(Boolean);
                                                    const current = Number(e.currentTarget.dataset.fallbackIdx || String(thumbnailView.idx || 0));
                                                    const next = current + 1;
                                                    if (next < chain.length) {
                                                        e.currentTarget.dataset.fallbackIdx = String(next);
                                                        setThumbnailView((prev) => ({ ...prev, idx: next, src: chain[next], status: 'loading' }));
                                                        e.currentTarget.src = chain[next];
                                                        return;
                                                    }
                                                    setThumbnailView((prev) => ({ ...prev, status: 'error' }));
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex w-14 h-14 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 items-center justify-center text-slate-300 relative">
                                            <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 opacity-50" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                                            <div className="text-xs md:text-sm font-bold text-slate-400">프린터 상태</div>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide whitespace-nowrap",
                                                realtime.connected
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                            )}>
                                                {realtime.connected ? 'WS 실시간' : 'HTTP 폴백'}
                                            </span>
                                        </div>
                                        <div className={cn("text-xl md:text-3xl font-black truncate", printProgress.progress > 0 ? "text-green-500" : "text-slate-500")}>
                                            {getStatusText(printerStatus.state)}
                                        </div>
                                        {printProgress.progress > 0 && (
                                            <div className="text-xs md:text-sm text-slate-500 mt-1 font-medium truncate w-full">
                                                {printProgress.filename}
                                            </div>
                                        )}
                                    </div>
                                <div className="flex flex-col items-end gap-1.5 text-right min-w-[84px] sm:min-w-[96px]">
                                    <div className="relative w-[84px] h-[84px] md:w-[96px] md:h-[96px]">
                                        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${circleSize} ${circleSize}`}>
                                            <circle
                                                cx={circleCenter}
                                                cy={circleCenter}
                                                r={circleRadius}
                                                className="fill-none stroke-slate-200 dark:stroke-slate-800"
                                                strokeWidth="7"
                                            />
                                            <circle
                                                cx={circleCenter}
                                                cy={circleCenter}
                                                r={circleRadius}
                                                className="fill-none stroke-indigo-500"
                                                strokeWidth="7"
                                                strokeLinecap="round"
                                                strokeDasharray={circleCircumference}
                                                strokeDashoffset={progressStroke}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-[11px] md:text-sm font-black gradient-text gradient-primary leading-none px-1 text-center">
                                                {progressLabel}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 상세 정보 그리드 */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Timer className="w-3 h-3" /> 진행 시간</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatTime(printProgress.printDuration)}</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Timer className="w-3 h-3" /> 남은 시간</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200">{printProgress.timeLeft > 0 ? formatTime(printProgress.timeLeft) : '계산 중'}</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><CheckCircle2 className="w-3 h-3" /> 완료 예정</div><div className="text-sm font-bold text-indigo-500">{calculateETA(printProgress.timeLeft)}</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><ArrowUpFromLine className="w-3 h-3" /> 현재 높이</div><div className="text-sm font-bold text-amber-500">{extraStatus.currentHeight.toFixed(2)} mm</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Gauge className="w-3 h-3" /> 출력 속도</div><div className="text-sm font-bold text-violet-500">{Math.round(printProgress.speed)} mm/s</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Droplets className="w-3 h-3" /> 유량</div><div className="text-sm font-bold text-rose-500">{Math.abs(printProgress.flowRate).toFixed(1)} mm³/s</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Ruler className="w-3 h-3" /> 사용 길이</div><div className="text-sm font-bold text-cyan-500">{extraStatus.filamentUsed.toFixed(1)} m</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Fan className="w-3 h-3" /> 팬 속도</div><div className="text-sm font-bold text-emerald-500">{Math.round(extraStatus.fanSpeed)} %</div></div>
                                <div><div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mb-1"><Radio className="w-3 h-3" /> 품질 점수</div><div className={cn("text-sm font-black whitespace-nowrap min-h-[20px]", qualityMeta.color)}>{qualityInlineText}</div></div>
                            </div>

                            {/* 비용 견적 */}
                            {printProgress.cost && (
                                <div className="mt-6 pt-4 border-t border-dashed border-slate-300 dark:border-slate-700">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Receipt className="w-4 h-4 text-slate-500" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">실시간 비용 견적</span>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><span>재료비</span><span className="font-mono">{printProgress.cost.filament.toLocaleString()}원</span></div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2"><span>전기세</span><span className="font-mono">{printProgress.cost.electricity.toLocaleString()}원</span></div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400 mb-1">합계</div>
                                                <div className="text-xl font-black text-slate-700 dark:text-yellow-500 flex items-center gap-1"><Coins className="w-5 h-5 text-yellow-500" />{printProgress.cost.total.toLocaleString()}원</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="premium-card p-4">
                            <div className="flex justify-between items-center mb-2"><div className="text-sm font-bold text-slate-400">노즐 온도</div><Thermometer className="w-4 h-4 text-orange-500" /></div>
                            <div className="flex items-baseline gap-2"><span className="text-lg md:text-2xl font-black text-orange-500">{extraStatus.extruderTemp.toFixed(1)}°C</span><span className="text-xs md:text-sm text-slate-500">/ {extraStatus.extruderTarget}°C</span></div>
                        </div>
                        <div className="premium-card p-4">
                            <div className="flex justify-between items-center mb-2"><div className="text-sm font-bold text-slate-400">베드 온도</div><Layers className="w-4 h-4 text-blue-500" /></div>
                            <div className="flex items-baseline gap-2"><span className="text-lg md:text-2xl font-black text-blue-500">{extraStatus.bedTemp.toFixed(1)}°C</span><span className="text-xs md:text-sm text-slate-500">/ {extraStatus.bedTarget}°C</span></div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* 2. 메인 제어 센터 (좌측) & 파일 관리자 (우측) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                {/* 좌측: 제어 패널 */}
                <div className="lg:col-span-2 flex flex-col h-full space-y-4">
                    <CollapsibleSection title="제어 센터" icon={Zap} defaultOpen={true} className="h-full flex flex-col">
                        <div className="space-y-6">
                            {/* 차트 컴포넌트가 자체 높이를 가지므로 부모에서 높이 제한 제거 + 하단 여백 확보 */}
                            <div className="w-full mb-8"><TemperatureChart /></div>
                            <hr className={cn("border-t", theme === 'dark' ? "border-slate-800" : "border-slate-100")} />
                            <div className="grid grid-cols-4 gap-3 mt-4">
                                <button onClick={() => handleQuickActionCommand({ label: 'G28 (홈)', script: 'G28', confirm: true })} disabled={controlLoading} className={cn("p-2 md:p-4 rounded-xl font-black text-white transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-1 md:gap-2", "bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700", controlLoading && "opacity-50")}><HomeIcon className="w-5 h-5 md:w-8 md:h-8" /><span className="text-[10px] md:text-sm whitespace-nowrap">G28 (홈)</span></button>
                                <button onClick={handleEmergencyStop} disabled={controlLoading} className={cn("p-2 md:p-4 rounded-xl font-black text-white transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-1 md:gap-2", isEmergencyConfirm ? "bg-red-600 animate-pulse" : "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700", controlLoading && "opacity-50")}><AlertTriangle className="w-5 h-5 md:w-8 md:h-8" /><span className="text-[10px] md:text-sm whitespace-nowrap">{isEmergencyConfirm ? '확인!' : '비상정지'}</span></button>
                                <button onClick={handlePauseResume} disabled={controlLoading} className={cn("p-2 md:p-4 rounded-xl font-black text-white transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-1 md:gap-2", printerStatus.state === 'complete' ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600", controlLoading && "opacity-50")}>{printerStatus.state === 'complete' ? (<CheckCircle2 className="w-5 h-5 md:w-8 md:h-8" />) : printerStatus.state === 'paused' ? (<Play className="w-5 h-5 md:w-8 md:h-8" />) : (<Pause className="w-5 h-5 md:w-8 md:h-8" />)}<span className="text-[10px] md:text-sm whitespace-nowrap">{printerStatus.state === 'complete' ? '완료 확인' : printerStatus.state === 'paused' ? '재개' : '일시정지'}</span></button>
                                <button onClick={handlePreheatPLA} disabled={controlLoading} className={cn("p-2 md:p-4 rounded-xl font-black text-white transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-1 md:gap-2", "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700", controlLoading && "opacity-50")}><Flame className="w-5 h-5 md:w-8 md:h-8" /><span className="text-[10px] md:text-sm whitespace-nowrap">예열</span></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center uppercase tracking-wider">Z-Offset 제어</div><div className="flex gap-2"><button onClick={() => handleZOffset(-0.05)} className="flex-1 py-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold transition-all active:scale-95">-0.05</button><button onClick={() => handleZOffset(0.05)} className="flex-1 py-3 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold transition-all active:scale-95">+0.05</button></div></div>
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800"><div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center uppercase tracking-wider">빠른 매크로</div><div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">{macros.map(macro => (<button key={macro} onClick={() => handleMacro(macro)} className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-bold transition-all active:scale-95 flex-grow md:flex-grow-0">{macro}</button>))}</div></div>
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center uppercase tracking-wider inline-flex items-center justify-center gap-1 w-full">
                                        <TerminalSquare className="w-3.5 h-3.5" />
                                        콘솔 명령
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={consoleCommand}
                                                onChange={(e) => setConsoleCommand(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendConsoleCommand();
                                                    }
                                                }}
                                                placeholder="예: M117 Hello"
                                                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                            />
                                            <button
                                                onClick={() => handleSendConsoleCommand()}
                                                disabled={controlLoading || !consoleCommand.trim()}
                                                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                전송
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { script: 'G28', label: 'G28 (홈)' },
                                                { script: 'BED_MESH_CALIBRATE', label: 'BED_MESH_CALIBRATE (베드메쉬)' },
                                                { script: 'QUAD_GANTRY_LEVEL', label: 'QUAD_GANTRY_LEVEL (갠트리 수평)' },
                                                { script: 'M84', label: 'M84 (모터 해제)' }
                                            ].map((preset) => (
                                                <button
                                                    key={preset.script}
                                                    onClick={() => handleSendConsoleCommand(preset.script)}
                                                    disabled={controlLoading}
                                                    className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                        {consoleStatus.text && (
                                            <div className={cn(
                                                "text-xs rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5",
                                                consoleStatus.type === 'success'
                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                            )}>
                                                {consoleStatus.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                                {consoleStatus.text}
                                            </div>
                                        )}
                                        {consoleHistory.length > 0 && (
                                            <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1.5 pt-1">
                                                {consoleHistory.slice(0, 5).map((item) => (
                                                    <div key={item.id} className="text-[11px] flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
                                                        <span className="truncate font-mono">{item.command}</span>
                                                        <span className={cn("shrink-0", item.success ? "text-emerald-500" : "text-red-500")}>
                                                            {item.timestamp}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* 우측: 파일 관리자 (꽉 채움 및 하단 여백 제거) */}
                <div className="flex flex-col h-full lg:col-span-1">
                    <CollapsibleSection
                        title="파일 관리자"
                        icon={FileCode}
                        defaultOpen={true}
                        // [&>div:last-child]: CollapsibleSection의 컨텐츠 div 강제 확장
                        className="h-full flex flex-col [&>div:last-child]:flex-1 [&>div:last-child]:h-full [&>div:last-child]:min-h-0 [&>div:last-child]:p-0"
                    >
                        {/* FileManager가 부모 전체를 차지하도록 설정 */}
                        <FileManager className="w-full h-full min-h-0" />
                    </CollapsibleSection>
                </div>
            </div>
            {isThumbnailModalOpen && (
                <div
                    className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-[1px] flex items-center justify-center p-4"
                    onClick={() => setIsThumbnailModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-4xl max-h-[90vh] rounded-xl overflow-hidden border border-slate-700 bg-slate-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="absolute right-2 top-2 z-10 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white"
                            onClick={() => setIsThumbnailModalOpen(false)}
                            aria-label="썸네일 닫기"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <img src={thumbnailView.src} alt="Thumbnail Preview" className="w-full h-full max-h-[90vh] object-contain" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
