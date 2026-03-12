import React, { useMemo, useState } from 'react';
import {
    Calculator,
    Gauge,
    Thermometer,
    Copy,
    Check,
    Info,
    SlidersHorizontal,
    Droplets,
    Drill,
    Sparkles,
    ListChecks,
    ClipboardList,
    Layers,
    Bot,
    FlaskConical,
    TimerReset
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    return fallbackCopyText(text);
}

const cardBase = 'premium-card';

const ToolCard = ({ theme, icon, title, subtitle, accent = 'text-blue-400', children }) => {
    const Icon = icon;
    return (
        <section className={cn(cardBase, theme === 'light' ? 'bg-white' : '')}>
            <div className="mb-4 flex items-start gap-3">
                <Icon className={cn('w-5 h-5 md:w-6 md:h-6', accent)} />
                <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-black">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5 break-words">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
};

const CopyButton = ({ text, label = '복사', className = '' }) => {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        const ok = await copyText(text);
        if (!ok) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <button
            onClick={onCopy}
            className={cn('px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600', className)}
        >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사됨' : label}
        </button>
    );
};

const EStepCalculator = ({ theme }) => {
    const [currentEstep, setCurrentEstep] = useState('416');
    const [requestedLength, setRequestedLength] = useState('100');
    const [actualLength, setActualLength] = useState('95');

    const newEstep = useMemo(() => {
        const c = parseFloat(currentEstep);
        const req = parseFloat(requestedLength);
        const act = parseFloat(actualLength);
        if (!c || !req || !act) return 0;
        return (c * req) / act;
    }, [currentEstep, requestedLength, actualLength]);

    const gcode = `SET_PRESSURE_ADVANCE ADVANCE=0\nM92 E${newEstep.toFixed(2)}\nM500`;

    return (
        <ToolCard theme={theme} icon={Calculator} title="E-Step 계산기" subtitle="압출량 오차 즉시 보정" accent="text-blue-400">
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="number" value={currentEstep} onChange={(e) => setCurrentEstep(e.target.value)} placeholder="현재 E-step" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                    <input type="number" value={requestedLength} onChange={(e) => setRequestedLength(e.target.value)} placeholder="요청 길이" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                    <input type="number" value={actualLength} onChange={(e) => setActualLength(e.target.value)} placeholder="실측 길이" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                    <div className="text-xs text-slate-500">새 E-step</div>
                    <div className="text-2xl font-black text-blue-500">{newEstep.toFixed(2)} steps/mm</div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <CopyButton text={gcode} label="E-step G-code 복사" />
                    <span className="text-xs text-slate-500">압출 전 `G92 E0`, 냉간압출 허용 여부 확인</span>
                </div>
            </div>
        </ToolCard>
    );
};

const FlowRateCalculator = ({ theme }) => {
    const [currentFlow, setCurrentFlow] = useState('100');
    const [targetWall, setTargetWall] = useState('0.40');
    const [actualWall, setActualWall] = useState('0.43');

    const newFlow = useMemo(() => {
        const cf = parseFloat(currentFlow);
        const tw = parseFloat(targetWall);
        const aw = parseFloat(actualWall);
        if (!cf || !tw || !aw) return 0;
        return (cf * tw) / aw;
    }, [currentFlow, targetWall, actualWall]);

    const flowGcode = `M221 S${Math.max(1, Math.round(newFlow))}`;

    return (
        <ToolCard theme={theme} icon={Gauge} title="Flow Rate 계산기" subtitle="벽 두께 기반 유량 보정" accent="text-emerald-400">
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="number" value={currentFlow} onChange={(e) => setCurrentFlow(e.target.value)} placeholder="현재 Flow(%)" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                    <input type="number" step="0.01" value={targetWall} onChange={(e) => setTargetWall(e.target.value)} placeholder="목표 벽(mm)" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                    <input type="number" step="0.01" value={actualWall} onChange={(e) => setActualWall(e.target.value)} placeholder="실측 벽(mm)" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
                    <div className="text-xs text-slate-500">권장 Flow</div>
                    <div className="text-2xl font-black text-emerald-500">{newFlow.toFixed(2)}%</div>
                    <div className="text-xs text-slate-500 mt-1">실시간 테스트용: {flowGcode}</div>
                </div>
                <CopyButton text={flowGcode} label="M221 명령 복사" />
            </div>
        </ToolCard>
    );
};

