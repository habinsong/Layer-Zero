// src/api/moonrakerApi.js
import { APP_ENV } from '../config/env';

// Vite proxy를 통해 CORS 문제 해결 (vite.config.js에서 /api -> 프린터IP로 포워딩)
const MOONRAKER_BASE_URL = '/api';
const DEFAULT_MOONRAKER_PORT = '7125';
const FALLBACK_KLIPPER_IP = APP_ENV.moonrakerFallbackIp || '';

function normalizeMoonrakerBase(rawValue) {
    if (!rawValue) return null;
    let value = String(rawValue).trim();
    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) {
        value = `http://${value}`;
    }

    try {
        const url = new URL(value);
        // 포트를 입력하지 않았으면 Moonraker 기본 7125 사용
        if (!url.port) {
            url.port = DEFAULT_MOONRAKER_PORT;
        }
        // 웹 UI(8888) 주소가 들어와도 API는 Moonraker(7125)로 보정
        if (url.port === '8888') {
            url.port = DEFAULT_MOONRAKER_PORT;
        }
        // path는 origin만 사용 (settings에 / 같은 경로가 들어와도 API는 루트 기준)
        return url.origin;
    } catch {
        return null;
    }
}

function getMoonrakerCandidates() {
    const candidates = [];
    if (typeof window !== 'undefined') {
        const savedIp = localStorage.getItem('klipper-ip');
        const configuredBase = normalizeMoonrakerBase(savedIp);
        if (configuredBase) {
            candidates.push(configuredBase);
        } else {
            const fallbackBase = normalizeMoonrakerBase(FALLBACK_KLIPPER_IP);
            if (fallbackBase) candidates.push(fallbackBase);
        }
    }
    candidates.push(MOONRAKER_BASE_URL);
    return [...new Set(candidates)];
}

export function getPreferredMoonrakerBase() {
    const candidates = getMoonrakerCandidates();
    return candidates[0] || MOONRAKER_BASE_URL;
}

function toMoonrakerWebSocketUrl(baseUrl) {
    try {
        const resolved = /^https?:\/\//i.test(baseUrl)
            ? new URL(baseUrl)
            : new URL(baseUrl, window.location.origin);
        resolved.protocol = resolved.protocol === 'https:' ? 'wss:' : 'ws:';
        const normalizedPath = resolved.pathname.replace(/\/$/, '');
        resolved.pathname = `${normalizedPath}/websocket`;
        resolved.search = '';
        resolved.hash = '';
        return resolved.toString();
    } catch {
        return null;
    }
}

async function uploadMoonraker(endpoint, formData) {
    const candidates = getMoonrakerCandidates();
    let lastError = null;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                lastError = new Error(`HTTP error! status: ${response.status}`);
                continue;
            }

            const data = await response.json();
            return { success: true, result: data.result ?? data, baseUrl };
        } catch (error) {
            lastError = error;
        }
    }

    console.error(`Moonraker Upload Error [POST ${endpoint}]:`, lastError);
    return { success: false, error: lastError?.message || 'Unknown error' };
}

/**
 * [공통] Moonraker API 요청 헬퍼 함수
 * @param {string} endpoint - API 엔드포인트 (예: '/printer/info')
 * @param {string} method - 'GET' | 'POST' (기본값: 'GET')
 * @param {object} body - 전송할 데이터 본문 (POST 요청 시 사용)
 */
async function fetchMoonraker(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const candidates = getMoonrakerCandidates();
    let lastError = null;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, options);
            if (!response.ok) {
                lastError = new Error(`HTTP error! status: ${response.status}`);
                continue;
            }

            const data = await response.json();
            return { success: true, result: data.result, baseUrl };
        } catch (error) {
            lastError = error;
        }
    }

    console.error(`Moonraker API Error [${method} ${endpoint}]:`, lastError);
    return { success: false, error: lastError?.message || 'Unknown error' };
}

async function fetchMoonrakerText(endpoint, headers = {}) {
    const candidates = getMoonrakerCandidates();
    let lastError = null;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: 'GET',
                headers
            });
            if (!response.ok) {
                lastError = new Error(`HTTP error! status: ${response.status}`);
                continue;
            }
            const text = await response.text();
            return { success: true, text, baseUrl };
        } catch (error) {
            lastError = error;
        }
    }

    console.error(`Moonraker Text API Error [GET ${endpoint}]:`, lastError);
    return { success: false, error: lastError?.message || 'Unknown error' };
}

