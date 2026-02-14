import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Settings as SettingsIcon,
    Monitor,
    Palette,
    Save,
    Check,
    Sun,
    Moon,
    KeyRound,
    Bell,
    Gauge,
    ShieldCheck,
    RotateCcw,
    Download,
    Upload,
    Link2,
    Camera,
    Cpu,
    SlidersHorizontal,
    Zap,
    RefreshCw,
    MapPin
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';
import { requestNotificationPermission, getNotificationPermission } from '../utils/notificationManager';

const PROFILE_KEY = 'layer-zero-connection-profiles-v1';
const VALID_ROTATIONS = [0, 90, 180, 270];
const KOREA_CITY_PRESETS = [
    { id: 'kr-seoul', name: '서울시', admin1: '서울특별시', country: '대한민국', latitude: 37.5665, longitude: 126.9780 },
    { id: 'kr-busan', name: '부산시', admin1: '부산광역시', country: '대한민국', latitude: 35.1796, longitude: 129.0756 },
    { id: 'kr-incheon', name: '인천시', admin1: '인천광역시', country: '대한민국', latitude: 37.4563, longitude: 126.7052 },
    { id: 'kr-daegu', name: '대구시', admin1: '대구광역시', country: '대한민국', latitude: 35.8714, longitude: 128.6014 },
    { id: 'kr-daejeon', name: '대전시', admin1: '대전광역시', country: '대한민국', latitude: 36.3504, longitude: 127.3845 },
    { id: 'kr-gwangju', name: '광주시', admin1: '광주광역시', country: '대한민국', latitude: 35.1595, longitude: 126.8526 },
    { id: 'kr-ulsan', name: '울산시', admin1: '울산광역시', country: '대한민국', latitude: 35.5384, longitude: 129.3114 },
    { id: 'kr-suwon', name: '수원시', admin1: '경기도', country: '대한민국', latitude: 37.2636, longitude: 127.0286 },
    { id: 'kr-seongnam', name: '성남시', admin1: '경기도', country: '대한민국', latitude: 37.4449, longitude: 127.1389 },
    { id: 'kr-goyang', name: '고양시', admin1: '경기도', country: '대한민국', latitude: 37.6584, longitude: 126.8320 },
    { id: 'kr-yongin', name: '용인시', admin1: '경기도', country: '대한민국', latitude: 37.2411, longitude: 127.1776 },
    { id: 'kr-cheonan', name: '천안시', admin1: '충청남도', country: '대한민국', latitude: 36.8151, longitude: 127.1139 },
    { id: 'kr-cheongju', name: '청주시', admin1: '충청북도', country: '대한민국', latitude: 36.6424, longitude: 127.4890 },
    { id: 'kr-hwaseong', name: '화성시', admin1: '경기도', country: '대한민국', latitude: 37.2068, longitude: 126.8169 },
    { id: 'kr-gyeongju', name: '경주시', admin1: '경상북도', country: '대한민국', latitude: 35.8428, longitude: 129.2117 },
    { id: 'kr-jeonju', name: '전주시', admin1: '전라북도', country: '대한민국', latitude: 35.8242, longitude: 127.1480 },
    { id: 'kr-gangneung', name: '강릉시', admin1: '강원특별자치도', country: '대한민국', latitude: 37.7519, longitude: 128.8761 },
    { id: 'kr-jeju', name: '제주시', admin1: '제주특별자치도', country: '대한민국', latitude: 33.4996, longitude: 126.5312 }
];

function buildKoreanWeatherQueries(keyword = '') {
    const trimmed = String(keyword).trim();
    if (!trimmed) return [];
    const compact = trimmed.replace(/\s+/g, '');
    const noSuffix = compact.replace(/(특별시|광역시|특별자치시|특별자치도|도|시|군|구)$/u, '');
    const candidates = [
        trimmed,
        compact,
        noSuffix,
        noSuffix ? `${noSuffix}시` : ''
    ].filter(Boolean);
    return Array.from(new Set(candidates));
}

