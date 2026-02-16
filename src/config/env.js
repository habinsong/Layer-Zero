const env = import.meta.env || {};

function readString(name, fallback = '') {
    const value = env[name];
    if (value === undefined || value === null) return fallback;
    return String(value);
}

export const APP_ENV = {
    defaultPrinterName: readString('VITE_DEFAULT_PRINTER_NAME', 'KP3S PRO'),
    defaultKlipperIp: readString('VITE_DEFAULT_KLIPPER_IP', ''),
    defaultWebcamUrl: readString('VITE_DEFAULT_WEBCAM_URL', ''),
    defaultWebcamUrl2: readString('VITE_DEFAULT_WEBCAM_URL2', ''),
    defaultWeatherCity: readString('VITE_DEFAULT_WEATHER_CITY', '서울시'),
    defaultWeatherLat: readString('VITE_DEFAULT_WEATHER_LAT', '37.5665'),
    defaultWeatherLon: readString('VITE_DEFAULT_WEATHER_LON', '126.9780'),
    defaultAiFreeApiKey: readString('VITE_DEFAULT_AI_FREE_API_KEY', ''),
    defaultAiPaidApiKey: readString('VITE_DEFAULT_AI_PAID_API_KEY', ''),
    moonrakerFallbackIp: readString('VITE_MOONRAKER_FALLBACK_IP', ''),
    appApiBase: readString('VITE_APP_API_BASE', '/lzapi')
};