const PIDBuilder = ({ theme }) => {
    const [target, setTarget] = useState('extruder');
    const [temp, setTemp] = useState('220');
    const [cycle, setCycle] = useState('8');

    const gcode = useMemo(() => {
        if (target === 'extruder') return `PID_CALIBRATE HEATER=extruder TARGET=${temp}\nSAVE_CONFIG`;
        return `PID_CALIBRATE HEATER=heater_bed TARGET=${temp}\nSAVE_CONFIG`;
    }, [target, temp]);

    return (
        <ToolCard theme={theme} icon={Thermometer} title="PID 명령 생성기" subtitle="노즐/베드 온도 안정화" accent="text-orange-400">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setTarget('extruder')} className={cn('px-3 py-2 rounded-lg text-sm font-bold border', target === 'extruder' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700')}>노즐</button>
                    <button onClick={() => setTarget('heater_bed')} className={cn('px-3 py-2 rounded-lg text-sm font-bold border', target === 'heater_bed' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700')}>베드</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="목표 온도" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                    <input type="number" value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="사이클" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 text-xs overflow-x-auto">{gcode}\n; 사이클 권장: {cycle}</pre>
                <CopyButton text={gcode} label="PID 명령 복사" />
            </div>
        </ToolCard>
    );
};

const RetractionAdvisor = ({ theme }) => {
    const [drive, setDrive] = useState('direct');
    const [material, setMaterial] = useState('PLA');

    const profile = useMemo(() => {
        const base = {
            PLA: { direct: [0.8, 35], bowden: [4.8, 40] },
            PETG: { direct: [0.6, 28], bowden: [4.2, 30] },
            TPU: { direct: [0.8, 20], bowden: [2.5, 18] },
            ABS: { direct: [0.9, 35], bowden: [5.0, 42] }
        };
        const [distance, speed] = base[material][drive];
        return { distance, speed };
    }, [drive, material]);

    const gcode = `SET_RETRACTION RETRACT_LENGTH=${profile.distance} RETRACT_SPEED=${profile.speed} UNRETRACT_EXTRA_LENGTH=0`;

    return (
        <ToolCard theme={theme} icon={SlidersHorizontal} title="리트랙션 추천기" subtitle="재질/구동계 기준 스타트값" accent="text-fuchsia-400">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <select value={material} onChange={(e) => setMaterial(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <option>PLA</option>
                        <option>PETG</option>
                        <option>TPU</option>
                        <option>ABS</option>
                    </select>
                    <select value={drive} onChange={(e) => setDrive(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <option value="direct">Direct</option>
                        <option value="bowden">Bowden</option>
                    </select>
                </div>
                <div className="p-3 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800/40">
                    <div className="text-sm">거리 <strong>{profile.distance}mm</strong> / 속도 <strong>{profile.speed}mm/s</strong></div>
                    <div className="text-xs text-slate-500 mt-1">스트링 심하면 +0.2mm, 막힘 조짐이면 -0.2mm</div>
                </div>
                <CopyButton text={gcode} label="리트랙션 명령 복사" />
            </div>
        </ToolCard>
    );
};

const DryingPlanner = ({ theme }) => {
    const [material, setMaterial] = useState('PLA');
    const [humidity, setHumidity] = useState('60');

    const plan = useMemo(() => {
        const table = {
            PLA: { temp: 50, baseHour: 4 },
            PETG: { temp: 65, baseHour: 6 },
            ABS: { temp: 70, baseHour: 4 },
            TPU: { temp: 50, baseHour: 6 },
            Nylon: { temp: 75, baseHour: 8 }
        };
        const base = table[material];
        const hum = parseFloat(humidity) || 0;
        const bonus = hum >= 70 ? 2 : hum >= 55 ? 1 : 0;
        return {
            temp: base.temp,
            hour: base.baseHour + bonus
        };
    }, [material, humidity]);

    return (
        <ToolCard theme={theme} icon={Droplets} title="필라멘트 건조 플래너" subtitle="습도 기반 건조 시간 추천" accent="text-cyan-400">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <select value={material} onChange={(e) => setMaterial(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <option>PLA</option>
                        <option>PETG</option>
                        <option>ABS</option>
                        <option>TPU</option>
                        <option>Nylon</option>
                    </select>
                    <input type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="실내 습도(%)" className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                </div>
                <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/40">
                    <div className="text-sm">권장: <strong>{plan.temp}°C · {plan.hour}시간</strong></div>
                    <div className="text-xs text-slate-500 mt-1">건조 후 지퍼백+실리카겔 보관 권장</div>
                </div>
            </div>
        </ToolCard>
    );
};

const NozzleWearEstimator = ({ theme }) => {
    const [hours, setHours] = useState('220');
    const [materialType, setMaterialType] = useState('normal');
    const [nozzleType, setNozzleType] = useState('brass');

    const score = useMemo(() => {
        const h = parseFloat(hours) || 0;
        const materialFactor = materialType === 'abrasive' ? 1.8 : 1;
        const nozzleFactor = nozzleType === 'brass' ? 1 : nozzleType === 'hardened' ? 0.55 : 0.35;
        const wear = Math.min(100, (h / 500) * 100 * materialFactor * nozzleFactor);
        return wear;
    }, [hours, materialType, nozzleType]);

    const status = score >= 85 ? '교체 권장' : score >= 60 ? '점검 필요' : '정상';

    return (
        <ToolCard theme={theme} icon={Drill} title="노즐 마모 추정기" subtitle="시간+재질+노즐 타입 기반" accent="text-amber-400">
            <div className="space-y-3">
                <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="누적 출력 시간(h)" className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700" />
                <div className="grid grid-cols-2 gap-2">
                    <select value={materialType} onChange={(e) => setMaterialType(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <option value="normal">일반 필라멘트</option>
                        <option value="abrasive">연마성 필라멘트</option>
                    </select>
                    <select value={nozzleType} onChange={(e) => setNozzleType(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <option value="brass">브라스</option>
                        <option value="hardened">경화강</option>
                        <option value="ruby">루비/고급</option>
                    </select>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                    <div className="h-2 rounded-full bg-amber-100 dark:bg-slate-700 overflow-hidden mb-2">
                        <div className="h-full bg-amber-500" style={{ width: `${score}%` }} />
                    </div>
                    <div className="text-sm">마모도 <strong>{score.toFixed(1)}%</strong> · {status}</div>
                </div>
            </div>
        </ToolCard>
    );
};

const CalibrationPlanner = ({ theme }) => {
    const [goal, setGoal] = useState('quality');

    const plan = useMemo(() => {
        const plans = {
            quality: {
                title: '표면 품질 개선',
                steps: ['Flow 보정', '온도 타워', '리트랙션 튜닝', '가속/저크 조정'],
                gcode: 'M204 P1500 T1500\nM205 X8 Y8'
            },
            speed: {
                title: '속도 최적화',
                steps: ['Input Shaper 확인', 'Pressure Advance 측정', '속도 단계 테스트'],
                gcode: 'SET_VELOCITY_LIMIT VELOCITY=220 ACCEL=6000 SQUARE_CORNER_VELOCITY=5'
            },
            firstlayer: {
                title: '1층 안정화',
                steps: ['베드 청소', '메쉬 재생성', 'Z-offset 미세조정', '베드 온도 재확인'],
                gcode: 'G28\nBED_MESH_CALIBRATE\nSET_GCODE_OFFSET Z_ADJUST=-0.02 MOVE=1'
            }
        };
        return plans[goal];
    }, [goal]);

    return (
        <ToolCard theme={theme} icon={ListChecks} title="캘리브레이션 플래너" subtitle="목표별 순서+명령 한 번에" accent="text-violet-400">
            <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setGoal('quality')} className={cn('px-2 py-2 rounded-lg border text-xs font-bold', goal === 'quality' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700')}>품질</button>
                    <button onClick={() => setGoal('speed')} className={cn('px-2 py-2 rounded-lg border text-xs font-bold', goal === 'speed' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700')}>속도</button>
                    <button onClick={() => setGoal('firstlayer')} className={cn('px-2 py-2 rounded-lg border text-xs font-bold', goal === 'firstlayer' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700')}>1층</button>
                </div>
                <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40">
                    <div className="text-sm font-bold">{plan.title}</div>
                    <ul className="text-xs mt-1.5 space-y-1 text-slate-600 dark:text-slate-300">
                        {plan.steps.map((s) => <li key={s}>• {s}</li>)}
                    </ul>
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 text-xs overflow-x-auto">{plan.gcode}</pre>
                <CopyButton text={plan.gcode} label="플랜 명령 복사" />
            </div>
        </ToolCard>
    );
};

const FailureTriage = ({ theme }) => {
    const [symptom, setSymptom] = useState('stringing');

    const advice = useMemo(() => {
        const map = {
            stringing: {
                cause: '리트랙션 부족, 온도 과다, 습기',
                fix: ['노즐 -5°C', '리트랙션 거리 +0.2mm', '건조 후 재시도'],
                quick: 'SET_RETRACTION RETRACT_LENGTH=1.0 RETRACT_SPEED=35'
            },
            under: {
                cause: '부분 막힘, Flow 부족, 기어 슬립',
                fix: ['노즐 클리닝', 'Flow +2~4%', 'E-step 재검증'],
                quick: 'M221 S104'
            },
            warp: {
                cause: '베드 접착력 부족, 챔버/외풍 영향',
                fix: ['베드 +5°C', '브림 추가', '첫층 속도 저감'],
                quick: 'M140 S65'
            }
        };
        return map[symptom];
    }, [symptom]);

    return (
        <ToolCard theme={theme} icon={ClipboardList} title="실패 증상 트리아지" subtitle="증상별 빠른 원인/처방" accent="text-rose-400">
            <div className="space-y-3">
                <select value={symptom} onChange={(e) => setSymptom(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                    <option value="stringing">스트링 발생</option>
                    <option value="under">언더익스트루전</option>
                    <option value="warp">워핑/들뜸</option>
                </select>
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40">
                    <p className="text-xs"><strong>주요 원인:</strong> {advice.cause}</p>
                    <div className="text-xs mt-1.5 space-y-1">
                        {advice.fix.map((f) => <div key={f}>• {f}</div>)}
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <CopyButton text={advice.quick} label="즉시 테스트 명령 복사" />
                    <span className="text-xs text-slate-500 font-mono break-all">{advice.quick}</span>
                </div>
            </div>
        </ToolCard>
    );
};

const ToolRecipes = ({ theme }) => {
    const recipes = [
        {
            name: '1kg 스풀 교체 루틴',
            cmds: 'M104 S0\nM140 S0\nM107\nM84',
            icon: Layers
        },
        {
            name: '노즐 청소 루틴',
            cmds: 'M109 S220\nG1 E20 F120\nG1 E-4 F1800',
            icon: FlaskConical
        },
        {
            name: '프린트 전 리셋 루틴',
            cmds: 'G28\nBED_MESH_PROFILE LOAD=default\nM220 S100\nM221 S100',
            icon: TimerReset
        }
    ];

    return (
        <ToolCard theme={theme} icon={Sparkles} title="원클릭 루틴 레시피" subtitle="자주 쓰는 명령 묶음" accent="text-yellow-400">
            <div className="space-y-2.5">
                {recipes.map((r) => (
                    <div key={r.name} className="p-3 rounded-lg border bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <r.icon className="w-4 h-4 text-yellow-500 shrink-0" />
                                <div className="text-sm font-bold truncate">{r.name}</div>
                            </div>
                            <CopyButton text={r.cmds} label="복사" className="px-2.5 py-1.5" />
                        </div>
                        <pre className="mt-2 text-[11px] p-2 rounded bg-slate-950 text-slate-200 overflow-x-auto">{r.cmds}</pre>
                    </div>
                ))}
            </div>
        </ToolCard>
    );
};

const MotionProfileCalculator = ({ theme }) => {
    const [targetSpeed, setTargetSpeed] = useState('120');
    const [acceleration, setAcceleration] = useState('3000');
    const [distance, setDistance] = useState('100');

    const result = useMemo(() => {
        const v = Math.max(0, parseFloat(targetSpeed) || 0);
        const a = Math.max(0, parseFloat(acceleration) || 0);
        const d = Math.max(0, parseFloat(distance) || 0);
        if (v <= 0 || a <= 0 || d <= 0) {
            return {
                valid: false,
                profile: 'invalid',
                actualPeakSpeed: 0,
                accelTime: 0,
                cruiseTime: 0,
                decelTime: 0,
                totalTime: 0
            };
        }

        // 정지 -> 최고속도 -> 정지 구간의 거리 조건
        const fullAccelDecelDistance = (v * v) / a;
        if (d >= fullAccelDecelDistance) {
            const accelTime = v / a;
            const accelDistance = (v * v) / (2 * a);
            const cruiseDistance = Math.max(0, d - (2 * accelDistance));
            const cruiseTime = cruiseDistance / v;
            const totalTime = (2 * accelTime) + cruiseTime;
            return {
                valid: true,
                profile: 'trapezoid',
                actualPeakSpeed: v,
                accelTime,
                cruiseTime,
                decelTime: accelTime,
                totalTime
            };
        }

        // 거리 부족 시 삼각 프로파일: 목표 속도에 도달 못하고 중간 피크에서 감속
        const actualPeakSpeed = Math.sqrt(d * a);
        const accelTime = actualPeakSpeed / a;
        const totalTime = 2 * accelTime;
        return {
            valid: true,
            profile: 'triangle',
            actualPeakSpeed,
            accelTime,
            cruiseTime: 0,
            decelTime: accelTime,
            totalTime
        };
    }, [targetSpeed, acceleration, distance]);

    const profilePoints = useMemo(() => {
        if (!result.valid || result.totalTime <= 0) return '';
        const width = 560;
        const height = 180;
        const leftPad = 30;
        const rightPad = 10;
        const topPad = 12;
        const bottomPad = 22;
        const chartW = width - leftPad - rightPad;
        const chartH = height - topPad - bottomPad;

        const totalTime = result.totalTime;
        const peakV = Math.max(1, result.actualPeakSpeed);
        const accelEnd = result.accelTime;
        const cruiseEnd = result.accelTime + result.cruiseTime;
        const sampleCount = 72;
        const smoothStep = (x) => (3 * x * x) - (2 * x * x * x);

        const points = Array.from({ length: sampleCount }, (_, i) => {
            const t = (i / (sampleCount - 1)) * totalTime;
            let vel = 0;

            if (t <= accelEnd) {
                const p = accelEnd > 0 ? Math.max(0, Math.min(1, t / accelEnd)) : 1;
                vel = peakV * smoothStep(p);
            } else if (t <= cruiseEnd) {
                vel = peakV;
            } else {
                const remain = Math.max(0, totalTime - cruiseEnd);
                const p = remain > 0 ? Math.max(0, Math.min(1, (t - cruiseEnd) / remain)) : 1;
                vel = peakV * (1 - smoothStep(p));
            }

            const x = leftPad + (t / totalTime) * chartW;
            const y = topPad + ((peakV - vel) / peakV) * chartH;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });

        return points.join(' ');
    }, [result]);

    return (
        <ToolCard
            theme={theme}
            icon={Gauge}
            title="모션 프로파일 계산기"
            subtitle="속도/가속도/이동거리 기반 실제 동작 시간 + 포물선형 프로파일"
            accent="text-indigo-400"
        >
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                        type="number"
                        value={targetSpeed}
                        onChange={(e) => setTargetSpeed(e.target.value)}
                        placeholder="출력 속도 (mm/s)"
                        className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                    <input
                        type="number"
                        value={acceleration}
                        onChange={(e) => setAcceleration(e.target.value)}
                        placeholder="가속도 (mm/s²)"
                        className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                    <input
                        type="number"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        placeholder="이동 길이 (mm)"
                        className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-2">
                        <div className="text-slate-500">프로파일</div>
                        <div className="font-black text-indigo-500">{result.profile === 'trapezoid' ? '사다리꼴' : result.profile === 'triangle' ? '삼각' : '-'}</div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-2">
                        <div className="text-slate-500">실제 최고속도</div>
                        <div className="font-black text-indigo-500">{result.valid ? `${result.actualPeakSpeed.toFixed(2)} mm/s` : '-'}</div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-2">
                        <div className="text-slate-500">최고속도 유지</div>
                        <div className="font-black text-indigo-500">{result.valid ? `${result.cruiseTime.toFixed(3)} s` : '-'}</div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-2">
                        <div className="text-slate-500">총 이동 시간</div>
                        <div className="font-black text-indigo-500">{result.valid ? `${result.totalTime.toFixed(3)} s` : '-'}</div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-2.5">
                    <svg viewBox="0 0 560 180" className="w-full h-40">
                        <line x1="30" y1="12" x2="30" y2="158" className="stroke-slate-300 dark:stroke-slate-700" />
                        <line x1="30" y1="158" x2="550" y2="158" className="stroke-slate-300 dark:stroke-slate-700" />
                        <text x="34" y="24" className="fill-slate-400 text-[10px]">v(mm/s)</text>
                        <text x="505" y="173" className="fill-slate-400 text-[10px]">t(s)</text>
                        {result.valid && (
                            <polyline
                                points={profilePoints}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-indigo-500"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        )}
                    </svg>
                </div>
                <div className="text-[11px] text-slate-500">
                    그래프는 실제 구동 체감에 맞게 저크 완화(S-curve)로 시각화됩니다.
                </div>
            </div>
        </ToolCard>
    );
};

const Tools = () => {
    const { theme } = useTheme();

    return (
        <div className="page-shell">
            <header className="premium-card">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 animate-glow-pulse">
                            <Bot className="w-6 h-6 md:w-8 md:h-8 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-4xl font-black gradient-primary gradient-text">도구 랩</h1>
                            <p className="text-sm md:text-base text-slate-500 mt-1 break-words">캘리브레이션, 진단, G-code 생성까지 한 화면에서 처리</p>
                        </div>
                    </div>
                    <div className={cn('rounded-xl border px-3 py-2 text-xs md:text-sm inline-flex items-center gap-2 self-start md:self-auto break-words', theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900/50 border-slate-700 text-slate-300')}>
                        <Info className="w-4 h-4" />
                        명령은 반드시 프린터 상태를 확인한 뒤 실행하세요.
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
                <EStepCalculator theme={theme} />
                <FlowRateCalculator theme={theme} />
                <PIDBuilder theme={theme} />
                <RetractionAdvisor theme={theme} />
                <DryingPlanner theme={theme} />
                <NozzleWearEstimator theme={theme} />
                <CalibrationPlanner theme={theme} />
                <FailureTriage theme={theme} />
                <ToolRecipes theme={theme} />
                <MotionProfileCalculator theme={theme} />
            </div>
        </div>
    );
};

export default Tools;
