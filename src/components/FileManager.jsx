import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileCode, Play, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { getGcodeFiles, startPrint, uploadGcodeFile, subscribePrinterObjectsRealtime } from '../utils/moonrakerApi';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';

const FileManager = ({ className }) => {
    const { theme } = useTheme();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [printConfirmFile, setPrintConfirmFile] = useState(null);
    const refreshTimerRef = useRef(null);
    // 파일 목록 로드
    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getGcodeFiles();
            if (response.success && response.result) {
                // 날짜 내림차순 정렬
                const sortedFiles = response.result.sort((a, b) => b.modified - a.modified);
                setFiles(sortedFiles);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        const scheduleRefresh = () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
            refreshTimerRef.current = setTimeout(() => {
                loadFiles();
            }, 250);
        };

        const unsubscribeRealtime = subscribePrinterObjectsRealtime({
            objects: ['print_stats'],
            onNotify: (method) => {
                if (!method) return;
                const shouldRefresh =
                    method === 'notify_filelist_changed' ||
                    method === 'notify_metadata_update';
                if (shouldRefresh) {
                    scheduleRefresh();
                }
            }
        });

        return () => {
            unsubscribeRealtime?.();
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [loadFiles]);

    // 파일 업로드 핸들러
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await handleUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = async (e) => {
        if (e.target.files && e.target.files[0]) {
            await handleUpload(e.target.files[0]);
        }
    };

    const handleUpload = async (file) => {
        if (!file.name.toLowerCase().endsWith('.gcode')) {
            alert('G-code 파일만 업로드 가능합니다.');
            return;
        }

        setUploading(true);

        try {
            const response = await uploadGcodeFile(file, 'gcodes');
            if (response.success) {
                alert('파일 업로드 성공!');
                loadFiles();
            } else {
                throw new Error(response.error || 'Upload failed');
            }
        } catch (error) {
            alert('업로드 실패: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    // 출력 시작 요청 (모달 열기)
    const handlePrint = (e, filename) => {
        e.stopPropagation();
        e.preventDefault();
        setPrintConfirmFile(filename);
    };

    // 실제 출력 시작 (모달 확인)
    const confirmPrint = async () => {
        if (!printConfirmFile) return;

        try {
            const response = await startPrint(printConfirmFile);
            if (response.success) {
                alert('출력이 시작되었습니다! 홈 화면으로 이동하여 모니터링하세요.');
            } else {
                alert('출력 시작 실패: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            alert('출력 요청 에러: ' + error.message);
        } finally {
            setPrintConfirmFile(null);
        }
    };

    return (
        <div className={cn("space-y-4 flex flex-col relative", className)}>
            {/* 드래그 앤 드롭 영역 */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer shrink-0",
                    dragActive
                        ? "border-cyan-500 bg-cyan-500/10"
                        : theme === 'dark'
                            ? "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
                            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
                    uploading && "opacity-50 pointer-events-none"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload').click()}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".gcode"
                    onChange={handleFileInput}
                />
                <div className="flex flex-col items-center gap-2">
                    {uploading ? (
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    ) : (
                        <Upload className={cn("w-8 h-8", theme === 'dark' ? "text-slate-400" : "text-slate-500")} />
                    )}
                    <div>
                        <p className={cn("text-base font-bold", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>
                            {uploading ? '업로드 중...' : 'G-Code 업로드'}
                        </p>
                    </div>
                </div>
            </div>

            {/* 파일 목록 */}
            <div className={cn(
                "border rounded-xl overflow-hidden flex-1 min-h-0 flex flex-col transition-all",
                theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
                <div className={cn(
                    "p-4 border-b sticky top-0 backdrop-blur-sm z-10 flex justify-between items-center",
                    theme === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
                )}>
                    <h3 className={cn("font-bold flex items-center gap-2", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>
                        <FileCode className={cn("w-4 h-4", theme === 'dark' ? "text-cyan-400" : "text-blue-500")} />
                        파일 목록 ({files.length})
                    </h3>
                    <button
                        onClick={loadFiles}
                        disabled={loading}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                        )}
                    >
                        <Loader2 className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>

                <div className={cn("divide-y", theme === 'dark' ? "divide-slate-800" : "divide-slate-100")}>
                    {loading && files.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            파일 목록을 불러오는 중...
                        </div>
                    ) : files.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            업로드된 파일이 없습니다.
                        </div>
                    ) : (
                        files.map((file) => (
                            <div key={file.path} className={cn(
                                "p-4 flex items-center justify-between transition-colors group",
                                theme === 'dark' ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                            )}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        theme === 'dark' ? "bg-slate-800" : "bg-slate-100"
                                    )}>
                                        <FileCode className={cn(
                                            "w-5 h-5 transition-colors",
                                            theme === 'dark' ? "text-slate-500 group-hover:text-cyan-400" : "text-slate-400 group-hover:text-blue-500"
                                        )} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={cn(
                                            "font-bold truncate text-sm md:text-base",
                                            theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                        )}>
                                            {file.path}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.modified * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={(e) => handlePrint(e, file.path)}
                                        className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                        title="출력 시작"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 출력 확인 모달 (커스텀) */}
            {printConfirmFile && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPrintConfirmFile(null)}>
                    <div
                        className={cn(
                            "w-full max-w-md p-6 rounded-2xl shadow-2xl scale-100 transform transition-transform m-4",
                            theme === 'dark' ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-slate-800")}>
                            출력 시작 확인
                        </h3>
                        <p className={cn("mb-6", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                            다음 파일의 출력을 시작하시겠습니까?<br />
                            <span className={cn("font-mono font-bold block mt-2 p-2 rounded", theme === 'dark' ? "bg-slate-800 text-cyan-400" : "bg-slate-100 text-blue-600")}>
                                {printConfirmFile}
                            </span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setPrintConfirmFile(null)}
                                className={cn(
                                    "px-4 py-2 rounded-lg font-medium transition-colors",
                                    theme === 'dark' ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmPrint}
                                className="px-6 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20"
                            >
                                출력 시작
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileManager;
