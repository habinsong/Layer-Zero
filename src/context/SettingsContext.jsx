import React, { createContext, useContext, useState, useEffect } from 'react';
import { encryptText, decryptText } from '../utils/secureStorage';
import { APP_ENV } from '../config/env';

const AI_FREE_API_KEY_STORAGE = 'ai-free-api-key';
const AI_PAID_API_KEY_STORAGE = 'ai-paid-api-key';
const AI_FREE_API_KEY_ENC_STORAGE = 'ai-free-api-key-enc';
const AI_PAID_API_KEY_ENC_STORAGE = 'ai-paid-api-key-enc';

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
    aiFreeApiKey: APP_ENV.defaultAiFreeApiKey || '',
    aiPaidApiKey: APP_ENV.defaultAiPaidApiKey || '',
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

    const updateSettings = (newSettings) => {
        setSettings((prev) => {
            const updated = { ...prev, ...newSettings };

            Object.keys(newSettings).forEach((key) => {
                if (key === 'aiFreeApiKey' || key === 'aiPaidApiKey') return;
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

            return updated;
        });
    };

    const resetSettings = () => {
        const resetValue = { ...DEFAULT_SETTINGS };

        Object.keys(STORAGE_KEYS).forEach((key) => {
            localStorage.removeItem(STORAGE_KEYS[key]);
        });

        localStorage.removeItem(AI_FREE_API_KEY_ENC_STORAGE);
        localStorage.removeItem(AI_PAID_API_KEY_ENC_STORAGE);
        localStorage.removeItem(AI_FREE_API_KEY_STORAGE);
        localStorage.removeItem(AI_PAID_API_KEY_STORAGE);

        setSettings(resetValue);
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, defaultSettings: DEFAULT_SETTINGS }}>
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
