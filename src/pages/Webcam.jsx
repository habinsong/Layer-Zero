import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Camera, Maximize2, Minimize2, Zap, Loader2, Aperture, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { APP_ENV } from '../config/env';

const ROTATION_OPTIONS = [0, 90, 180, 270];
const ACTIVE_CAM_KEY = 'webcam-active-cam';
const ROTATION_KEY = 'webcam-rotation';
const MIRROR_KEY = 'webcam-mirror-x';

function normalizeCaptureUrl(rawUrl) {
    if (!rawUrl) return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.includes('/capture_flash')) return trimmed.split('?')[0];
    return `${trimmed.replace(/\/$/, '')}/capture_flash`;
}

const Webcam = () => {
    const { settings, updateSettings } = useSettings();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const didHydrateServerPrefsRef = useRef(false);

    const [activeCam, setActiveCam] = useState(() => {
        const saved = Number(localStorage.getItem(ACTIVE_CAM_KEY));
        return saved === 2 ? 2 : 1;
    });

    const primaryCamUrl = settings.webcamUrl || APP_ENV.defaultWebcamUrl || '';
    const secondaryCamUrl = settings.webcamUrl2 || '';
    const hasSecondCam = Boolean(secondaryCamUrl.trim());
    const baseUrl = activeCam === 2 && hasSecondCam ? secondaryCamUrl : primaryCamUrl;

    const [imgSrc, setImgSrc] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const [rotation, setRotation] = useState(() => {
        const saved = Number(localStorage.getItem(ROTATION_KEY));
        if (ROTATION_OPTIONS.includes(saved)) return saved;
        const preferred = Number(settings.webcamDefaultRotation);
        return ROTATION_OPTIONS.includes(preferred) ? preferred : 90;
    });

    const [isMirrored, setIsMirrored] = useState(() => {
        const saved = localStorage.getItem(MIRROR_KEY);
        if (saved !== null) return saved === 'true';
        return settings.webcamMirrorX === true;
    });

    const [enhanceEnabled, setEnhanceEnabled] = useState(true);
    const [upscale, setUpscale] = useState(2);
    const [denoise, setDenoise] = useState(0.8);
    const [contrast, setContrast] = useState(10);
    const [brightness, setBrightness] = useState(2);
    const [saturate, setSaturate] = useState(6);

    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const processedCanvasRef = useRef(null);

    useEffect(() => {
        if (didHydrateServerPrefsRef.current) return;
        const hasRemotePref =
            settings.webcamActiveCam !== undefined ||
            settings.webcamRotation !== undefined ||
            settings.webcamMirrorXView !== undefined ||
            settings.webcamEnhanceEnabled !== undefined;
        if (!hasRemotePref) return;

        didHydrateServerPrefsRef.current = true;
        const remoteCam = Number(settings.webcamActiveCam);
        const remoteRot = Number(settings.webcamRotation);
        const remoteMirror = settings.webcamMirrorXView;
        const remoteEnhance = settings.webcamEnhanceEnabled;
        const remoteUpscale = Number(settings.webcamUpscale);
        const remoteDenoise = Number(settings.webcamDenoise);
        const remoteContrast = Number(settings.webcamContrast);
        const remoteBrightness = Number(settings.webcamBrightness);
        const remoteSaturate = Number(settings.webcamSaturate);

        if (remoteCam === 1 || remoteCam === 2) setActiveCam(remoteCam);
        if (ROTATION_OPTIONS.includes(remoteRot)) setRotation(remoteRot);
        if (typeof remoteMirror === 'boolean') setIsMirrored(remoteMirror);
        if (typeof remoteEnhance === 'boolean') setEnhanceEnabled(remoteEnhance);
        if (Number.isFinite(remoteUpscale) && remoteUpscale >= 1 && remoteUpscale <= 4) setUpscale(remoteUpscale);
        if (Number.isFinite(remoteDenoise) && remoteDenoise >= 0 && remoteDenoise <= 2) setDenoise(remoteDenoise);
        if (Number.isFinite(remoteContrast) && remoteContrast >= -20 && remoteContrast <= 30) setContrast(remoteContrast);
        if (Number.isFinite(remoteBrightness) && remoteBrightness >= -20 && remoteBrightness <= 20) setBrightness(remoteBrightness);
        if (Number.isFinite(remoteSaturate) && remoteSaturate >= -20 && remoteSaturate <= 30) setSaturate(remoteSaturate);
    }, [settings]);

    useEffect(() => {
        localStorage.setItem(ROTATION_KEY, String(rotation));
    }, [rotation]);

    useEffect(() => {
        localStorage.setItem(MIRROR_KEY, String(isMirrored));
    }, [isMirrored]);

    useEffect(() => {
        localStorage.setItem(ACTIVE_CAM_KEY, String(activeCam));
    }, [activeCam]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateSettings({
                webcamActiveCam: activeCam,
                webcamRotation: rotation,
                webcamMirrorXView: isMirrored,
                webcamEnhanceEnabled: enhanceEnabled,
                webcamUpscale: upscale,
                webcamDenoise: denoise,
                webcamContrast: contrast,
                webcamBrightness: brightness,
                webcamSaturate: saturate
            });
        }, 350);
        return () => clearTimeout(timer);
    }, [
        activeCam,
        rotation,
        isMirrored,
        enhanceEnabled,
        upscale,
        denoise,
        contrast,
        brightness,
        saturate
    ]);

    useEffect(() => {
        if (!hasSecondCam && activeCam === 2) setActiveCam(1);
    }, [hasSecondCam, activeCam]);

    const updateImageSource = useCallback(() => {
        setLoading(true);
        setHasError(false);
        const normalized = normalizeCaptureUrl(baseUrl);
        if (!normalized) {
            setLoading(false);
            setHasError(true);
            return;
        }
        setImgSrc(`${normalized}?t=${Date.now()}`);
    }, [baseUrl]);

    const handleImageLoad = (e) => {
        const imageEl = e.currentTarget;
        setImageSize({
            width: imageEl.naturalWidth || 0,
            height: imageEl.naturalHeight || 0
        });

        if (enhanceEnabled) {
            try {
                const canvas = processedCanvasRef.current;
                if (canvas && imageEl.naturalWidth && imageEl.naturalHeight) {
                    const targetWidth = Math.max(1, Math.round(imageEl.naturalWidth * upscale));
                    const targetHeight = Math.max(1, Math.round(imageEl.naturalHeight * upscale));
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    const ctx = canvas.getContext('2d', { alpha: false });
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.clearRect(0, 0, targetWidth, targetHeight);
                        ctx.filter = 'none';
                        ctx.drawImage(imageEl, 0, 0, targetWidth, targetHeight);
                    }
                }
            } catch (error) {
                console.error('웹캠 후처리 렌더 실패:', error);
            }
        }

        setLoading(false);
        setHasError(false);
    };

    const handleImageError = () => {
        setImageSize({ width: 0, height: 0 });
        setLoading(false);
        setHasError(true);
    };

    const viewerAspectRatio = useMemo(() => {
        const { width, height } = imageSize;
        if (!width || !height) return 16 / 9;
        return rotation % 180 === 0 ? width / height : height / width;
    }, [rotation, imageSize]);

    const visualFilter = useMemo(() => {
        if (!enhanceEnabled) return 'none';
        const filters = [
            `brightness(${100 + brightness}%)`,
            `contrast(${100 + contrast}%)`,
            `saturate(${100 + saturate}%)`
        ];
        if (denoise > 0) filters.push(`blur(${denoise}px)`);
        return filters.join(' ');
    }, [enhanceEnabled, brightness, contrast, saturate, denoise]);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;
        try {
            if (!isFullscreen) await containerRef.current.requestFullscreen();
            else await document.exitFullscreen();
        } catch (error) {
            console.error('전체화면 전환 실패:', error);
        }
    };

    const handleSnapshot = useCallback(async () => {
        if (!imgSrc || hasError) return;

        if (enhanceEnabled && processedCanvasRef.current) {
            try {
                const canvas = processedCanvasRef.current;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `snapshot_enhanced_${Date.now()}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            } catch (error) {
                console.warn('보정 이미지 저장 실패, 원본 저장으로 폴백:', error);
            }
        }

        try {
            const response = await fetch(imgSrc);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `snapshot_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('스냅샷 다운로드 실패:', error);
            alert('스냅샷 다운로드에 실패했습니다.');
        }
    }, [enhanceEnabled, hasError, imgSrc]);

    useEffect(() => {
        if (!enhanceEnabled) return;
        const imageEl = imageRef.current;
        if (!imageEl || !imageEl.complete || !imageEl.naturalWidth) return;
        handleImageLoad({ currentTarget: imageEl });
    }, [enhanceEnabled, upscale, denoise, contrast, brightness, saturate]);

    return (
        <div className="w-full animate-fade-in flex flex-col gap-3 md:gap-4">
            <div className="premium-card p-3 md:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-3xl font-black gradient-text gradient-primary leading-tight">실시간 웹캠</h1>
                        <p className="text-[11px] md:text-sm text-slate-500 mt-0.5 tracking-wide">MANUAL SNAPSHOT MODE · CAM {activeCam}</p>
                    </div>
                    <button
                        onClick={toggleFullscreen}
                        className={cn(
                            "px-3 py-2 rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm border font-bold shrink-0",
                            isDark
                                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                        )}
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        <span>전체화면</span>
                    </button>
                </div>

                <div className={cn('grid grid-cols-3 gap-2', isDark ? '' : '')}>
                    <button
                        onClick={updateImageSource}
                        disabled={loading}
                        className="px-3 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm font-bold disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Aperture className="w-4 h-4" />}
                        찍기
                    </button>
                    <button
                        onClick={handleSnapshot}
                        disabled={!imgSrc || hasError || loading}
                        className="px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Camera className="w-4 h-4" /> 저장
                    </button>
                    <button
                        onClick={() => setEnhanceEnabled((v) => !v)}
                        className={cn(
                            "px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold border inline-flex items-center justify-center gap-1.5",
                            enhanceEnabled
                                ? "bg-emerald-600 text-white border-emerald-500"
                                : isDark
                                    ? "bg-slate-800 text-slate-300 border-slate-700"
                                    : "bg-slate-100 text-slate-700 border-slate-300"
                        )}
                    >
                        <Sparkles className="w-3.5 h-3.5" /> 보정
                    </button>
                </div>

                <div className={cn(
                    'grid grid-cols-2 md:grid-cols-8 gap-1.5 p-1.5 rounded-xl border',
                    isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'
                )}>
                    <button
                        onClick={() => setActiveCam(1)}
                        className={cn(
                            "px-2 py-2 rounded-lg text-xs font-bold transition-all",
                            activeCam === 1 ? "bg-indigo-500 text-white" : (isDark ? "text-slate-300 hover:bg-slate-700/60" : "text-slate-700 hover:bg-slate-200")
                        )}
                    >
                        CAM1
                    </button>
                    <button
                        onClick={() => setActiveCam(2)}
                        disabled={!hasSecondCam}
                        className={cn(
                            "px-2 py-2 rounded-lg text-xs font-bold transition-all",
                            activeCam === 2 ? "bg-indigo-500 text-white" : (isDark ? "text-slate-300 hover:bg-slate-700/60" : "text-slate-700 hover:bg-slate-200"),
                            !hasSecondCam && "opacity-40 cursor-not-allowed hover:bg-transparent"
                        )}
                    >
                        CAM2
                    </button>
                    {ROTATION_OPTIONS.map((deg) => (
                        <button
                            key={deg}
                            onClick={() => setRotation(deg)}
                            className={cn(
                                "px-2 py-2 rounded-lg text-xs font-bold transition-all",
                                rotation === deg ? "bg-cyan-500 text-white" : (isDark ? "text-slate-300 hover:bg-slate-700/60" : "text-slate-700 hover:bg-slate-200")
                            )}
                        >
                            {deg}°
                        </button>
                    ))}
                    <button
                        onClick={() => setIsMirrored((prev) => !prev)}
                        className={cn(
                            "px-2 py-2 rounded-lg text-xs font-bold transition-all md:col-span-2",
                            isMirrored ? "bg-emerald-500 text-white" : (isDark ? "text-slate-300 hover:bg-slate-700/60" : "text-slate-700 hover:bg-slate-200")
                        )}
                    >
                        좌/우 반전
                    </button>
                </div>

                <details className={cn('rounded-xl border p-2.5', isDark ? 'bg-slate-900/30 border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
                    <summary className="list-none cursor-pointer flex items-center justify-between gap-2 text-xs font-bold text-slate-500 select-none">
                        보정 세부 설정
                        <ChevronDown className="w-4 h-4" />
                    </summary>
                    <div className="mt-2.5 grid grid-cols-2 md:grid-cols-5 gap-2">
                        <label className={cn('px-2 py-1.5 rounded-lg border text-[11px]', isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                            업스케일 {upscale.toFixed(1)}x
                            <input type="range" min="1" max="3" step="0.5" value={upscale} onChange={(e) => setUpscale(Number(e.target.value))} className="w-full mt-1" />
                        </label>
                        <label className={cn('px-2 py-1.5 rounded-lg border text-[11px]', isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                            노이즈 {denoise.toFixed(1)}
                            <input type="range" min="0" max="2" step="0.2" value={denoise} onChange={(e) => setDenoise(Number(e.target.value))} className="w-full mt-1" />
                        </label>
                        <label className={cn('px-2 py-1.5 rounded-lg border text-[11px]', isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                            대비 {contrast}
                            <input type="range" min="-20" max="40" step="2" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full mt-1" />
                        </label>
                        <label className={cn('px-2 py-1.5 rounded-lg border text-[11px]', isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                            밝기 {brightness}
                            <input type="range" min="-20" max="20" step="1" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full mt-1" />
                        </label>
                        <label className={cn('px-2 py-1.5 rounded-lg border text-[11px]', isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}>
                            채도 {saturate}
                            <input type="range" min="-20" max="30" step="1" value={saturate} onChange={(e) => setSaturate(Number(e.target.value))} className="w-full mt-1" />
                        </label>
                    </div>
                </details>
            </div>

            <div className="premium-card p-2 md:p-3">
                <div className="w-full h-[60vh] min-h-[260px] max-h-[calc(100vh-260px)] flex items-center justify-center">
                    <div
                        ref={containerRef}
                        className="bg-black rounded-xl overflow-hidden relative group h-full max-w-full"
                        style={{ aspectRatio: viewerAspectRatio }}
                    >
                        {!imgSrc ? (
                            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center animate-pulse">
                                <Aperture className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-xl font-bold mb-2 text-slate-400">대기 중</p>
                                <p className="text-sm text-slate-500 mb-4">상단의 '찍기' 버튼을 눌러 촬영하세요.</p>
                            </div>
                        ) : hasError ? (
                            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                                <Camera className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-xl font-bold mb-2 text-slate-400">촬영 실패</p>
                                <p className="text-sm text-slate-500 mb-4">선택한 웹캠(CAM {activeCam}) 연결 상태를 확인해주세요.</p>
                                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                    <p className="text-xs font-mono text-cyan-400 break-all">{baseUrl}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {enhanceEnabled && (
                                    <img
                                        ref={imageRef}
                                        src={imgSrc}
                                        alt="Live Feed Hidden Source"
                                        className="absolute w-px h-px opacity-0 pointer-events-none"
                                        onLoad={handleImageLoad}
                                        onError={handleImageError}
                                    />
                                )}
                                {enhanceEnabled ? (
                                    <canvas
                                        ref={processedCanvasRef}
                                        className={cn(
                                            "w-full h-full object-contain transition-all duration-300",
                                            loading ? "opacity-50 blur-sm scale-[0.98]" : "opacity-100 scale-100"
                                        )}
                                        style={{
                                            objectFit: 'contain',
                                            transform: `${isMirrored ? 'scaleX(-1) ' : ''}rotate(${rotation}deg)`.trim(),
                                            filter: visualFilter
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={imgSrc}
                                        alt="Live Feed"
                                        className={cn(
                                            "w-full h-full object-contain transition-all duration-300",
                                            loading ? "opacity-50 blur-sm scale-[0.98]" : "opacity-100 scale-100"
                                        )}
                                        style={{
                                            objectFit: 'contain',
                                            transform: `${isMirrored ? 'scaleX(-1) ' : ''}rotate(${rotation}deg)`.trim()
                                        }}
                                        onLoad={handleImageLoad}
                                        onError={handleImageError}
                                    />
                                )}
                            </>
                        )}

                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                <div className="bg-black/40 p-6 rounded-2xl backdrop-blur-md border border-white/10 flex flex-col items-center gap-3">
                                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                                    <span className="text-white font-bold text-sm tracking-wider">SHOOTING...</span>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="absolute inset-0 bg-white animate-[flash_0.2s_ease-out_forwards] pointer-events-none opacity-10" />
                        )}
                    </div>
                </div>
            </div>

            <div className={cn(
                'p-3 md:p-4 rounded-xl flex items-start gap-3 md:gap-4 border',
                isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
            )}>
                <div className={cn('p-2.5 rounded-lg shrink-0', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
                    <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <h3 className="font-bold text-blue-500 mb-1">수동 촬영 + 보정 모드</h3>
                    <p className={cn('text-xs md:text-sm leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
                        상단 컨트롤은 자주 쓰는 기능만 남겼고, 보정 슬라이더는 접어둘 수 있습니다.
                        촬영 후 저장 시 보정 ON이면 보정본 저장을 우선 시도합니다.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Webcam;
