import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            // LocalStorage에서 저장된 테마 불러오기
            const savedTheme = localStorage.getItem('layer-zero-theme');
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

        // LocalStorage에 저장
        localStorage.setItem('layer-zero-theme', theme);
    }, [theme]);

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