function normalizeMoonrakerBase(rawValue) {
    if (!rawValue) return null;
    let value = String(rawValue).trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`;

    try {
        const url = new URL(value);
        if (!url.port) url.port = '7125';
        if (url.port === '8888') url.port = '7125';
        return url.origin;
    } catch {
        return null;
    }
}

function normalizeWebcamCaptureUrl(rawUrl) {
    if (!rawUrl) return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.includes('/capture_flash')) return trimmed.split('?')[0];
    return `${trimmed.replace(/\/$/, '')}/capture_flash`;
}

const SettingsPage = () => {
    const { theme, toggleTheme } = useTheme();
    const { settings, updateSettings, resetSettings, defaultSettings } = useSettings();

    const [formState, setFormState] = useState(settings);
    const [showSaved, setShowSaved] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [connectionProfiles, setConnectionProfiles] = useState(() => {
        try {
            const raw = localStorage.getItem(PROFILE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });
    const [newProfileName, setNewProfileName] = useState('');
    const [testResult, setTestResult] = useState({ moonraker: '', webcam: '', webcam2: '' });
    const [isTesting, setIsTesting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [weatherSearchLoading, setWeatherSearchLoading] = useState(false);
    const [weatherSearchResults, setWeatherSearchResults] = useState([]);
    const [weatherSearchError, setWeatherSearchError] = useState('');
    const importRef = useRef(null);
    const weatherAbortRef = useRef(null);
    const skipNextWeatherSearchRef = useRef(false);

    useEffect(() => {
        setFormState(settings);
    }, [settings]);

    useEffect(() => {
        setNotificationPermission(getNotificationPermission());
    }, []);

    useEffect(() => {
        if (skipNextWeatherSearchRef.current) {
            skipNextWeatherSearchRef.current = false;
            return undefined;
        }

        const keyword = String(formState.weatherCity || '').trim();
        const isHangul = /[가-힣]/.test(keyword);
        const minLen = isHangul ? 1 : 2;
        if (keyword.length < minLen) {
            setWeatherSearchResults([]);
            setWeatherSearchError('');
            setWeatherSearchLoading(false);
            if (weatherAbortRef.current) {
                weatherAbortRef.current.abort();
                weatherAbortRef.current = null;
            }
            return;
        }

        const timer = setTimeout(async () => {
            try {
                if (weatherAbortRef.current) weatherAbortRef.current.abort();
                const controller = new AbortController();
                weatherAbortRef.current = controller;
                setWeatherSearchLoading(true);
                setWeatherSearchError('');

                const queries = buildKoreanWeatherQueries(keyword);
                const apiResults = await Promise.allSettled(
                    queries.map(async (q) => {
                        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=60&language=ko&countryCode=KR&format=json`;
                        const response = await fetch(url, { signal: controller.signal });
                        if (!response.ok) throw new Error(`검색 실패 (${response.status})`);
                        const data = await response.json();
                        return Array.isArray(data?.results) ? data.results : [];
                    })
                );
                const apiItems = apiResults
                    .filter((entry) => entry.status === 'fulfilled')
                    .flatMap((entry) => entry.value)
                    .filter((item) => String(item?.country_code || '').toUpperCase() === 'KR');
                const presetItems = KOREA_CITY_PRESETS.filter((item) => {
                    const haystack = `${item.name} ${item.admin1} ${item.country}`.toLowerCase();
                    return haystack.includes(keyword.toLowerCase());
                });

                const dedup = new Map();
                [...presetItems, ...apiItems].forEach((item) => {
                    if (!item || !Number.isFinite(Number(item.latitude)) || !Number.isFinite(Number(item.longitude))) return;
                    const key = `${item.name}-${item.latitude}-${item.longitude}`;
                    if (!dedup.has(key)) dedup.set(key, item);
                });

                setWeatherSearchResults(Array.from(dedup.values()).slice(0, 30));
            } catch (error) {
                if (error?.name === 'AbortError') return;
                const presetItems = KOREA_CITY_PRESETS.filter((item) => {
                    const haystack = `${item.name} ${item.admin1} ${item.country}`.toLowerCase();
                    return haystack.includes(String(formState.weatherCity || '').toLowerCase());
                });
                setWeatherSearchError(error?.message || '도시 검색 실패');
                setWeatherSearchResults(presetItems);
            } finally {
                setWeatherSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [formState.weatherCity]);

    useEffect(() => () => {
        if (weatherAbortRef.current) weatherAbortRef.current.abort();
    }, []);

    const handleChange = (key, value) => {
        setFormState((prev) => ({ ...prev, [key]: value }));
    };

    const selectWeatherLocation = (item) => {
        skipNextWeatherSearchRef.current = true;
        const cityLabel = [item?.name, item?.admin1, item?.country].filter(Boolean).join(', ');
        setFormState((prev) => ({
            ...prev,
            weatherCity: cityLabel || item?.name || prev.weatherCity,
            weatherLat: Number(item?.latitude ?? prev.weatherLat),
            weatherLon: Number(item?.longitude ?? prev.weatherLon)
        }));
        setWeatherSearchResults([]);
        setWeatherSearchError('');
    };

    const handleSaveAll = () => {
        const normalized = {
            ...formState,
            dashboardPollMs: Math.max(1000, Number(formState.dashboardPollMs) || 5000),
            dashboardStatsPollMs: Math.max(10000, Number(formState.dashboardStatsPollMs) || 60000),
            filamentCostPerKg: Math.max(0, Number(formState.filamentCostPerKg) || 18000),
            electricityCostPerKwh: Math.max(0, Number(formState.electricityCostPerKwh) || 200),
            webcamDefaultRotation: VALID_ROTATIONS.includes(Number(formState.webcamDefaultRotation))
                ? Number(formState.webcamDefaultRotation)
                : 90
        };

        updateSettings(normalized);

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('printerNameChanged'));
        window.dispatchEvent(new Event('settingsChanged'));

        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1800);
    };

    const handleRequestNotification = async () => {
        const granted = await requestNotificationPermission();
        setNotificationPermission(granted ? 'granted' : 'denied');
    };

    const persistProfiles = (profiles) => {
        setConnectionProfiles(profiles);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    };

    const saveCurrentAsProfile = () => {
        const name = newProfileName.trim();
        if (!name) return;

        const profile = {
            id: `${Date.now()}-${Math.random()}`,
            name,
            printerName: formState.printerName || '',
            klipperIp: formState.klipperIp || '',
            webcamUrl: formState.webcamUrl || '',
            webcamUrl2: formState.webcamUrl2 || ''
        };

        const next = [profile, ...connectionProfiles].slice(0, 10);
        persistProfiles(next);
        setNewProfileName('');
    };

    const applyProfile = (profile) => {
        setFormState((prev) => ({
            ...prev,
            printerName: profile.printerName || prev.printerName,
            klipperIp: profile.klipperIp || prev.klipperIp,
            webcamUrl: profile.webcamUrl || prev.webcamUrl,
            webcamUrl2: profile.webcamUrl2 || prev.webcamUrl2
        }));
    };

    const removeProfile = (id) => {
        persistProfiles(connectionProfiles.filter((p) => p.id !== id));
    };

    const testConnections = async () => {
        setIsTesting(true);
        setTestResult({ moonraker: '테스트 중...', webcam: '테스트 중...', webcam2: '테스트 중...' });

        try {
            const moonrakerBase = normalizeMoonrakerBase(formState.klipperIp);
            if (!moonrakerBase) {
                setTestResult((prev) => ({ ...prev, moonraker: '주소 형식 오류' }));
            } else {
                const response = await fetch(`${moonrakerBase}/server/info`, { method: 'GET' });
                setTestResult((prev) => ({ ...prev, moonraker: response.ok ? '연결 성공' : `실패 (${response.status})` }));
            }
        } catch (error) {
            setTestResult((prev) => ({ ...prev, moonraker: `오류: ${error.message}` }));
        }

        try {
            const webcamUrl = normalizeWebcamCaptureUrl(formState.webcamUrl);
            if (!webcamUrl) {
                setTestResult((prev) => ({ ...prev, webcam: '주소 형식 오류' }));
            } else {
                const response = await fetch(`${webcamUrl}?t=${Date.now()}`, { method: 'GET' });
                setTestResult((prev) => ({ ...prev, webcam: response.ok ? '연결 성공' : `실패 (${response.status})` }));
            }
        } catch (error) {
            setTestResult((prev) => ({ ...prev, webcam: `오류: ${error.message}` }));
        }

        try {
            const webcamUrl2 = normalizeWebcamCaptureUrl(formState.webcamUrl2);
            if (!webcamUrl2) {
                setTestResult((prev) => ({ ...prev, webcam2: '미설정' }));
            } else {
                const response = await fetch(`${webcamUrl2}?t=${Date.now()}`, { method: 'GET' });
                setTestResult((prev) => ({ ...prev, webcam2: response.ok ? '연결 성공' : `실패 (${response.status})` }));
            }
        } catch (error) {
            setTestResult((prev) => ({ ...prev, webcam2: `오류: ${error.message}` }));
        }

        setIsTesting(false);
    };

    const exportSettings = async () => {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings: {
                ...formState,
                aiFreeApiKey: '',
                aiPaidApiKey: ''
            },
            profiles: connectionProfiles
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `layer-zero-settings-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const onImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const imported = parsed?.settings;
            if (!imported || typeof imported !== 'object') throw new Error('잘못된 설정 파일 형식');

            setFormState((prev) => ({
                ...prev,
                ...imported,
                aiFreeApiKey: prev.aiFreeApiKey,
                aiPaidApiKey: prev.aiPaidApiKey
            }));

            if (Array.isArray(parsed.profiles)) {
                persistProfiles(parsed.profiles.slice(0, 10));
            }
        } catch (error) {
            alert(`설정 불러오기 실패: ${error.message}`);
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    const resetAllSettings = () => {
        const ok = confirm('설정을 기본값으로 초기화할까요?');
        if (!ok) return;
        resetSettings();
        setFormState(defaultSettings);
    };

    const changedCount = useMemo(() => {
        const keys = Object.keys(defaultSettings);
        return keys.filter((key) => {
            if (key === 'aiFreeApiKey' || key === 'aiPaidApiKey') return false;
            return String(formState[key]) !== String(settings[key]);
        }).length;
    }, [defaultSettings, formState, settings]);

    return (
        <div className="w-full space-y-6 animate-fade-in px-3 md:px-4 pb-4">
            <header className="premium-card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 animate-glow-pulse">
                            <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black gradient-primary gradient-text">설정 센터</h1>
                            <p className="text-sm md:text-base text-slate-500 mt-1">연결/성능/알림/보안을 한 번에 관리</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={cn('px-3 py-2 rounded-lg text-xs border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                            변경 {changedCount}개
                        </div>
                        <button
                            onClick={handleSaveAll}
                            className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl transition-all text-sm md:text-base font-black flex items-center gap-2 shadow-lg"
                        >
                            {showSaved ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : <Save className="w-4 h-4 md:w-5 md:h-5" />}
                            {showSaved ? '저장됨' : '저장'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <section className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-5">
                        <Monitor className="w-6 h-6 text-blue-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">프린터 연결</h3>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="text"
                            value={formState.printerName || ''}
                            onChange={(e) => handleChange('printerName', e.target.value)}
                            placeholder="프린터 이름"
                            className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <input
                            type="text"
                            value={formState.klipperIp || ''}
                            onChange={(e) => handleChange('klipperIp', e.target.value)}
                            placeholder="Moonraker 주소 (예: 192.168.0.10:7125)"
                            className={cn('w-full px-4 py-3 rounded-xl border font-mono', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <input
                            type="text"
                            value={formState.webcamUrl || ''}
                            onChange={(e) => handleChange('webcamUrl', e.target.value)}
                            placeholder="웹캠 1 주소 (예: http://192.168.0.20/capture_flash)"
                            className={cn('w-full px-4 py-3 rounded-xl border font-mono text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <input
                            type="text"
                            value={formState.webcamUrl2 || ''}
                            onChange={(e) => handleChange('webcamUrl2', e.target.value)}
                            placeholder="웹캠 2 주소 (선택)"
                            className={cn('w-full px-4 py-3 rounded-xl border font-mono text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="text-xs font-bold text-slate-500 mb-2">날씨 위치 (기본: 서울시)</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="relative md:col-span-1">
                                    <input
                                        type="text"
                                        value={formState.weatherCity || ''}
                                        onChange={(e) => handleChange('weatherCity', e.target.value)}
                                        placeholder="도시명 검색 (예: 서울시, 천안시)"
                                        className={cn('w-full px-3 py-2 rounded-lg border text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                                    />
                                    {(weatherSearchLoading || weatherSearchResults.length > 0 || weatherSearchError) && (
                                        <div className={cn(
                                            'absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-lg border shadow-xl overflow-hidden',
                                            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                                        )}>
                                            {weatherSearchLoading && (
                                                <div className="px-3 py-2 text-xs text-slate-500">도시 검색 중...</div>
                                            )}
                                            {!weatherSearchLoading && weatherSearchError && (
                                                <div className="px-3 py-2 text-xs text-rose-500">{weatherSearchError}</div>
                                            )}
                                            {!weatherSearchLoading && !weatherSearchError && weatherSearchResults.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-slate-500">검색 결과 없음</div>
                                            )}
                                            {!weatherSearchLoading && weatherSearchResults.map((item) => (
                                                <button
                                                    key={`${item.id}-${item.latitude}-${item.longitude}`}
                                                    type="button"
                                                    onClick={() => selectWeatherLocation(item)}
                                                    className={cn(
                                                        'w-full px-3 py-2 text-left border-t first:border-t-0 transition-colors',
                                                        theme === 'dark'
                                                            ? 'border-slate-800 hover:bg-slate-800'
                                                            : 'border-slate-100 hover:bg-slate-50'
                                                    )}
                                                >
                                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {[item.admin1, item.country].filter(Boolean).join(', ')} · {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formState.weatherLat ?? 37.5665}
                                    onChange={(e) => handleChange('weatherLat', Number(e.target.value))}
                                    placeholder="위도"
                                    className={cn('px-3 py-2 rounded-lg border text-sm font-mono', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                                />
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={formState.weatherLon ?? 126.9780}
                                    onChange={(e) => handleChange('weatherLon', Number(e.target.value))}
                                    placeholder="경도"
                                    className={cn('px-3 py-2 rounded-lg border text-sm font-mono', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">저장 후 홈 탭 날씨 카드에 바로 반영됩니다.</p>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <button
                            onClick={testConnections}
                            disabled={isTesting}
                            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60"
                        >
                            <Link2 className="w-4 h-4" /> 연결 테스트
                        </button>
                        <div className="text-xs text-slate-500">Moonraker: {testResult.moonraker || '-'} / Webcam1: {testResult.webcam || '-'} / Webcam2: {testResult.webcam2 || '-'}</div>
                    </div>
                </section>

                <section className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-5">
                        <Cpu className="w-6 h-6 text-indigo-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">성능 & 폴링</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-400">대시보드 폴링(ms)</label>
                            <input
                                type="number"
                                min="1000"
                                step="500"
                                value={formState.dashboardPollMs ?? 5000}
                                onChange={(e) => handleChange('dashboardPollMs', Number(e.target.value))}
                                className={cn('mt-1 w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                            />
                            <p className="text-xs text-slate-500 mt-1">권장: 5000~10000 (WS 연결 시 fallback용)</p>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-400">통계 갱신(ms)</label>
                            <input
                                type="number"
                                min="10000"
                                step="5000"
                                value={formState.dashboardStatsPollMs ?? 60000}
                                onChange={(e) => handleChange('dashboardStatsPollMs', Number(e.target.value))}
                                className={cn('mt-1 w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                            />
                            <p className="text-xs text-slate-500 mt-1">권장: 60000~120000</p>
                        </div>

                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="text-xs font-bold text-slate-500 mb-2">실시간 비용 견적 단가</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-500">필라멘트 단가 (원/kg)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={formState.filamentCostPerKg ?? 18000}
                                        onChange={(e) => handleChange('filamentCostPerKg', Number(e.target.value))}
                                        className={cn('mt-1 w-full px-3 py-2 rounded-lg border text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">전기세 단가 (원/kWh)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="10"
                                        value={formState.electricityCostPerKwh ?? 200}
                                        onChange={(e) => handleChange('electricityCostPerKwh', Number(e.target.value))}
                                        className={cn('mt-1 w-full px-3 py-2 rounded-lg border text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">기본값: 필라멘트 18,000원/kg, 전기세 200원/kWh</p>
                        </div>

                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="text-xs font-bold text-slate-500 mb-2">빠른 프리셋</div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => { handleChange('dashboardPollMs', 3000); handleChange('dashboardStatsPollMs', 30000); }} className="px-2 py-2 rounded-lg text-xs font-bold border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">고속</button>
                                <button onClick={() => { handleChange('dashboardPollMs', 5000); handleChange('dashboardStatsPollMs', 60000); }} className="px-2 py-2 rounded-lg text-xs font-bold border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">균형</button>
                                <button onClick={() => { handleChange('dashboardPollMs', 10000); handleChange('dashboardStatsPollMs', 120000); }} className="px-2 py-2 rounded-lg text-xs font-bold border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">절전</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-5">
                        <Bell className="w-6 h-6 text-emerald-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">알림 설정</h3>
                    </div>

                    <div className="space-y-3">
                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-bold">브라우저 권한</p>
                                    <p className="text-xs text-slate-500">현재: {notificationPermission}</p>
                                </div>
                                {notificationPermission !== 'granted' && (
                                    <button onClick={handleRequestNotification} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold">권한 요청</button>
                                )}
                            </div>
                        </div>

                        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-bold">출력 완료 알림</span>
                            <input type="checkbox" checked={formState.notifyPrintComplete !== false} onChange={(e) => handleChange('notifyPrintComplete', e.target.checked)} />
                        </label>

                        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-bold">에러 알림(예약)</span>
                            <input type="checkbox" checked={formState.notifyPrinterError !== false} onChange={(e) => handleChange('notifyPrinterError', e.target.checked)} />
                        </label>
                    </div>
                </section>

                <section className="premium-card hover-lift">
                    <div className="flex items-center gap-3 mb-5">
                        <Camera className="w-6 h-6 text-pink-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">웹캠 기본값</h3>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-bold text-slate-400">기본 회전 각도</label>
                            <select
                                value={formState.webcamDefaultRotation ?? 90}
                                onChange={(e) => handleChange('webcamDefaultRotation', Number(e.target.value))}
                                className={cn('mt-1 w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                            >
                                {VALID_ROTATIONS.map((deg) => <option key={deg} value={deg}>{deg}°</option>)}
                            </select>
                        </div>

                        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-bold">기본 좌우 반전</span>
                            <input type="checkbox" checked={formState.webcamMirrorX === true} onChange={(e) => handleChange('webcamMirrorX', e.target.checked)} />
                        </label>
                    </div>
                </section>

                <section className="premium-card hover-lift xl:col-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <KeyRound className="w-6 h-6 text-violet-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">AI 챗봇</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-bold text-slate-400">Free API 키</label>
                            <input
                                type="password"
                                value={formState.aiFreeApiKey || ''}
                                onChange={(e) => handleChange('aiFreeApiKey', e.target.value)}
                                className={cn('mt-1 w-full px-4 py-3 rounded-xl border font-mono text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-400">Paid API 키</label>
                            <input
                                type="password"
                                value={formState.aiPaidApiKey || ''}
                                onChange={(e) => handleChange('aiPaidApiKey', e.target.value)}
                                className={cn('mt-1 w-full px-4 py-3 rounded-xl border font-mono text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">API 키는 로컬에서 암호화되어 저장됩니다. 유료 모델 선택은 AI 챗봇 탭의 Paid 모드에서 변경합니다.</p>
                </section>

                <section className="premium-card hover-lift xl:col-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <Palette className="w-6 h-6 text-yellow-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">UI & 시스템</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-sm">테마</div>
                                    <div className="text-xs text-slate-500">현재: {theme}</div>
                                </div>
                                <button onClick={toggleTheme} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-1.5">
                                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} 전환
                                </button>
                            </div>
                        </div>

                        <div className={cn('p-3 rounded-xl border', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div className="text-sm font-bold">밀도</div>
                            <select value={formState.uiDensity || 'comfortable'} onChange={(e) => handleChange('uiDensity', e.target.value)} className={cn('mt-2 w-full px-3 py-2 rounded-lg border text-sm', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}>
                                <option value="compact">Compact</option>
                                <option value="comfortable">Comfortable</option>
                            </select>
                        </div>

                        <label className={cn('p-3 rounded-xl border flex items-center justify-between gap-2', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                            <div>
                                <div className="font-bold text-sm">화면 켜짐 유지</div>
                                <div className="text-xs text-slate-500">모니터링 시 절전 방지</div>
                            </div>
                            <input type="checkbox" checked={formState.wakelockEnabled === true} onChange={(e) => handleChange('wakelockEnabled', e.target.checked)} />
                        </label>
                    </div>
                </section>

                <section className="premium-card hover-lift xl:col-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <SlidersHorizontal className="w-6 h-6 text-cyan-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">연결 프로필</h3>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 mb-3">
                        <input
                            type="text"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            placeholder="프로필 이름 (예: 집/작업실)"
                            className={cn('flex-1 px-4 py-2.5 rounded-xl border', theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900')}
                        />
                        <button onClick={saveCurrentAsProfile} className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm">현재값 저장</button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                        {connectionProfiles.length === 0 && <div className="text-sm text-slate-500">저장된 프로필이 없습니다.</div>}
                        {connectionProfiles.map((profile) => (
                            <div key={profile.id} className={cn('p-3 rounded-xl border flex items-center justify-between gap-3', theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                                <div className="min-w-0">
                                    <div className="font-bold truncate">{profile.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{profile.klipperIp} / CAM1:{profile.webcamUrl || '-'} / CAM2:{profile.webcamUrl2 || '-'}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => applyProfile(profile)} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">적용</button>
                                    <button onClick={() => removeProfile(profile.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="premium-card hover-lift xl:col-span-2">
                    <div className="flex items-center gap-3 mb-5">
                        <ShieldCheck className="w-6 h-6 text-rose-400" />
                        <h3 className="text-xl font-black gradient-primary gradient-text">백업 & 초기화</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={exportSettings} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center gap-1.5">
                            <Download className="w-4 h-4" /> 설정 내보내기
                        </button>
                        <button onClick={() => importRef.current?.click()} disabled={isImporting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-60">
                            <Upload className="w-4 h-4" /> 설정 불러오기
                        </button>
                        <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
                        <button onClick={resetAllSettings} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold inline-flex items-center gap-1.5">
                            <RotateCcw className="w-4 h-4" /> 전체 초기화
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">보안을 위해 API 키는 내보내기 파일에서 제외됩니다.</p>
                </section>
            </div>

            <div className={cn('rounded-xl border px-3 py-2 text-xs flex items-center gap-2', theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                <Zap className="w-3.5 h-3.5" />
                저장 후 홈/웹캠/챗봇에서 즉시 반영됩니다. 일부 설정은 새로고침 시 완전 적용됩니다.
            </div>
        </div>
    );
};

export default SettingsPage;
