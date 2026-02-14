// Notification Manager - 브라우저 알림 관리
// Phase 1: Quick Actions - Browser Notifications

const NOTIFICATION_ICON = '/icon-192.png';

const isBrowserNotificationSupported = () => {
    if (typeof window === 'undefined') return false;
    return "Notification" in window;
};

/**
 * 브라우저 알림 권한 요청
 * @returns {Promise<boolean>} 권한이 승인되면 true
 */
export const requestNotificationPermission = async () => {
    if (!isBrowserNotificationSupported()) {
        console.warn('이 브라우저는 알림을 지원하지 않습니다.');
        return false;
    }

    if (window.Notification.permission === 'granted') {
        return true;
    }

    const permission = await window.Notification.requestPermission();
    localStorage.setItem('notification-permission', permission);
    return permission === "granted";
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
