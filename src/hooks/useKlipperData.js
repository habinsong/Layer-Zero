import { useState, useEffect, useRef } from 'react';
import {
    getServerInfo,
    getPrinterObjects,
    getSystemInfo,
    getPrinterStats,
    getFileMetadata,
    getGcodeTextPreview,
    getPreferredMoonrakerBase,
    subscribePrinterObjectsRealtime
} from '../utils/moonrakerApi';
import { mapAlertToErrorCard } from '../utils/errorCardMapper';

const THUMBNAIL_CACHE_TTL_MS = 60 * 1000;

function usePageVisibility() {
    const [isVisible, setIsVisible] = useState(() => {
        if (typeof document === 'undefined') return true;
        return document.visibilityState === 'visible';
    });

    useEffect(() => {
        const onVisibilityChange = () => setIsVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    return isVisible;
}

function calculateStableTimeLeft({
    progressValue,
    printDuration,
    printState,
    previousTimeLeft
}) {
    const activeState = printState === 'printing' || printState === 'paused';
    if (!activeState) return 0;
    if (!progressValue || progressValue <= 0 || !Number.isFinite(progressValue)) return 0;

    // 초반 가열/초기 적층 구간은 ETA가 크게 튀므로 보류
    // 기존(5%, 90초)은 너무 늦게 풀려서 실제 출력 중에도 "계산 중"이 길어질 수 있음.
    if (progressValue < 0.005 || printDuration < 25) {
        return previousTimeLeft > 0 ? previousTimeLeft : 0;
    }

    const raw = (printDuration / progressValue) - printDuration;
    const cappedRaw = Math.max(0, Math.min(raw, 72 * 3600)); // 최대 72시간

    if (!previousTimeLeft || previousTimeLeft <= 0) {
        return cappedRaw;
    }

    // 하향(ETA 감소)에는 빠르게, 상향(ETA 증가)에는 보수적으로 반응
    const isDropping = cappedRaw < previousTimeLeft;
    const alpha = isDropping ? 0.5 : 0.3;
    const smoothed = (previousTimeLeft * (1 - alpha)) + (cappedRaw * alpha);
    const maxDecrease = Math.max(300, previousTimeLeft * 0.45);
    const maxIncrease = Math.max(120, previousTimeLeft * 0.2);
    const lower = Math.max(0, previousTimeLeft - maxDecrease);
    const upper = previousTimeLeft + maxIncrease;
    return Math.min(upper, Math.max(lower, smoothed));
}

function mergePrinterStatus(previous = {}, patch = {}) {
    const next = { ...previous };
    Object.entries(patch || {}).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            next[key] = { ...(previous[key] || {}), ...value };
            return;
        }
        next[key] = value;
    });
    return next;
}

function buildProgressFromStatus(status, thumbnail, costConfig = {}) {
    const printStats = status.print_stats || {};
    const displayStatus = status.display_status || {};
    const virtualSdcard = status.virtual_sdcard || {};
    const motionReport = status.motion_report || {};

    const progressValue = displayStatus.progress || virtualSdcard.progress || 0;
    const printDuration = printStats.print_duration || printStats.total_duration || 0;

    const timeLeft = progressValue > 0 && progressValue < 1
        ? (printDuration / progressValue) - printDuration
        : 0;

    const actualSpeed = motionReport.live_velocity || 0;
    const extruderVelocity = motionReport.live_extruder_velocity || 0;
    const flowRate = extruderVelocity * 2.405;

    const COST_PER_KWH = Number.isFinite(Number(costConfig.electricityCostPerKwh))
        ? Number(costConfig.electricityCostPerKwh)
        : 200;
    const COST_PER_KG_FILAMENT = Number.isFinite(Number(costConfig.filamentCostPerKg))
        ? Number(costConfig.filamentCostPerKg)
        : 18000;
    const POWER_CONSUMPTION_W = 150;
    const FILAMENT_DIAMETER = 1.75;

    const usedLenMm = printStats.filament_used || 0;
    const volume = usedLenMm * (Math.PI * Math.pow(FILAMENT_DIAMETER / 2, 2));
    const weightG = volume * 0.00124;
    const filamentCost = weightG * (COST_PER_KG_FILAMENT / 1000);

    const hours = printDuration / 3600;
    const kwh = (POWER_CONSUMPTION_W * hours) / 1000;
    const electricityCost = kwh * COST_PER_KWH;

    return {
        filename: printStats.filename || '',
        progress: Math.round(progressValue * 100),
        progressExact: progressValue * 100,
        printDuration,
        printTime: progressValue > 0 ? printDuration / progressValue : 0,
        timeLeft,
        eta: timeLeft > 0 ? new Date(Date.now() + timeLeft * 1000) : null,
        speed: actualSpeed,
        flowRate,
        thumbnail,
        cost: {
            filament: Math.round(filamentCost),
            electricity: Math.round(electricityCost),
            total: Math.round(filamentCost + electricityCost)
        },
        loading: false
    };
}

