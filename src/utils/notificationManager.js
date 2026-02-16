// Notification Manager - 브라우저 알림 관리
// Phase 1: Quick Actions - Browser Notifications

import { putServerSettings } from './centralApi';

const NOTIFICATION_ICON = '/icon-192.png';

const isBrowserNotificationSupported = () => {
    if (typeof window === 'undefined') return false;
    return "Notification" in window;
};

export const getNotificationSupportInfo = () => {
    if (typeof window === 'undefined') {
        return { supported: false, secure: false, permission: 'default', reason: 'server' };
    }
    const supported = isBrowserNotificationSupported();
    const secure = Boolean(window.isSecureContext);
    const permission = supported ? window.Notification.permission : 'denied';

    let reason = '';
    if (!supported) reason = 'unsupported';
    else if (!secure) reason = 'insecure-context';
    else if (permission === 'denied') reason = 'blocked';

    return { supported, secure, permission, reason };
};

/**
 * 브라우저 알림 권한 요청
 * @returns {Promise<boolean>} 권한이 승인되면 true
 */
export const requestNotificationPermission = async () => {
    const info = getNotificationSupportInfo();
    if (!info.supported) {
        console.warn('이 브라우저는 알림을 지원하지 않습니다.');
        return { granted: false, permission: 'denied', reason: 'unsupported' };
    }

    if (!info.secure) {
        console.warn('알림 권한은 보안 컨텍스트(HTTPS/localhost)에서만 요청할 수 있습니다.');
        return { granted: false, permission: info.permission, reason: 'insecure-context' };
    }

    if (window.Notification.permission === 'granted') {
        putServerSettings({ notificationPermission: 'granted' }).catch(() => {
            // offline/local fallback mode
        });
        return { granted: true, permission: 'granted', reason: 'already-granted' };
    }

    try {
        const permission = await window.Notification.requestPermission();
        localStorage.setItem('notification-permission', permission);
        putServerSettings({ notificationPermission: permission }).catch(() => {
            // offline/local fallback mode
        });
        return {
            granted: permission === "granted",
            permission,
            reason: permission === 'granted' ? 'ok' : 'blocked-or-dismissed'
        };
    } catch (error) {
        return {
            granted: false,
            permission: window.Notification.permission || 'default',
            reason: `request-error:${error?.message || 'unknown'}`
        };
    }
};

const showBrowserNotification = async (title, options) => {
    if (!isBrowserNotificationSupported()) return;
    if (window.Notification.permission !== "granted") return;

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await registration.showNotification(title, options);
                return;
            }
        }
    } catch (error) {
        console.warn('Service Worker 알림 실패, 기본 알림으로 폴백:', error);
    }

    const notification = new window.Notification(title, options);
    notification.onclick = () => {
        try {
            window.focus();
            notification.close();
        } catch {
            // 무시
        }
    };
};

/**
 * 출력 완료 알림 전송
 * @param {string} filename - 파일명
 * @param {string} duration - 소요 시간 (형식: "4h 20m 30s")
 */
export const sendPrintCompleteNotification = async (filename, duration) => {
    const safeFilename = filename || '작업';
    const safeDuration = duration || '-';
    await showBrowserNotification("출력 완료", {
        body: `${safeFilename}\n소요시간: ${safeDuration}`,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: 'print-complete',
        renotify: true,
        requireInteraction: false,
        silent: false
    });
};

/**
 * 에러 알림 전송
 * @param {string} message - 에러 메시지
 */
export const sendErrorNotification = (message) => {
    showBrowserNotification("프린터 에러", {
        body: message,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: 'printer-error',
        renotify: true,
        requireInteraction: false
    });
};

/**
 * 현재 알림 권한 상태 확인
 * @returns {'granted' | 'denied' | 'default'}
 */
export const getNotificationPermission = () => {
    if (!isBrowserNotificationSupported()) {
        return 'denied';
    }
    return window.Notification.permission;
};
