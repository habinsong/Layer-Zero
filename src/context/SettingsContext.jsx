import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { encryptText, decryptText } from '../utils/secureStorage';
import { APP_ENV } from '../config/env';
import { getServerSettings, putServerSettings, subscribeServerEvents } from '../utils/centralApi';

const AI_FREE_API_KEY_STORAGE = 'ai-free-api-key';
const AI_PAID_API_KEY_STORAGE = 'ai-paid-api-key';
const AI_FREE_API_KEY_ENC_STORAGE = 'ai-free-api-key-enc';
const AI_PAID_API_KEY_ENC_STORAGE = 'ai-paid-api-key-enc';
const SECRET_SETTING_KEYS = new Set(['aiFreeApiKey', 'aiPaidApiKey']);

const DEFAULT_SETTINGS = {
    printerName: APP_ENV.defaultPrinterName || 'KP3S PRO',
    klipperIp: APP_ENV.defaultKlipperIp || '',
    webcamUrl: APP_ENV.defaultWebcamUrl || '',
    webcamUrl2: APP_ENV.defaultWebcamUrl2 || '',
    weatherCity: APP_ENV.defaultWeatherCity || '서울시',
    weatherLat: Number(APP_ENV.defaultWeatherLat) || 37.5665,
    weatherLon: Number(APP_ENV.defaultWeatherLon) || 126.9780,
    filamentCostPerKg: 18000,
    electricityCostPerKwh: 200,
    wakelockEnabled: false,
    aiFreeApiKey: '',
    aiPaidApiKey: '',
    dashboardPollMs: 5000,
    dashboardStatsPollMs: 60000,
    notifyPrintComplete: true,
    notifyPrinterError: true,
    webcamDefaultRotation: 90,
    webcamMirrorX: false,
    uiDensity: 'comfortable'
};

const STORAGE_KEYS = {
    printerName: 'printer-name',
    klipperIp: 'klipper-ip',
    webcamUrl: 'webcam-url',
    webcamUrl2: 'webcam-url-2',
    weatherCity: 'weather-city',
    weatherLat: 'weather-lat',
    weatherLon: 'weather-lon',
    filamentCostPerKg: 'filament-cost-per-kg',
    electricityCostPerKwh: 'electricity-cost-per-kwh',
    wakelockEnabled: 'wakelock-enabled',
    dashboardPollMs: 'dashboard-poll-ms',
    dashboardStatsPollMs: 'dashboard-stats-poll-ms',
    notifyPrintComplete: 'notify-print-complete',
    notifyPrinterError: 'notify-printer-error',
    webcamDefaultRotation: 'webcam-default-rotation',
    webcamMirrorX: 'webcam-mirror-x-default',
    uiDensity: 'ui-density'
};

const BOOLEAN_KEYS = new Set([
    'wakelockEnabled',
    'notifyPrintComplete',
    'notifyPrinterError',
    'webcamMirrorX'
]);

const NUMBER_KEYS = new Set([
    'dashboardPollMs',
    'dashboardStatsPollMs',
    'webcamDefaultRotation',
    'weatherLat',
    'weatherLon',
    'filamentCostPerKg',
    'electricityCostPerKwh'
]);

const SettingsContext = createContext(null);

function readSettingValue(settingKey, defaultValue) {
    const storageKey = STORAGE_KEYS[settingKey];
    if (!storageKey) return defaultValue;

    const raw = localStorage.getItem(storageKey);
    if (raw === null || raw === undefined) return defaultValue;

    if (BOOLEAN_KEYS.has(settingKey)) {
        return raw === 'true';
    }

    if (NUMBER_KEYS.has(settingKey)) {
        const num = Number(raw);
        return Number.isFinite(num) ? num : defaultValue;
    }

    return raw;
}

function writeSettingValue(settingKey, value) {
    const storageKey = STORAGE_KEYS[settingKey];
    if (!storageKey) return;
    localStorage.setItem(storageKey, String(value));
}

function sanitizeRemoteSettings(input) {
    if (!input || typeof input !== 'object') return null;
    const next = { ...input };
    SECRET_SETTING_KEYS.forEach((key) => {
        if (key in next) delete next[key];
    });
    return next;
}

function persistSafeSettingsSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    Object.keys(snapshot).forEach((key) => {
        if (SECRET_SETTING_KEYS.has(key)) return;
        if (key in STORAGE_KEYS) writeSettingValue(key, snapshot[key]);
    });
}

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const savedSettings = { ...DEFAULT_SETTINGS };

        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
            if (key === 'aiFreeApiKey' || key === 'aiPaidApiKey') return;
            savedSettings[key] = readSettingValue(key, DEFAULT_SETTINGS[key]);
        });

        // 기존 klipper-ip 마이그레이션: 8888 -> 7125
        if (savedSettings.klipperIp && savedSettings.klipperIp.includes(':8888')) {
            const migrated = savedSettings.klipperIp.replace(':8888', ':7125');
            savedSettings.klipperIp = migrated;
            writeSettingValue('klipperIp', migrated);
        }

        // 레거시 평문 키 우선 로드 (암호화 키는 비동기 복호화로 후처리)
        if (localStorage.getItem(AI_FREE_API_KEY_STORAGE)) {
            savedSettings.aiFreeApiKey = localStorage.getItem(AI_FREE_API_KEY_STORAGE);
        }
        if (localStorage.getItem(AI_PAID_API_KEY_STORAGE)) {
            savedSettings.aiPaidApiKey = localStorage.getItem(AI_PAID_API_KEY_STORAGE);
        }

        return savedSettings;
    });

    useEffect(() => {
        const loadEncryptedApiKeys = async () => {
            try {
                const freeEnc = localStorage.getItem(AI_FREE_API_KEY_ENC_STORAGE);
                const paidEnc = localStorage.getItem(AI_PAID_API_KEY_ENC_STORAGE);

                if (freeEnc) {
                    const freeKey = await decryptText(freeEnc);
                    if (freeKey) {
                        setSettings((prev) => ({ ...prev, aiFreeApiKey: freeKey }));
                    }
                }

                if (paidEnc) {
                    const paidKey = await decryptText(paidEnc);
                    if (paidKey) {
                        setSettings((prev) => ({ ...prev, aiPaidApiKey: paidKey }));
                    }
                }

                const freePlain = localStorage.getItem(AI_FREE_API_KEY_STORAGE);
                if (freePlain && !freeEnc) {
                    const encrypted = await encryptText(freePlain);
                    if (encrypted) localStorage.setItem(AI_FREE_API_KEY_ENC_STORAGE, encrypted);
                    localStorage.removeItem(AI_FREE_API_KEY_STORAGE);
                }

                const paidPlain = localStorage.getItem(AI_PAID_API_KEY_STORAGE);
                if (paidPlain && !paidEnc) {
                    const encrypted = await encryptText(paidPlain);
                    if (encrypted) localStorage.setItem(AI_PAID_API_KEY_ENC_STORAGE, encrypted);
                    localStorage.removeItem(AI_PAID_API_KEY_STORAGE);
                }
            } catch (error) {
                console.error('Failed to load encrypted API keys:', error);
            }
        };

        loadEncryptedApiKeys();
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const remote = await getServerSettings();
                if (!remote || cancelled) return;
                const safeRemote = sanitizeRemoteSettings(remote);
                if (!safeRemote) return;
                setSettings((prev) => {
                    const merged = { ...prev, ...safeRemote };
                    persistSafeSettingsSnapshot(merged);
                    return merged;
                });
            } catch {
                // 서버 미연결 시 localStorage fallback 유지
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeServerEvents((event) => {
            if (!event || event.type !== 'settings.updated') return;
            if (event.data && typeof event.data === 'object') {
                const safeRemote = sanitizeRemoteSettings(event.data);
                if (!safeRemote) return;
                setSettings((prev) => {
                    const merged = { ...prev, ...safeRemote };
                    persistSafeSettingsSnapshot(merged);
                    return merged;
                });
                return;
            }
            getServerSettings()
                .then((remote) => {
                    const safeRemote = sanitizeRemoteSettings(remote);
                    if (!safeRemote) return;
                    setSettings((prev) => {
                        const merged = { ...prev, ...safeRemote };
                        persistSafeSettingsSnapshot(merged);
                        return merged;
                    });
                })
                .catch(() => {
                    // offline/local fallback mode
                });
        });
        return () => unsubscribe();
    }, []);

    const updateSettings = useCallback((newSettings) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };

            Object.keys(newSettings).forEach((key) => {
                if (SECRET_SETTING_KEYS.has(key)) return;
                writeSettingValue(key, updated[key]);
            });

            if (newSettings.aiFreeApiKey !== undefined) {
                if (newSettings.aiFreeApiKey) {
                    encryptText(newSettings.aiFreeApiKey)
                        .then((encrypted) => {
                            if (encrypted) localStorage.setItem(AI_FREE_API_KEY_ENC_STORAGE, encrypted);
                            localStorage.removeItem(AI_FREE_API_KEY_STORAGE);
                        })
                        .catch((error) => console.error('Failed to encrypt free API key:', error));
                } else {
                    localStorage.removeItem(AI_FREE_API_KEY_ENC_STORAGE);
                    localStorage.removeItem(AI_FREE_API_KEY_STORAGE);
                }
            }

            if (newSettings.aiPaidApiKey !== undefined) {
                if (newSettings.aiPaidApiKey) {
                    encryptText(newSettings.aiPaidApiKey)
                        .then((encrypted) => {
                            if (encrypted) localStorage.setItem(AI_PAID_API_KEY_ENC_STORAGE, encrypted);
                            localStorage.removeItem(AI_PAID_API_KEY_STORAGE);
                        })
                        .catch((error) => console.error('Failed to encrypt paid API key:', error));
                } else {
                    localStorage.removeItem(AI_PAID_API_KEY_ENC_STORAGE);
                    localStorage.removeItem(AI_PAID_API_KEY_STORAGE);
                }
            }

            putServerSettings(sanitizeRemoteSettings(updated) || {}).catch(() => {
                // offline/local fallback mode
            });

            return updated;
        });
    }, []);

    const resetSettings = useCallback(() => {
        const resetValue = { ...DEFAULT_SETTINGS };

        Object.keys(STORAGE_KEYS).forEach((key) => {
            localStorage.removeItem(STORAGE_KEYS[key]);
        });

        localStorage.removeItem(AI_FREE_API_KEY_ENC_STORAGE);
        localStorage.removeItem(AI_PAID_API_KEY_ENC_STORAGE);
        localStorage.removeItem(AI_FREE_API_KEY_STORAGE);
        localStorage.removeItem(AI_PAID_API_KEY_STORAGE);

        setSettings(resetValue);
        putServerSettings(sanitizeRemoteSettings(resetValue) || {}).catch(() => {
            // offline/local fallback mode
        });
    }, []);

    const contextValue = useMemo(() => ({
        settings,
        updateSettings,
        resetSettings,
        defaultSettings: DEFAULT_SETTINGS
    }), [settings, updateSettings, resetSettings]);

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