/* ==========================================================================
   1. 데이터 조회 (Monitoring & Info)
   ========================================================================== */

/**
 * 서버 정보 가져오기 (온라인 상태 확인용)
 */
export async function getServerInfo() {
    return fetchMoonraker('/server/info');
}

/**
 * 시스템 정보 가져오기 (CPU, Memory 사용량 등)
 */
export async function getSystemInfo() {
    return fetchMoonraker('/machine/system_info');
}

/**
 * 프린터 상태 객체 가져오기 (핵심 폴링 함수)
 * 홈 화면과 대시보드에서 2초마다 호출하세요.
 * * @param {string[]} objects - 가져올 객체 목록
 */
export async function getPrinterObjects(objects = [
    'print_stats',      // 출력 상태 (printing, paused, etc)
    'display_status',   // 진행률 (progress)
    'virtual_sdcard',   // 파일 진행 상황
    'heater_bed',       // 베드 온도
    'extruder',         // 노즐 온도
    'fan',              // 팬 속도
    'toolhead',         // 헤드 위치 (X, Y, Z)
    'gcode_move'        // 속도 및 유량
]) {
    // 쿼리 스트링 생성 (예: ?print_stats&heater_bed&...)
    const queryString = objects.join('&');
    return fetchMoonraker(`/printer/objects/query?${queryString}`);
}

/**
 * 현재 작업 중인 파일의 메타데이터 가져오기 (썸네일, 레이어 정보 등)
 */
export async function getCurrentJob() {
    // 현재 선택된 파일의 정보를 가져옴
    return fetchMoonraker('/server/files/metadata?filename=');
}

/**
 * 과거 작업 내역 통계 가져오기 (히스토리)
 */
export async function getJobHistory(limit = 50) {
    return fetchMoonraker(`/server/history/list?limit=${limit}`);
}

/**
 * 프린터 누적 통계 가져오기 (총 출력 시간, 필라멘트 사용량 - 유지보수용)
 */
export async function getPrinterStats() {
    return fetchMoonraker('/server/history/totals');
}

/**
 * G-code 파일 목록 가져오기
 * @param {string} root - 루트 디렉토리 (기본값: 'gcodes')
 */
export async function getGcodeFiles(root = 'gcodes') {
    return fetchMoonraker(`/server/files/list?root=${root}`);
}

/**
 * 파일 메타데이터 가져오기 (썸네일 포함)
 * @param {string} filename - 파일명 (예: "cube.gcode")
 */
export async function getFileMetadata(filename) {
    return fetchMoonraker(`/server/files/metadata?filename=${encodeURIComponent(filename)}`);
}

export async function getGcodeTextPreview(filename, bytes = 400000) {
    if (!filename) return { success: false, error: 'invalid filename' };
    const safePath = String(filename)
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
    return fetchMoonrakerText(`/server/files/gcodes/${safePath}`, {
        Range: `bytes=0-${Math.max(1024, Number(bytes) || 400000)}`
    });
}

/**
 * 온도 그래프용 데이터 가져오기
 */
export async function getTemperatureStore() {
    return fetchMoonraker('/server/temperature_store');
}

/**
 * 웹캠 목록 가져오기 (설정 페이지용)
 */
export async function getWebcams() {
    return fetchMoonraker('/server/webcams/list');
}

/**
 * G-code 파일 업로드
 * @param {File} file - 업로드할 gcode 파일
 * @param {string} root - 업로드 루트 디렉토리
 */
export async function uploadGcodeFile(file, root = 'gcodes') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('root', root);
    return uploadMoonraker('/server/files/upload', formData);
}

/* ==========================================================================
   2. 프린터 제어 (Control & Action) - [NEW]
   ========================================================================== */

/**
 * G-Code 명령 전송 (가장 강력한 제어 함수)
 * 예: sendGcode("G28") -> 홈 잡기
 * 예: sendGcode("M104 S200") -> 노즐 200도 설정
 * * @param {string} script - 실행할 G-code 문자열
 */
