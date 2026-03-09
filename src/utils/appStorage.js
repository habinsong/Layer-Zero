const APP_STORAGE_KEYS = [
    'layer-zero-theme',
    'layer-zero-connection-profiles-v1',
    'layer-zero-print-reports-v1',
    'printer-name',
    'klipper-ip',
    'webcam-url',
    'webcam-url-2',
    'weather-city',
    'weather-lat',
    'weather-lon',
    'filament-cost-per-kg',
    'electricity-cost-per-kwh',
    'wakelock-enabled',
    'dashboard-poll-ms',
    'dashboard-stats-poll-ms',
    'notify-print-complete',
    'notify-printer-error',
    'webcam-default-rotation',
    'webcam-mirror-x-default',
    'ui-density',
    'ai-free-api-key',
    'ai-paid-api-key',
    'ai-free-api-key-enc',
    'ai-paid-api-key-enc',
    'ai_chatbot_messages_v1',
    'ai_chatbot_mobile_font_scale_v1',
    'ai_chatbot_paid_model_v1',
    'ai_chatbot_usage_v2',
    'home-console-history-v1',
    'pending-mesh-history-v1',
    'bed-mesh-history-v1',
    'filament-spool',
    'maintenance-schedule',
    'maintenance-log-v1',
    'maintenance-checklist-v1',
    'model-sites-favorites-v1',
    'webcam-active-cam',
    'webcam-rotation',
    'webcam-mirror-x',
    'notification-permission'
];

export function clearLayerZeroLocalData() {
    if (typeof window === 'undefined') return;

    APP_STORAGE_KEYS.forEach((key) => {
        localStorage.removeItem(key);
    });
}