function buildTemperatureFromStatus(status) {
    const extruder = status.extruder || {};
    const bed = status.heater_bed || {};

    return {
        extruder: {
            current: parseFloat((extruder.temperature || 0).toFixed(1)),
            target: parseFloat((extruder.target || 0).toFixed(1)),
            power: Math.round((extruder.power || 0) * 100)
        },
        bed: {
            current: parseFloat((bed.temperature || 0).toFixed(1)),
            target: parseFloat((bed.target || 0).toFixed(1)),
            power: Math.round((bed.power || 0) * 100)
        },
        loading: false
    };
}

function buildExtraStatusFromStatus(status) {
    return {
        filamentUsed: (status.print_stats?.filament_used || 0) / 1000,
        fanSpeed: (status.fan?.speed || 0) * 100,
        currentHeight: status.toolhead?.position?.[2] || 0,
        extruderTemp: status.extruder?.temperature || 0,
        extruderTarget: status.extruder?.target || 0,
        bedTemp: status.heater_bed?.temperature || 0,
        bedTarget: status.heater_bed?.target || 0,
        currentSpeed: status.motion_report?.live_velocity || 0,
        speedFactor: (status.gcode_move?.speed_factor || 1) * 100,
        flowFactor: (status.gcode_move?.extrude_factor || 1) * 100
    };
}

function calculateQualityScore({ status, alerts = [], previousSpeed = 0, previousScore = 100 }) {
    const printState = status.print_stats?.state || 'standby';
    const isActivePrint = printState === 'printing' || printState === 'paused';

    const extCurrent = Number(status.extruder?.temperature || 0);
    const extTarget = Number(status.extruder?.target || 0);
    const bedCurrent = Number(status.heater_bed?.temperature || 0);
    const bedTarget = Number(status.heater_bed?.target || 0);
    const speed = Number(status.motion_report?.live_velocity || 0);
    const progress = Number(status.display_status?.progress || status.virtual_sdcard?.progress || 0);

    let score = 100;
    const reasons = [];

    if (isActivePrint) {
        if (extTarget > 0) {
            const extDelta = Math.abs(extCurrent - extTarget);
            const extPenalty = Math.min(25, Math.max(0, (extDelta - 1.5) * 2));
            score -= extPenalty;
            if (extDelta >= 4) reasons.push(`노즐 편차 ${extDelta.toFixed(1)}C`);
        }

        if (bedTarget > 0) {
            const bedDelta = Math.abs(bedCurrent - bedTarget);
            const bedPenalty = Math.min(16, Math.max(0, (bedDelta - 1.5) * 1.4));
            score -= bedPenalty;
            if (bedDelta >= 3.5) reasons.push(`베드 편차 ${bedDelta.toFixed(1)}C`);
        }

        if (previousSpeed > 0.5) {
            const speedRatio = Math.abs(speed - previousSpeed) / Math.max(previousSpeed, 5);
            const speedPenalty = Math.min(18, speedRatio * 20);
            score -= speedPenalty;
            if (speedRatio >= 0.35) reasons.push('속도 변동 큼');
        }

        if (progress > 0.05 && printState === 'printing' && speed < 1) {
            score -= 8;
            reasons.push('실속도 낮음');
        }
    }

    const errorCount = alerts.filter((a) => a.level === 'error').length;
    const warnCount = alerts.filter((a) => a.level === 'warn').length;
    const infoCount = alerts.filter((a) => a.level === 'info').length;
    score -= (errorCount * 25) + (warnCount * 10) + (infoCount * 3);

    const rawScore = Math.max(0, Math.min(100, score));
    const smoothed = (previousScore * 0.65) + (rawScore * 0.35);
    const finalScore = Math.round(Math.max(0, Math.min(100, smoothed)));

    let level = 'excellent';
    if (finalScore < 60) level = 'risk';
    else if (finalScore < 75) level = 'caution';
    else if (finalScore < 90) level = 'stable';

    return {
        score: finalScore,
        level,
        reasons: reasons.slice(0, 3),
        speed
    };
}