export async function sendGcode(script) {
    return fetchMoonraker('/printer/gcode/script', 'POST', { script });
}

/**
 * 출력 일시정지 (Pause) - AI 감지 시 자동 호출용
 */
export async function pausePrint() {
    return fetchMoonraker('/printer/print/pause', 'POST');
}

/**
 * 출력 재개 (Resume)
 */
export async function resumePrint() {
    return fetchMoonraker('/printer/print/resume', 'POST');
}

/**
 * 출력 취소 (Cancel)
 */
export async function cancelPrint() {
    return fetchMoonraker('/printer/print/cancel', 'POST');
}

/**
 * 특정 파일 출력 시작
 * * @param {string} filename - 파일 경로 (예: "gcodes/calibration_cube.gcode")
 */
export async function startPrint(filename) {
    return fetchMoonraker(`/printer/print/start`, 'POST', { filename });
}

/* ==========================================================================
   3. 시스템 제어 (System Control)
   ========================================================================== */

/**
 * 긴급 정지 (Emergency Stop) - 하드웨어 즉시 차단
 * !비상 상황에서만 사용하세요!
 */
export async function emergencyStop() {
    return fetchMoonraker('/printer/emergency_stop', 'POST');
}

/**
 * 펌웨어 재시작 (Firmware Restart) - 오류 발생 후 복구 시 사용
 */
export async function firmwareRestart() {
    return fetchMoonraker('/printer/firmware_restart', 'POST');
}

/**
 * 호스트(라즈베리파이/안드로이드) 재부팅
 */
export async function hostReboot() {
    return fetchMoonraker('/machine/reboot', 'POST');
}

/**
 * G-code 매크로 목록 조회
 * @returns {Promise<Array<string>>} 매크로 이름 배열
 */
export async function getGcodeMacroList() {
    // 1. 전체 객체 목록 조회
    const response = await fetchMoonraker('/printer/objects/list');
    if (response.success && response.result?.objects) {
        // 2. 'gcode_macro ' 로 시작하는 객체 필터링 및 이름 추출
        const macros = response.result.objects
            .filter(obj => obj.startsWith('gcode_macro '))
            .map(obj => obj.replace('gcode_macro ', ''));
        return { success: true, result: macros };
    }
    return { success: false, error: 'Failed to fetch object list' };
}

/**
 * Z-Offset 베이비스텝 조절 (Baby-stepping)
 * @param {number} offset - 조절할 값 (예: 0.05, -0.05)
 */
export async function setZOffset(offset) {
    // SET_GCODE_OFFSET Z_ADJUST={offset} MOVE=1
    return sendGcode(`SET_GCODE_OFFSET Z_ADJUST=${offset} MOVE=1`);
}

/**
 * 호스트 종료 (Shutdown)
 */
export async function hostShutdown() {
    return fetchMoonraker('/machine/shutdown', 'POST');
}

/**
 * 출력 상태 리셋 (완료 후 대기 상태로 복귀)
 */
export async function resetPrintState() {
    return sendGcode('SDCARD_RESET_FILE');
}

let moonrakerRealtimeHub = null;
let moonrakerRealtimeSubscriberSeq = 1;

function normalizeRealtimeObjectMap(objects) {
    if (Array.isArray(objects)) {
        return Object.fromEntries(objects.map((name) => [name, null]));
    }
    if (objects && typeof objects === 'object') {
        return { ...objects };
    }
    return {};
}

function buildMergedObjectMap(subscribers) {
    const merged = {};
    subscribers.forEach((subscriber) => {
        Object.entries(subscriber.objectMap || {}).forEach(([key, value]) => {
            merged[key] = value ?? null;
        });
    });
    return merged;
}

function objectMapEquals(a = {}, b = {}) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i += 1) {
        if (aKeys[i] !== bKeys[i]) return false;
        const key = aKeys[i];
        const aVal = a[key] ?? null;
        const bVal = b[key] ?? null;
        if (JSON.stringify(aVal) !== JSON.stringify(bVal)) return false;
    }
    return true;
}

