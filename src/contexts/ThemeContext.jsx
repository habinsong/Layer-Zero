import { createContext, useContext, useState, useEffect } from 'react';
import { getServerSettings, putServerSettings, subscribeServerEvents } from '../utils/centralApi';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const LOCAL_THEME_KEY = 'layer-zero-theme';
    const [isRemoteHydrated, setIsRemoteHydrated] = useState(false);
    const [theme, setTheme] = useState(() => {
        try {
            const savedTheme = localStorage.getItem(LOCAL_THEME_KEY);
            return (savedTheme === 'dark' || savedTheme === 'light') ? savedTheme : 'dark';
        } catch (e) {
            console.error("Theme load error:", e);
            return 'dark';
        }
    });

    useEffect(() => {
        // 테마 변경 시 HTML에 data-theme 속성 설정
        document.documentElement.setAttribute('data-theme', theme);

        // Tailwind dark 모드를 위한 클래스 토글
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        localStorage.setItem(LOCAL_THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const remote = await getServerSettings();
                if (cancelled) return;
                const remoteTheme = remote?.uiTheme;
                if (remoteTheme === 'dark' || remoteTheme === 'light') {
                    setTheme(remoteTheme);
                    localStorage.setItem(LOCAL_THEME_KEY, remoteTheme);
                }
            } catch {
                // offline/local fallback mode
            } finally {
                if (!cancelled) setIsRemoteHydrated(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!isRemoteHydrated) return;
        putServerSettings({ uiTheme: theme }).catch(() => {
            // offline/local fallback mode
        });
    }, [theme, isRemoteHydrated]);

    useEffect(() => {
        const unsubscribe = subscribeServerEvents((event) => {
            if (!event || event.type !== 'settings.updated') return;
            const nextTheme = event?.data?.uiTheme;
            if (nextTheme !== 'dark' && nextTheme !== 'light') return;
            setTheme((prev) => (prev === nextTheme ? prev : nextTheme));
            localStorage.setItem(LOCAL_THEME_KEY, nextTheme);
        });
        return () => unsubscribe();
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