function isPhysicalPrintActive(status) {
    const printState = status.print_stats?.state || 'standby';
    if (printState !== 'printing') return false;
    const progress = Number(status.display_status?.progress || status.virtual_sdcard?.progress || 0);
    const speed = Number(status.motion_report?.live_velocity || 0);
    return progress >= 0.005 && speed > 0.5;
}

function buildAlertsFromStatus(status, serverWarnings = []) {
    const alerts = [];
    const printState = status.print_stats?.state;
    const printMessage = (status.print_stats?.message || '').trim();
    const displayMessage = (status.display_status?.message || '').trim();

    if (printState === 'error') {
        alerts.push({
            id: `print-error-${printMessage || 'state'}`,
            level: 'error',
            source: 'Klipper',
            message: printMessage || '출력 상태가 error입니다.'
        });
    } else if (printMessage) {
        alerts.push({
            id: `print-msg-${printMessage}`,
            level: 'warn',
            source: 'Print',
            message: printMessage
        });
    }

    const isIgnorableDisplayMessage = (() => {
        const normalized = displayMessage.toLowerCase();
        if (!normalized) return false;
        const ignorePatterns = [
            'purge extruder',
            'heating',
            'printing',
            'ready'
        ];
        return ignorePatterns.some((pattern) => normalized.includes(pattern));
    })();

    if (displayMessage && !isIgnorableDisplayMessage) {
        alerts.push({
            id: `display-msg-${displayMessage}`,
            level: 'info',
            source: 'M117',
            message: displayMessage
        });
    }

    serverWarnings.forEach((warning, idx) => {
        const text = typeof warning === 'string'
            ? warning
            : (warning?.message || warning?.title || JSON.stringify(warning));
        if (!text) return;
        alerts.push({
            id: `server-warn-${idx}-${text}`,
            level: 'warn',
            source: 'Moonraker',
            message: text
        });
    });

    const deduped = [];
    const seen = new Set();
    alerts.forEach((a) => {
        const key = `${a.source}:${a.message}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(a);
    });
    return deduped
        .slice(0, 3)
        .map((alert) => mapAlertToErrorCard(alert));
}

function parseEmbeddedThumbnailBase64(gcodeText = '') {
    if (!gcodeText) return null;
    const lines = String(gcodeText).split(/\r?\n/);
    const beginIdx = lines.findIndex((line) => /thumbnail begin/i.test(line));
    if (beginIdx < 0) return null;
    const endIdx = lines.findIndex((line, idx) => idx > beginIdx && /thumbnail end/i.test(line));
    if (endIdx < 0) return null;

    const chunks = [];
    for (let i = beginIdx + 1; i < endIdx; i += 1) {
        const cleaned = lines[i].replace(/^\s*;\s?/, '').trim();
        if (!cleaned) continue;
        chunks.push(cleaned);
    }
    if (chunks.length === 0) return null;
    const base64 = chunks.join('');
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return null;
    return base64;
}

async function loadThumbnailIfNeeded(filename, currentFilenameRef, cachedThumbnailRef) {
    if (!filename) {
        currentFilenameRef.current = '';
        cachedThumbnailRef.current = null;
        return null;
    }

    const now = Date.now();
    if (
        filename === currentFilenameRef.current &&
        cachedThumbnailRef.current &&
        (now - Number(cachedThumbnailRef.current.fetchedAt || 0) < THUMBNAIL_CACHE_TTL_MS)
    ) {
        return cachedThumbnailRef.current.value;
    }

    currentFilenameRef.current = filename;
    const metaResult = await getFileMetadata(filename);
    if (!metaResult.success || !metaResult.result?.thumbnails?.length) {
        const gcodePreview = await getGcodeTextPreview(filename, 500000);
        if (gcodePreview.success) {
            const embeddedBase64 = parseEmbeddedThumbnailBase64(gcodePreview.text);
            if (embeddedBase64) {
                const dataUrl = `data:image/png;base64,${embeddedBase64}`;
                cachedThumbnailRef.current = {
                    value: dataUrl,
                    fetchedAt: Date.now()
                };
                return dataUrl;
            }
        }
        cachedThumbnailRef.current = null;
        return null;
    }

    const biggest = metaResult.result.thumbnails.reduce((prev, current) => (
        (prev.width * prev.height > current.width * current.height) ? prev : current
    ));

    let thumb = biggest.data ? `data:image/png;base64,${biggest.data}` : `${biggest.relative_path}`;
    if (!biggest.data && biggest.relative_path) {
        const baseUrl = metaResult.baseUrl || getPreferredMoonrakerBase();
        const rel = String(biggest.relative_path).replace(/^\/+/, '');
        const filePath = rel.startsWith('gcodes/') ? rel : `gcodes/${rel}`;
        const relativeThumbUrl = `${baseUrl}/server/files/${filePath}`;
        const fileOnlyName = String(filename).split('/').pop() || String(filename);
        const thumb300 = `${baseUrl}/server/files/gcodes/.thumbs/${encodeURIComponent(fileOnlyName)}-300x300.png`;
        const sameOriginThumb300 = `${window.location.origin}/server/files/gcodes/.thumbs/${encodeURIComponent(fileOnlyName)}-300x300.png`;
        // 우선순위: 사용자 요청 형식(.thumbs 300x300) -> 메타데이터 relative_path -> same-origin 경로
        thumb = [thumb300, relativeThumbUrl, sameOriginThumb300]
            .filter(Boolean)
            .filter((item, index, arr) => arr.indexOf(item) === index)
            .join('||');
    }

    cachedThumbnailRef.current = {
        value: thumb,
        fetchedAt: Date.now()
    };
    return thumb;
}

/**
 * Klipper 프린터 상태 Hook
 */
export function useKlipperStatus(options = {}) {
    const { enabled = true, intervalMs = 5000 } = options;
    const isVisible = usePageVisibility();
    const wsConnectedRef = useRef(false);

    const [status, setStatus] = useState({
        isOnline: false,
        state: 'offline',
        loading: true
    });

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;
        let lastHttpFetchAt = 0;

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: ['print_stats'],
            onConnectionChange: ({ connected }) => {
                wsConnectedRef.current = connected;
            },
            onStatusUpdate: (statusPatch) => {
                if (cancelled) return;
                const state = statusPatch?.print_stats?.state;
                if (!state) return;
                setStatus({ isOnline: true, state, loading: false });
            }
        });

        async function fetchStatus() {
            const now = Date.now();
            if (wsConnectedRef.current && now - lastHttpFetchAt < Math.max(15000, intervalMs * 2)) {
                return;
            }
            lastHttpFetchAt = now;

            const serverInfo = await getServerInfo();
            if (!serverInfo.success) {
                if (!cancelled) {
                    setStatus({ isOnline: false, state: 'offline', loading: false });
                }
                return;
            }

            const printerData = await getPrinterObjects(['print_stats']);
            const state = printerData.result?.status?.print_stats?.state || 'standby';
            if (!cancelled) {
                setStatus({ isOnline: true, state, loading: false });
            }
        }

        fetchStatus();
        const interval = setInterval(fetchStatus, intervalMs);
        return () => {
            cancelled = true;
            unsubscribeRealtime?.();
            clearInterval(interval);
        };
    }, [enabled, intervalMs, isVisible]);

    return status;
}

/**
 * 홈 대시보드 통합 Hook (요청 통합용)
 */
export function useKlipperDashboardData(options = {}) {
    const {
        enabled = true,
        pollIntervalMs = 3000,
        statsIntervalMs = 30000,
        costConfig = {}
    } = options;

    const isVisible = usePageVisibility();
    const currentFilenameRef = useRef('');
    const cachedThumbnailRef = useRef(null);
    const lastStatsFetchRef = useRef(0);
    const lastServerInfoFetchRef = useRef(0);
    const serverWarningsRef = useRef([]);
    const prevTimeLeftRef = useRef(0);
    const prevSpeedRef = useRef(0);
    const prevQualityScoreRef = useRef(100);
    const qualityMotionStableCountRef = useRef(0);
    const qualityStartedRef = useRef(false);
    const wsConnectedRef = useRef(false);
    const statusSnapshotRef = useRef({});
    const lastHttpCombinedFetchRef = useRef(0);
    const applySequenceRef = useRef(0);

    const [data, setData] = useState({
        status: { isOnline: false, state: 'offline', loading: true },
        realtime: { connected: false, mode: 'polling', lastEventAt: 0 },
        quality: { score: 100, level: 'warmingup', reasons: ['준비 중'], loading: true, started: false },
        printProgress: {
            filename: '',
            progress: 0,
            printDuration: 0,
            printTime: 0,
            timeLeft: 0,
            eta: null,
            speed: 0,
            flowRate: 0,
            thumbnail: null,
            cost: { filament: 0, electricity: 0, total: 0 },
            loading: true
        },
        temperature: {
            extruder: { current: 0, target: 0, power: 0 },
            bed: { current: 0, target: 0, power: 0 },
            loading: true
        },
        extraStatus: {
            filamentUsed: 0,
            fanSpeed: 0,
            currentHeight: 0,
            extruderTemp: 0,
            extruderTarget: 0,
            bedTemp: 0,
            bedTarget: 0,
            currentSpeed: 0,
            speedFactor: 100,
            flowFactor: 100
        },
        jobStats: {
            totalPrintTime: 0,
            totalFilament: 0,
            averagePrintTime: 0,
            longestPrintTime: 0,
            totalJobs: 0,
            loading: true
        },
        alerts: []
    });

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;
        const watchedObjects = [
            'print_stats',
            'display_status',
            'virtual_sdcard',
            'gcode_move',
            'motion_report',
            'extruder',
            'heater_bed',
            'fan',
            'toolhead'
        ];

        async function applyStatusSnapshot(statusPatch) {
            const mergedStatus = mergePrinterStatus(statusSnapshotRef.current, statusPatch);
            statusSnapshotRef.current = mergedStatus;

            const seq = ++applySequenceRef.current;
            const statusData = mergedStatus;
            const filename = statusData.print_stats?.filename || '';
            const thumbnail = await loadThumbnailIfNeeded(filename, currentFilenameRef, cachedThumbnailRef);
            if (cancelled || seq !== applySequenceRef.current) return;

            const progressValue = statusData.display_status?.progress || statusData.virtual_sdcard?.progress || 0;
            const printDuration = statusData.print_stats?.print_duration || statusData.print_stats?.total_duration || 0;
            const printState = statusData.print_stats?.state || 'standby';
            const stableTimeLeft = calculateStableTimeLeft({
                progressValue,
                printDuration,
                printState,
                previousTimeLeft: prevTimeLeftRef.current
            });
            prevTimeLeftRef.current = stableTimeLeft;

            const now = Date.now();
            if (now - lastServerInfoFetchRef.current >= 15000) {
                lastServerInfoFetchRef.current = now;
                const serverInfo = await getServerInfo();
                if (serverInfo.success && serverInfo.result?.warnings) {
                    serverWarningsRef.current = Array.isArray(serverInfo.result.warnings)
                        ? serverInfo.result.warnings
                        : [];
                }
            }

            const nextProgress = buildProgressFromStatus(statusData, thumbnail, costConfig);
            const mappedAlerts = buildAlertsFromStatus(statusData, serverWarningsRef.current);
            const quality = calculateQualityScore({
                status: statusData,
                alerts: mappedAlerts,
                previousSpeed: prevSpeedRef.current,
                previousScore: prevQualityScoreRef.current
            });
            const printStateNow = statusData.print_stats?.state || 'standby';
            if (isPhysicalPrintActive(statusData)) {
                qualityMotionStableCountRef.current += 1;
                if (qualityMotionStableCountRef.current >= 3) {
                    qualityStartedRef.current = true;
                }
            } else if (printStateNow === 'printing') {
                qualityMotionStableCountRef.current = 0;
            } else {
                qualityMotionStableCountRef.current = 0;
                qualityStartedRef.current = false;
                prevQualityScoreRef.current = 100;
            }

            prevSpeedRef.current = quality.speed;
            if (qualityStartedRef.current) {
                prevQualityScoreRef.current = quality.score;
            }
            setData((prev) => ({
                ...prev,
                status: {
                    isOnline: true,
                    state: statusData.print_stats?.state || 'standby',
                    loading: false
                },
                realtime: {
                    ...prev.realtime,
                    mode: wsConnectedRef.current ? 'realtime' : 'polling',
                    lastEventAt: Date.now()
                },
                quality: {
                    score: qualityStartedRef.current ? quality.score : 100,
                    level: qualityStartedRef.current ? quality.level : 'warmingup',
                    reasons: qualityStartedRef.current ? quality.reasons : ['준비 중'],
                    loading: false,
                    started: qualityStartedRef.current
                },
                printProgress: {
                    ...nextProgress,
                    timeLeft: stableTimeLeft,
                    eta: stableTimeLeft > 0 ? new Date(Date.now() + stableTimeLeft * 1000) : null
                },
                temperature: buildTemperatureFromStatus(statusData),
                extraStatus: buildExtraStatusFromStatus(statusData),
                alerts: mappedAlerts
            }));
        }

        async function fetchCombined(force = false) {
            const now = Date.now();
            if (!force && wsConnectedRef.current && now - lastHttpCombinedFetchRef.current < Math.max(20000, pollIntervalMs * 4)) {
                return;
            }
            lastHttpCombinedFetchRef.current = now;

            const result = await getPrinterObjects(watchedObjects);
            if (!result.success || !result.result?.status) {
                if (wsConnectedRef.current) return;
                prevTimeLeftRef.current = 0;
                prevSpeedRef.current = 0;
                prevQualityScoreRef.current = 100;
                qualityMotionStableCountRef.current = 0;
                qualityStartedRef.current = false;
                statusSnapshotRef.current = {};
                if (!cancelled) {
                    setData((prev) => ({
                        ...prev,
                        status: { isOnline: false, state: 'offline', loading: false },
                        realtime: {
                            ...prev.realtime,
                            mode: 'polling'
                        },
                        quality: {
                            ...prev.quality,
                            score: 0,
                            level: 'risk',
                            reasons: ['프린터 연결 끊김'],
                            loading: false,
                            started: false
                        },
                        printProgress: { ...prev.printProgress, loading: false },
                        temperature: { ...prev.temperature, loading: false }
                    }));
                }
                return;
            }

            await applyStatusSnapshot(result.result.status);
        }

        async function fetchStatsIfNeeded(force = false) {
            const now = Date.now();
            if (!force && now - lastStatsFetchRef.current < statsIntervalMs) return;
            lastStatsFetchRef.current = now;

            const result = await getPrinterStats();
            if (!result.success || !result.result?.job_totals || cancelled) return;

            const totals = result.result.job_totals;
            setData((prev) => ({
                ...prev,
                jobStats: {
                    totalPrintTime: totals.total_time || 0,
                    totalFilament: (totals.total_filament_used || 0) / 1000,
                    averagePrintTime: totals.total_jobs > 0 ? totals.total_time / totals.total_jobs : 0,
                    longestPrintTime: totals.longest_job || 0,
                    totalJobs: totals.total_jobs || 0,
                    loading: false
                }
            }));
        }

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: watchedObjects,
            onConnectionChange: ({ connected }) => {
                wsConnectedRef.current = connected;
                if (!cancelled) {
                    setData((prev) => ({
                        ...prev,
                        realtime: {
                            ...prev.realtime,
                            connected,
                            mode: connected ? 'realtime' : 'polling'
                        }
                    }));
                }
            },
            onStatusUpdate: (statusPatch) => {
                if (cancelled || !statusPatch) return;
                void applyStatusSnapshot(statusPatch);
            }
        });

        fetchCombined(true);
        fetchStatsIfNeeded(true);

        const polling = setInterval(() => {
            void fetchCombined(false);
        }, pollIntervalMs);
        const statsPolling = setInterval(() => fetchStatsIfNeeded(false), statsIntervalMs);

        return () => {
            cancelled = true;
            unsubscribeRealtime?.();
            clearInterval(polling);
            clearInterval(statsPolling);
        };
    }, [enabled, isVisible, pollIntervalMs, statsIntervalMs, costConfig.electricityCostPerKwh, costConfig.filamentCostPerKg]);

    return data;
}

/**
 * Klipper 출력 진행 상태 Hook
 */
export function useKlipperPrintProgress(options = {}) {
    const { enabled = true, intervalMs = 3000, costConfig = {} } = options;
    const isVisible = usePageVisibility();

    const [progress, setProgress] = useState({
        filename: '',
        progress: 0,
        printDuration: 0,
        printTime: 0,
        timeLeft: 0,
        eta: null,
        speed: 0,
        flowRate: 0,
        thumbnail: null,
        cost: { filament: 0, electricity: 0, total: 0 },
        loading: true
    });

    const currentFilenameRef = useRef('');
    const cachedThumbnailRef = useRef(null);
    const prevTimeLeftRef = useRef(0);
    const wsConnectedRef = useRef(false);
    const statusSnapshotRef = useRef({});
    const lastHttpFetchRef = useRef(0);
    const applySequenceRef = useRef(0);

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;
        const watchedObjects = [
            'print_stats',
            'display_status',
            'virtual_sdcard',
            'gcode_move',
            'motion_report'
        ];

        async function applyStatusSnapshot(statusPatch) {
            const mergedStatus = mergePrinterStatus(statusSnapshotRef.current, statusPatch);
            statusSnapshotRef.current = mergedStatus;

            const seq = ++applySequenceRef.current;
            const status = mergedStatus;
            const filename = status.print_stats?.filename || '';
            const thumbnail = await loadThumbnailIfNeeded(filename, currentFilenameRef, cachedThumbnailRef);
            if (cancelled || seq !== applySequenceRef.current) return;

            const progressValue = status.display_status?.progress || status.virtual_sdcard?.progress || 0;
            const printDuration = status.print_stats?.print_duration || status.print_stats?.total_duration || 0;
            const printState = status.print_stats?.state || 'standby';
            const stableTimeLeft = calculateStableTimeLeft({
                progressValue,
                printDuration,
                printState,
                previousTimeLeft: prevTimeLeftRef.current
            });
            prevTimeLeftRef.current = stableTimeLeft;
            const next = buildProgressFromStatus(status, thumbnail, costConfig);
            setProgress({
                ...next,
                timeLeft: stableTimeLeft,
                eta: stableTimeLeft > 0 ? new Date(Date.now() + stableTimeLeft * 1000) : null
            });
        }

        async function fetchProgress(force = false) {
            const now = Date.now();
            if (!force && wsConnectedRef.current && now - lastHttpFetchRef.current < Math.max(20000, intervalMs * 4)) {
                return;
            }
            lastHttpFetchRef.current = now;

            const result = await getPrinterObjects(watchedObjects);
            if (!result.success || !result.result?.status) {
                if (wsConnectedRef.current) return;
                prevTimeLeftRef.current = 0;
                statusSnapshotRef.current = {};
                if (!cancelled) setProgress((prev) => ({ ...prev, loading: false }));
                return;
            }

            await applyStatusSnapshot(result.result.status);
        }

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: watchedObjects,
            onConnectionChange: ({ connected }) => {
                wsConnectedRef.current = connected;
            },
            onStatusUpdate: (statusPatch) => {
                if (cancelled || !statusPatch) return;
                void applyStatusSnapshot(statusPatch);
            }
        });

        fetchProgress(true);
        const interval = setInterval(() => {
            void fetchProgress(false);
        }, intervalMs);
        return () => {
            cancelled = true;
            unsubscribeRealtime?.();
            clearInterval(interval);
        };
    }, [enabled, intervalMs, isVisible, costConfig.electricityCostPerKwh, costConfig.filamentCostPerKg]);

    return progress;
}

/**
 * Klipper 온도 정보 Hook
 */
export function useKlipperTemperature(options = {}) {
    const { enabled = true, intervalMs = 3000 } = options;
    const isVisible = usePageVisibility();
    const wsConnectedRef = useRef(false);
    const statusSnapshotRef = useRef({});
    const lastHttpFetchRef = useRef(0);

    const [temperature, setTemperature] = useState({
        extruder: { current: 0, target: 0, power: 0 },
        bed: { current: 0, target: 0, power: 0 },
        loading: true
    });

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;
        const watchedObjects = ['extruder', 'heater_bed'];

        async function applyStatusSnapshot(statusPatch) {
            const mergedStatus = mergePrinterStatus(statusSnapshotRef.current, statusPatch);
            statusSnapshotRef.current = mergedStatus;
            if (!cancelled) {
                setTemperature(buildTemperatureFromStatus(mergedStatus));
            }
        }

        async function fetchTemperature(force = false) {
            const now = Date.now();
            if (!force && wsConnectedRef.current && now - lastHttpFetchRef.current < Math.max(15000, intervalMs * 4)) {
                return;
            }
            lastHttpFetchRef.current = now;

            const result = await getPrinterObjects(watchedObjects);
            if (!result.success || !result.result?.status) {
                if (wsConnectedRef.current) return;
                statusSnapshotRef.current = {};
                if (!cancelled) setTemperature((prev) => ({ ...prev, loading: false }));
                return;
            }
            await applyStatusSnapshot(result.result.status);
        }

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: watchedObjects,
            onConnectionChange: ({ connected }) => {
                wsConnectedRef.current = connected;
            },
            onStatusUpdate: (statusPatch) => {
                if (cancelled || !statusPatch) return;
                void applyStatusSnapshot(statusPatch);
            }
        });

        fetchTemperature(true);
        const interval = setInterval(() => {
            void fetchTemperature(false);
        }, intervalMs);
        return () => {
            cancelled = true;
            unsubscribeRealtime?.();
            clearInterval(interval);
        };
    }, [enabled, intervalMs, isVisible]);

    return temperature;
}

/**
 * Klipper 시스템 정보 Hook
 */
export function useKlipperSystemInfo(options = {}) {
    const { enabled = true, intervalMs = 5000 } = options;
    const isVisible = usePageVisibility();

    const [systemInfo, setSystemInfo] = useState({
        cpu: { load: 0, temp: 0 },
        memory: { used: 0, total: 0, percent: 0 },
        loading: true
    });

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;

        async function fetchSystemInfo() {
            const result = await getSystemInfo();

            if (result.success && result.result?.system_info) {
                const info = result.result.system_info;
                const cpu = info.cpu_info || {};
                const memory = info.sd_info || info.memory || {};

                const cpuLoad = cpu.cpu_count ? (cpu.total_memory / cpu.cpu_count) : 0;

                if (!cancelled) {
                    setSystemInfo({
                        cpu: {
                            load: Math.round((cpuLoad || 0) * 100) / 100,
                            temp: Math.round(cpu.cpu_temp || 30)
                        },
                        memory: {
                            used: memory.used || 0,
                            total: memory.total || 1,
                            percent: memory.total ? Math.round((memory.used / memory.total) * 100) : 0
                        },
                        loading: false
                    });
                }
            } else if (!cancelled) {
                setSystemInfo({
                    cpu: { load: 0.5, temp: 30 },
                    memory: { used: 1.2, total: 1.8, percent: 67 },
                    loading: false
                });
            }
        }

        fetchSystemInfo();
        const interval = setInterval(fetchSystemInfo, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [enabled, intervalMs, isVisible]);

    return systemInfo;
}

/**
 * Klipper 작업 통계 Hook
 */
export function useKlipperJobStats(options = {}) {
    const { enabled = true, intervalMs = 30000 } = options;
    const isVisible = usePageVisibility();

    const [stats, setStats] = useState({
        totalPrintTime: 0,
        totalFilament: 0,
        averagePrintTime: 0,
        longestPrintTime: 0,
        totalJobs: 0,
        loading: true
    });

    useEffect(() => {
        if (!enabled || !isVisible) return;
        let cancelled = false;

        async function fetchStats() {
            const result = await getPrinterStats();
            if (!result.success || !result.result?.job_totals) {
                if (!cancelled) setStats((prev) => ({ ...prev, loading: false }));
                return;
            }

            const totals = result.result.job_totals;
            if (!cancelled) {
                setStats({
                    totalPrintTime: totals.total_time || 0,
                    totalFilament: (totals.total_filament_used || 0) / 1000,
                    averagePrintTime: totals.total_jobs > 0 ? totals.total_time / totals.total_jobs : 0,
                    longestPrintTime: totals.longest_job || 0,
                    totalJobs: totals.total_jobs || 0,
                    loading: false
                });
            }
        }

        fetchStats();
        const interval = setInterval(fetchStats, intervalMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [enabled, intervalMs, isVisible]);

    return stats;
}
