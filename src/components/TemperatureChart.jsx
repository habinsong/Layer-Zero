import React, { useState, useEffect, useRef } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { getTemperatureStore, subscribePrinterObjectsRealtime } from '../utils/moonrakerApi';
import { cn } from '../lib/utils';
import { Thermometer } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const TemperatureChart = () => {
    const { theme } = useTheme();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
    const wsConnectedRef = useRef(false);
    const tempsRef = useRef({ extruder: 0, bed: 0 });
    const tickRef = useRef(0);
    const fallbackRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        const pushSample = (extruder, bed) => {
            const safeExtruder = Number.isFinite(extruder) ? extruder : tempsRef.current.extruder;
            const safeBed = Number.isFinite(bed) ? bed : tempsRef.current.bed;

            tempsRef.current = { extruder: safeExtruder, bed: safeBed };
            tickRef.current += 1;
            const nextPoint = {
                time: tickRef.current,
                extruder: safeExtruder,
                bed: safeBed
            };

            setData((prev) => [...prev.slice(-599), nextPoint]);
            setLoading(false);
        };

        const fetchTemperatureHistory = async () => {
            try {
                const response = await getTemperatureStore();
                if (response.success && response.result) {
                    const store = response.result;
                    const extrudertemps = store.extruder?.temperatures || [];
                    const bedtemps = store.heater_bed?.temperatures || [];

                    // 데이터 길이 맞추기 (가장 긴 배열 기준)
                    const length = Math.max(extrudertemps.length, bedtemps.length);
                    // 최근 600개 데이터만 사용 (약 10분)
                    const limit = 600;
                    const startIndex = Math.max(0, length - limit);

                    const formattedData = [];
                    for (let i = startIndex; i < length; i++) {
                        formattedData.push({
                            time: i - startIndex, // 상대 시간 (초)
                            extruder: extrudertemps[i] || 0,
                            bed: bedtemps[i] || 0,
                        });
                    }
                    if (!cancelled) {
                        setData(formattedData);
                        tickRef.current = formattedData.length > 0
                            ? formattedData[formattedData.length - 1].time
                            : 0;
                        const latest = formattedData[formattedData.length - 1];
                        if (latest) {
                            tempsRef.current = {
                                extruder: latest.extruder,
                                bed: latest.bed
                            };
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch temperature history:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchTemperatureHistory();

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: ['extruder', 'heater_bed'],
            onConnectionChange: ({ connected }) => {
                wsConnectedRef.current = connected;
                if (!cancelled) setIsRealtimeConnected(connected);
            },
            onStatusUpdate: (statusPatch) => {
                if (cancelled || !statusPatch) return;

                const ext = statusPatch.extruder?.temperature;
                const bed = statusPatch.heater_bed?.temperature;
                if (!Number.isFinite(ext) && !Number.isFinite(bed)) return;
                pushSample(ext, bed);
            }
        });

        // WS 단절 시에만 저주기 fallback 동기화
        const fallbackTimer = setInterval(() => {
            const now = Date.now();
            if (wsConnectedRef.current || now - fallbackRef.current < 20000) return;
            fallbackRef.current = now;
            fetchTemperatureHistory();
        }, 5000);

        return () => {
            cancelled = true;
            unsubscribeRealtime?.();
            clearInterval(fallbackTimer);
        };
    }, []);

    if (loading) return <div className="text-center text-slate-500 py-10">데이터 로딩 중...</div>;

    const isDark = theme === 'dark';

    return (
        <div className={cn(
            "w-full h-[300px] md:h-[400px] rounded-xl p-4 border",
            isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
        )}>
            <div className="flex items-center gap-2 mb-4">
                <Thermometer className="w-5 h-5 text-red-400" />
                <h3 className={cn("text-lg font-bold", isDark ? "text-slate-300" : "text-slate-800")}>온도 그래프 (최근 10분)</h3>
                <span className={cn(
                    "ml-auto px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide",
                    isRealtimeConnected
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                )}>
                    {isRealtimeConnected ? 'WS 실시간' : 'HTTP 폴백'}
                </span>
            </div>

            <ResponsiveContainer width="100%" height="90%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis
                        dataKey="time"
                        stroke={isDark ? "#94a3b8" : "#64748b"}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(val) => `${Math.floor(val / 60)}분`}
                        hide
                    />
                    <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                            color: isDark ? '#f8fafc' : '#0f172a'
                        }}
                        itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                        labelFormatter={() => ''}
                    />
                    <Legend wrapperStyle={{ color: isDark ? '#cbd5e1' : '#334155' }} />
                    <Line
                        type="monotone"
                        dataKey="extruder"
                        name="노즐 온도 (°C)"
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="bed"
                        name="베드 온도 (°C)"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default React.memo(TemperatureChart);
