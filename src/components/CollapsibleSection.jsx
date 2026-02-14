import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = true, className }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const { theme } = useTheme();

    return (
        <div className={cn(
            "rounded-xl overflow-hidden transition-all duration-300 border",
            theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm",
            className
        )}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full px-4 py-3 flex items-center justify-between transition-colors",
                    theme === 'dark' ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
                    isOpen && (theme === 'dark' ? "border-b border-slate-800" : "border-b border-slate-100")
                )}
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon className={cn("w-5 h-5", theme === 'dark' ? "text-cyan-400" : "text-blue-500")} />}
                    <h3 className={cn("font-bold text-lg", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>{title}</h3>
                </div>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                )}
            </button>

            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;