function createMoonrakerRealtimeHub() {
    const subscribers = new Map();
    const candidates = getMoonrakerCandidates()
        .map((baseUrl) => toMoonrakerWebSocketUrl(baseUrl))
        .filter(Boolean);

    if (candidates.length === 0) {
        return null;
    }

    let socket = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let watchdogTimer = null;
    let forceReconnectTimer = null;
    let attempt = 0;
    let candidateIndex = 0;
    let requestId = 1;
    let lastActivityAt = 0;
    let skipNextCloseReconnect = false;
    let reconnecting = false;
    let destroyed = false;
    let connected = false;
    let activeUrl = '';
    let mergedObjectMap = {};

    const clearReconnect = () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    const clearHeartbeat = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    const clearWatchdog = () => {
        if (watchdogTimer) {
            clearInterval(watchdogTimer);
            watchdogTimer = null;
        }
    };

    const clearForceReconnect = () => {
        if (forceReconnectTimer) {
            clearTimeout(forceReconnectTimer);
            forceReconnectTimer = null;
        }
    };

    const notifyConnection = (payload) => {
        connected = !!payload?.connected;
        activeUrl = payload?.url || activeUrl;
        subscribers.forEach((subscriber) => {
            subscriber.onConnectionChange?.({
                connected: connected,
                url: activeUrl
            });
        });
    };

    const notifyStatus = (status, meta) => {
        subscribers.forEach((subscriber) => {
            subscriber.onStatusUpdate?.(status, meta);
        });
    };

    const notifyGeneric = (method, params, raw) => {
        subscribers.forEach((subscriber) => {
            subscriber.onNotify?.(method, params, raw);
        });
    };

    const notifyError = (error) => {
        subscribers.forEach((subscriber) => {
            subscriber.onError?.(error);
        });
    };

    const sendSubscribePayload = () => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'printer.objects.subscribe',
            params: { objects: mergedObjectMap },
            id: requestId++
        }));
    };

    const refreshMergedObjects = () => {
        const nextObjectMap = buildMergedObjectMap(subscribers);
        if (objectMapEquals(mergedObjectMap, nextObjectMap)) return;
        mergedObjectMap = nextObjectMap;
        sendSubscribePayload();
    };

    const scheduleReconnect = () => {
        if (destroyed || subscribers.size === 0) return;
        clearReconnect();
        const delay = Math.min(10000, 800 * (2 ** Math.min(attempt, 4)));
        reconnectTimer = setTimeout(() => {
            candidateIndex = (candidateIndex + 1) % candidates.length;
            connect();
        }, delay);
    };

    const connect = () => {
        if (destroyed || subscribers.size === 0) return;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = candidates[candidateIndex];
        if (!wsUrl) return;
        clearReconnect();
        attempt += 1;

        try {
            socket = new WebSocket(wsUrl);
        } catch (error) {
            notifyError(error);
            scheduleReconnect();
            return;
        }

        socket.onopen = () => {
            clearForceReconnect();
            reconnecting = false;
            attempt = 0;
            lastActivityAt = Date.now();
            notifyConnection({ connected: true, url: wsUrl });
            sendSubscribePayload();
            startHeartbeat();
            startWatchdog();
        };

        socket.onmessage = (event) => {
            lastActivityAt = Date.now();
            let message = null;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }

            if (message?.method) {
                notifyGeneric(message.method, message.params, message);
            }

            if (message?.result?.status) {
                notifyStatus(message.result.status, { source: 'snapshot' });
                return;
            }

            if (message?.method === 'notify_status_update') {
                const [status] = Array.isArray(message.params) ? message.params : [];
                if (status && typeof status === 'object') {
                    notifyStatus(status, { source: 'delta' });
                }
            }
        };

        socket.onerror = (event) => {
            notifyError(event instanceof Error ? event : new Error('Moonraker WebSocket error.'));
        };

        socket.onclose = () => {
            clearForceReconnect();
            clearHeartbeat();
            clearWatchdog();
            notifyConnection({ connected: false, url: wsUrl });
            socket = null;

            if (skipNextCloseReconnect) {
                skipNextCloseReconnect = false;
                reconnecting = false;
                connect();
                return;
            }
            reconnecting = false;
            scheduleReconnect();
        };
    };

    const forceReconnect = () => {
        if (destroyed || subscribers.size === 0) return;
        if (reconnecting) return;
        reconnecting = true;
        notifyConnection({ connected: false, url: activeUrl });
        clearHeartbeat();
        clearWatchdog();
        clearReconnect();
        clearForceReconnect();

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            const staleSocket = socket;
            skipNextCloseReconnect = true;
            try {
                staleSocket.close(4000, 'force-reconnect');
            } catch {
                // ignore
            }

            forceReconnectTimer = setTimeout(() => {
                if (destroyed || subscribers.size === 0) return;
                if (socket === staleSocket) {
                    try {
                        staleSocket.onopen = null;
                        staleSocket.onmessage = null;
                        staleSocket.onerror = null;
                        staleSocket.onclose = null;
                    } catch {
                        // ignore
                    }
                    socket = null;
                    skipNextCloseReconnect = false;
                    reconnecting = false;
                    connect();
                }
            }, 1800);
            return;
        }

        reconnecting = false;
        connect();
    };

    const startHeartbeat = () => {
        clearHeartbeat();
        heartbeatTimer = setInterval(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            try {
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'server.info',
                    params: {},
                    id: requestId++
                }));
            } catch {
                forceReconnect();
            }
        }, 10000);
    };

    const startWatchdog = () => {
        clearWatchdog();
        watchdogTimer = setInterval(() => {
            if (destroyed || !socket || socket.readyState !== WebSocket.OPEN) return;
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            if (Date.now() - lastActivityAt > 25000) {
                forceReconnect();
            }
        }, 5000);
    };

    const handleVisibilityChange = () => {
        if (destroyed || subscribers.size === 0) return;
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
        const stale = Date.now() - lastActivityAt > 12000;
        if (!socket || socket.readyState !== WebSocket.OPEN || stale) {
            forceReconnect();
        }
    };

    const handleOnline = () => {
        if (destroyed || subscribers.size === 0) return;
        forceReconnect();
    };

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    window.addEventListener('pageshow', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    const destroy = () => {
        destroyed = true;
        clearReconnect();
        clearHeartbeat();
        clearWatchdog();
        clearForceReconnect();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        window.removeEventListener('pageshow', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close(1000, 'unsubscribe');
        } else if (socket) {
            socket.close();
        }
        socket = null;
        subscribers.clear();
    };

    const addSubscriber = (subscriber) => {
        subscribers.set(subscriber.id, subscriber);
        refreshMergedObjects();

        subscriber.onConnectionChange?.({
            connected,
            url: activeUrl
        });

        if (!connected) {
            connect();
        } else {
            sendSubscribePayload();
        }
    };

    const removeSubscriber = (subscriberId) => {
        subscribers.delete(subscriberId);
        refreshMergedObjects();
        if (subscribers.size === 0) {
            destroy();
            moonrakerRealtimeHub = null;
        } else {
            sendSubscribePayload();
        }
    };

    return {
        addSubscriber,
        removeSubscriber
    };
}

/**
 * Moonraker WebSocket 실시간 객체 구독
 * - 전역 싱글톤 연결 1개를 여러 훅에서 공유
 * - subscriber별 콜백만 분기, WS 연결은 멀티플렉싱
 * - 반환값: unsubscribe 함수
 */
export function subscribePrinterObjectsRealtime({
    objects = [],
    onStatusUpdate,
    onConnectionChange,
    onError,
    onNotify
} = {}) {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        return () => {};
    }

    if (!moonrakerRealtimeHub) {
        moonrakerRealtimeHub = createMoonrakerRealtimeHub();
    }
    if (!moonrakerRealtimeHub) {
        onError?.(new Error('No Moonraker WebSocket candidates available.'));
        return () => {};
    }

    const subscriberId = moonrakerRealtimeSubscriberSeq++;
    moonrakerRealtimeHub.addSubscriber({
        id: subscriberId,
        objectMap: normalizeRealtimeObjectMap(objects),
        onStatusUpdate,
        onConnectionChange,
        onError,
        onNotify
    });

    return () => {
        if (!moonrakerRealtimeHub) {
            return;
        }
        moonrakerRealtimeHub.removeSubscriber(subscriberId);
    };
}
