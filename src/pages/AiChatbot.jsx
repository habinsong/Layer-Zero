import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, AlertCircle, Loader2, RefreshCcw, Coins, Copy, Check, Zap, DollarSign, Paperclip, X, Image as ImageIcon, ArrowUpToLine } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../contexts/ThemeContext'; // Theme Hook Import
import { useSettings } from '../context/SettingsContext';
import { clearChatMessagesRemote, getChatMessagesRemote, saveChatMessagesRemote, subscribeServerEvents } from '../utils/centralApi';

// Gemini 3 Flash Preview Pricing (2025년 1월 기준)
// 입력: $0.0025 / 1,000자 (약 $1.00 / 1M tokens, 1 token ≈ 4자)
// 출력: $0.01 / 1,000자 (약 $4.00 / 1M tokens)
const COST_PER_1M_INPUT_TOKENS = 1.00;
const COST_PER_1M_OUTPUT_TOKENS = 4.00;

// Free Tier Limits for Gemini 3 Flash Preview
// Gemini 3 Flash Preview has very restrictive free tier limits (5-10 RPM, 20-100 RPD)
const FREE_TIER_DAILY_REQUESTS = 100; // Conservative limit for preview model
const FREE_TIER_RPM = 5; // Requests Per Minute - matching actual API limit
const CHAT_HISTORY_STORAGE_KEY = 'ai_chatbot_messages_v1';
const MOBILE_FONT_SCALE_STORAGE_KEY = 'ai_chatbot_mobile_font_scale_v1';
const FREE_MODEL_STORAGE_KEY = 'ai_chatbot_free_model_v1';
const PAID_MODEL_STORAGE_KEY = 'ai_chatbot_paid_model_v1';
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const FREE_MODEL_OPTIONS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'];
const PAID_MODEL_OPTIONS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview'];
const MODEL_LABELS = {
    'gemini-3-flash-preview': 'Flash',
    'gemini-3.1-flash-lite-preview': 'Flash Lite',
    'gemini-3.1-pro-preview': 'Pro 3.1'
};
const INITIAL_ASSISTANT_MESSAGE = {
    role: 'model',
    text: '안녕하세요! 저는 3D 프린팅 전문가 AI입니다.\n트러블슈팅, 소재, 부품, 출력 품질 등 무엇이든 물어보세요.'
};

function normalizeUsageData(raw) {
    const today = new Date().toLocaleDateString();
    const estimatedFreeCost = Number(raw?.estimatedFreeCost ?? raw?.totalCost ?? 0);
    const paidTotalCost = Number(raw?.paidTotalCost ?? 0);
    const sameDay = raw?.date === today;

    return {
        date: today,
        dailyRequests: sameDay ? Number(raw?.dailyRequests ?? 0) : 0,
        requestTimestamps: sameDay ? (Array.isArray(raw?.requestTimestamps) ? raw.requestTimestamps : []) : [],
        dailyTokens: sameDay ? Number(raw?.dailyTokens ?? 0) : 0,
        estimatedFreeCost,
        paidTotalCost
    };
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
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

// Custom Code Block Component with Copy functionality
const CodeBlock = ({ inline, className, children, ...props }) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (inline) {
        return (
            <code className={cn("bg-slate-700/50 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-sm", className)} {...props}>
                {children}
            </code>
        );
    }

    return (
        <div className="relative my-4 group rounded-xl overflow-hidden border border-slate-700/50 bg-[#1e1e1e]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-slate-700/50">
                <span className="text-xs text-slate-400 font-mono uppercase">{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-slate-600 rounded-md transition-colors text-slate-400 hover:text-white"
                    title="Copy code"
                >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>
            <div className="p-4 overflow-x-auto custom-scrollbar">
                <code className={cn("font-mono text-sm text-slate-200", className)} {...props}>
                    {children}
                </code>
            </div>
        </div>
    );
};

const AiChatbot = () => {
    const { theme } = useTheme(); // Use Theme Hook
    const { settings, updateSettings } = useSettings();
    // Mode State: 'free' | 'paid'
    const [mode, setMode] = useState('free');

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState(() => {
        try {
            const stored = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
            if (!stored) return [INITIAL_ASSISTANT_MESSAGE];
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return [INITIAL_ASSISTANT_MESSAGE];
            }
            return parsed;
        } catch (e) {
            console.error('[AI Chatbot] Failed to load chat history:', e);
            return [INITIAL_ASSISTANT_MESSAGE];
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
    const [mobileFontScale, setMobileFontScale] = useState(() => {
        const fromServer = Number(settings.aiMobileFontScale);
        if ([0.9, 0.95, 1].includes(fromServer)) return fromServer;
        const saved = Number(localStorage.getItem(MOBILE_FONT_SCALE_STORAGE_KEY));
        if ([0.9, 0.95, 1].includes(saved)) return saved;
        return window.innerWidth < 768 ? 0.95 : 1; // 모바일 기본은 약간 작게, PC는 기본 크기
    });
    const [isLatestCopied, setIsLatestCopied] = useState(false);
    const [freeModel, setFreeModel] = useState(() => {
        const fromServer = settings.aiFreeModel;
        if (FREE_MODEL_OPTIONS.includes(fromServer)) return fromServer;
        const saved = localStorage.getItem(FREE_MODEL_STORAGE_KEY);
        return FREE_MODEL_OPTIONS.includes(saved) ? saved : DEFAULT_MODEL;
    });
    const [paidModel, setPaidModel] = useState(() => {
        const fromServer = settings.aiPaidModel;
        if (PAID_MODEL_OPTIONS.includes(fromServer)) return fromServer;
        const saved = localStorage.getItem(PAID_MODEL_STORAGE_KEY);
        return PAID_MODEL_OPTIONS.includes(saved) ? saved : DEFAULT_MODEL;
    });
    const [selectedImage, setSelectedImage] = useState(null); // { file, preview, base64 }
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const messagesRef = useRef(messages);

    // Persistent State for Usage (날짜별 리셋 + 영구 누적)
    const [usageData, setUsageData] = useState(() => {
        // Lazy initialization: 컴포넌트 마운트 시 한 번만 실행
        const fromServer = settings.aiUsageData;
        if (fromServer && typeof fromServer === 'object') {
            return normalizeUsageData(fromServer);
        }
        const storedData = localStorage.getItem('ai_chatbot_usage_v2');
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                const normalized = normalizeUsageData(parsed);
                return normalized;
            } catch (e) {
                console.error('[AI Chatbot INIT] Failed to parse usage data:', e);
            }
        }

        return {
            date: new Date().toLocaleDateString(),
            dailyRequests: 0,
            requestTimestamps: [],
            dailyTokens: 0,
            estimatedFreeCost: 0,
            paidTotalCost: 0
        };
    });

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (settings.aiUsageData && typeof settings.aiUsageData === 'object') {
            setUsageData(normalizeUsageData(settings.aiUsageData));
        }
        if ([0.9, 0.95, 1].includes(Number(settings.aiMobileFontScale))) {
            setMobileFontScale(Number(settings.aiMobileFontScale));
        }
        if (FREE_MODEL_OPTIONS.includes(settings.aiFreeModel)) {
            setFreeModel(settings.aiFreeModel);
        }
        if (PAID_MODEL_OPTIONS.includes(settings.aiPaidModel)) {
            setPaidModel(settings.aiPaidModel);
        }
    }, [settings.aiUsageData, settings.aiMobileFontScale, settings.aiFreeModel, settings.aiPaidModel]);

    // Save to localStorage whenever usageData changes
    useEffect(() => {
        localStorage.setItem('ai_chatbot_usage_v2', JSON.stringify(usageData));
    }, [usageData]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateSettings({ aiUsageData: usageData });
        }, 400);
        return () => clearTimeout(timer);
    }, [usageData, updateSettings]);

    // Save chat history to localStorage
    useEffect(() => {
        try {
            // 이미지(base64)는 저장 용량을 크게 소모하므로 텍스트 대화 위주로만 저장
            const serializableMessages = messages.map(({ role, text }) => ({ role, text }));
            localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(serializableMessages));
        } catch (e) {
            console.error('[AI Chatbot] Failed to save chat history:', e);
        }
    }, [messages]);

    // Load from backend (if available)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const remoteMessages = await getChatMessagesRemote();
                if (!cancelled && Array.isArray(remoteMessages) && remoteMessages.length > 0) {
                    setMessages(remoteMessages);
                }
            } catch {
                // offline/local fallback mode
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Sync to backend with debounce (avoid per-token flood while streaming)
    useEffect(() => {
        if (isLoading) return undefined;
        const timer = setTimeout(() => {
            const serializableMessages = messages.map(({ role, text }) => ({ role, text }));
            saveChatMessagesRemote(serializableMessages).catch(() => {
                // offline/local fallback mode
            });
        }, 900);
        return () => clearTimeout(timer);
    }, [messages, isLoading]);

    useEffect(() => {
        const unsubscribe = subscribeServerEvents((event) => {
            if (!event || event.type !== 'chat.messages.updated') return;
            if (isLoading) return;
            if (Array.isArray(event.items)) {
                const currentSerialized = JSON.stringify(messagesRef.current || []);
                const remoteSerialized = JSON.stringify(event.items);
                if (currentSerialized !== remoteSerialized) {
                    setMessages(event.items.length > 0 ? event.items : [INITIAL_ASSISTANT_MESSAGE]);
                }
                return;
            }
            getChatMessagesRemote()
                .then((remoteMessages) => {
                    if (!Array.isArray(remoteMessages)) return;
                    const currentSerialized = JSON.stringify(messagesRef.current || []);
                    const remoteSerialized = JSON.stringify(remoteMessages);
                    if (currentSerialized !== remoteSerialized) {
                        setMessages(remoteMessages.length > 0 ? remoteMessages : [INITIAL_ASSISTANT_MESSAGE]);
                    }
                })
                .catch(() => {
                    // offline/local fallback mode
                });
        });
        return () => unsubscribe();
    }, [isLoading]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, error]);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setIsHeaderCollapsed(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        localStorage.setItem(MOBILE_FONT_SCALE_STORAGE_KEY, String(mobileFontScale));
    }, [mobileFontScale]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateSettings({ aiMobileFontScale: mobileFontScale });
        }, 350);
        return () => clearTimeout(timer);
    }, [mobileFontScale, updateSettings]);

    useEffect(() => {
        localStorage.setItem(FREE_MODEL_STORAGE_KEY, freeModel);
    }, [freeModel]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateSettings({ aiFreeModel: freeModel });
        }, 350);
        return () => clearTimeout(timer);
    }, [freeModel, updateSettings]);

    useEffect(() => {
        localStorage.setItem(PAID_MODEL_STORAGE_KEY, paidModel);
    }, [paidModel]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateSettings({ aiPaidModel: paidModel });
        }, 350);
        return () => clearTimeout(timer);
    }, [paidModel, updateSettings]);

    const handleMessagesScroll = (e) => {
        setIsHeaderCollapsed(e.currentTarget.scrollTop > 20);
    };
    const isCompactMobileUI = isMobile && isHeaderCollapsed;
    const selectedModel = mode === 'paid' ? paidModel : freeModel;
    const selectedModelOptions = mode === 'paid' ? PAID_MODEL_OPTIONS : FREE_MODEL_OPTIONS;

    const scrollToTop = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const copyLatestModelAnswer = async () => {
        const latestModelMessage = [...messages].reverse().find((m) => m.role === 'model' && m.text?.trim());
        if (!latestModelMessage) {
            setError('복사할 답변이 없습니다.');
            return;
        }
        try {
            const textToCopy = latestModelMessage.text;
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const copied = fallbackCopyText(textToCopy);
                if (!copied) throw new Error('fallback copy failed');
            }
            setIsLatestCopied(true);
            setTimeout(() => setIsLatestCopied(false), 1500);
        } catch {
            setError('클립보드 복사에 실패했습니다.');
        }
    };

    const summarizeLatestAnswer = async () => {
        const latestModelMessage = [...messages].reverse().find((m) => m.role === 'model' && m.text?.trim());
        if (!latestModelMessage) {
            setError('요약할 답변이 없습니다.');
            return;
        }
        const summaryPrompt = `다음 답변을 한국어로 핵심만 3~5개 불릿으로 간결하게 요약해줘. 표가 있으면 핵심 수치만 추려줘.\n\n원문:\n${latestModelMessage.text}`;
        await handleSend({
            prompt: summaryPrompt,
            userMessageText: '[요약] 최근 답변 핵심 요약'
        });
    };

    const regenerateLastAnswer = async () => {
        const lastUserMessage = [...messages].reverse().find(
            (m) => m.role === 'user' && m.text?.trim()
        );
        if (!lastUserMessage) {
            setError('재생성할 질문이 없습니다.');
            return;
        }
        const regeneratePrompt = `아래 원 질문에 대해 이전과 다른 접근으로 더 명확하고 실전적인 답변을 다시 작성해줘.\n\n원 질문:\n${lastUserMessage.text}`;
        await handleSend({
            prompt: regeneratePrompt,
            userMessageText: '[재생성] 이전 질문 다시 답변'
        });
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file) => {
        if (!file.type.startsWith('image/')) {
            setError('이미지 파일만 업로드 가능합니다.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError('이미지 크기는 5MB 이하여야 합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedImage({
                file,
                preview: reader.result,
                base64: reader.result.split(',')[1]
            });
            setError(null);
        };
        reader.readAsDataURL(file);
    };

    // Drag and Drop handlers
    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const onDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleSend = async (options = {}) => {
        const hasProgrammaticPrompt = typeof options.prompt === 'string' && options.prompt.trim().length > 0;
        if ((!input.trim() && !selectedImage) && !hasProgrammaticPrompt) return;
        if (isLoading) return;

        const currentInput = hasProgrammaticPrompt ? options.prompt.trim() : input;
        const currentImage = hasProgrammaticPrompt ? null : selectedImage;
        const userMessageText = options.userMessageText || currentInput;

        // UI Optimistic Update
        if (!hasProgrammaticPrompt) {
            setInput('');
            setSelectedImage(null);
        }
        setError(null);
        setMessages(prev => [...prev, { role: 'user', text: userMessageText, image: currentImage?.preview }]);
        setIsLoading(true);

        try {
            // Check API Key
            const apiKey = mode === 'free' ? settings.aiFreeApiKey : settings.aiPaidApiKey;
            if (!apiKey) {
                throw new Error("API 키가 설정되지 않았습니다.");
            }

            // Rate Limit (RPM)
            const now = Date.now();
            // 최근 1분간의 요청만 필터링
            const recentRequests = usageData.requestTimestamps.filter(t => now - t < 60000);

            if (mode === 'free') {
                // Check Daily Limit
                if (usageData.dailyRequests >= FREE_TIER_DAILY_REQUESTS) {
                    throw new Error(`일일 무료 요청 한도(${FREE_TIER_DAILY_REQUESTS}회)를 초과했습니다. 내일 다시 이용해주세요.`);
                }

                if (recentRequests.length >= FREE_TIER_RPM) {
                    throw new Error(`너무 빠르게 요청하셨습니다. (분당 ${FREE_TIER_RPM}회 제한, 현재 ${recentRequests.length}회 요청). 잠시 후 다시 시도해주세요.`);
                }
            }

            // Optimistically update usage count (timestamp is key for RPM)
            setUsageData(prev => ({
                ...prev,
                dailyRequests: mode === 'free' ? prev.dailyRequests + 1 : prev.dailyRequests,
                requestTimestamps: [...prev.requestTimestamps, now]
            }));


            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: selectedModel,
                systemInstruction: `# 🛠️ 3D 프린팅 전문 AI 솔루션 가이드

## 🎯 핵심 목표
- **즉각적인 문제 해결**: 사용자의 질문에 대해 가장 효율적이고 실용적인 솔루션 제공.
- **전문성 기반의 신뢰**: 정확한 용어와 검증된 데이터를 바탕으로 답변.

## 📝 답변 작성 원칙 (4원칙)
1. **두괄식 결론**: 핵심 답변을 최상단에 요약하여 제시.
2. **구조화된 가독성**: 긴 줄글 지양. **글머리 기호(Bullet points)**, **번호 매기기(Numbering)**, **표(Table)** 적극 활용.
3. **명확한 단계(Step-by-Step)**: 트러블슈팅 시 실행 순서를 명확히 구분.
4. **시각적 강조**: 중요한 값(온도, 속도 등)이나 주의사항은 **굵게(Bold)** 표시.

## ⚠️ 안전 수칙 (Safety First)
- 화재 위험, 고온 화상, 유독 가스(ABS 등) 관련 내용은 반드시 '⚠️ **[경고]**' 태그와 함께 최우선으로 알림.

## 💡 답변 포맷 예시
**[진단]**
- 현상 분석 및 원인 요약

**[해결 솔루션]**
1. **노즐 온도**: 200°C → 210°C로 상향 조정
2. **리트랙션**: 거리 5mm, 속도 40mm/s 설정 권장
3. **쿨링**: 팬 속도 100% 유지

**[전문가 팁]**
- 해당 증상은 주로 습기 찬 필라멘트에서 발생하므로 **건조기 사용(50°C, 4시간)**을 권장합니다.

---
*위 가이드를 준수하여 한국어로 답변하십시오.*`
            });

            let promptParts = [currentInput];
            if (currentImage) {
                promptParts = [
                    {
                        inlineData: {
                            data: currentImage.base64,
                            mimeType: currentImage.file.type
                        }
                    },
                    currentInput
                ];
            }

            const result = await model.generateContentStream(promptParts);

            let fullText = "";
            let usageMetadata = null;

            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;

                // 마지막 chunk에서 usageMetadata 가져오기
                if (chunk.usageMetadata) {
                    usageMetadata = chunk.usageMetadata;
                }

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = fullText;
                    return newMessages;
                });
            }

            // 정확한 토큰 기반 비용 계산 (Gemini API usageMetadata 사용)
            let inputTokens = 0;
            let outputTokens = 0;

            if (usageMetadata) {
                inputTokens = usageMetadata.promptTokenCount || 0;
                outputTokens = usageMetadata.candidatesTokenCount || 0;
            } else {
                // Fallback: 대략적인 추정 (1 token ≈ 4 characters)
                inputTokens = Math.ceil(currentInput.length / 4);
                outputTokens = Math.ceil(fullText.length / 4);
            }

            const estimatedCost = (inputTokens / 1000000 * COST_PER_1M_INPUT_TOKENS) + (outputTokens / 1000000 * COST_PER_1M_OUTPUT_TOKENS);

            setUsageData(prev => ({
                ...prev,
                dailyTokens: prev.dailyTokens + inputTokens + outputTokens,
                estimatedFreeCost: mode === 'free' ? prev.estimatedFreeCost + estimatedCost : prev.estimatedFreeCost,
                paidTotalCost: mode === 'paid' ? prev.paidTotalCost + estimatedCost : prev.paidTotalCost
            }));

        } catch (err) {
            console.error(err);

            // API 요청 실패 시 사용량 카운트 롤백 (억울한 차감 방지)
            setUsageData(prev => ({
                ...prev,
                dailyRequests: mode === 'free' ? Math.max(0, prev.dailyRequests - 1) : prev.dailyRequests,
                requestTimestamps: prev.requestTimestamps.slice(0, -1) // Remove the last timestamp
            }));

            let errorMessage = "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            if (err.message.includes("429")) {
                errorMessage = "요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.";
            } else if (err.message.includes("API key")) {
                errorMessage = "API 키 오류입니다. 키 설정을 확인해주세요.";
            } else if (err.message) {
                errorMessage = err.message; // 사용자 정의 에러 메시지 (위에서 throw한 것들)
            }

            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1)); // Remove the empty model message placeholder
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearHistory = () => {
        if (window.confirm('대화 내용을 모두 삭제하시겠습니까?')) {
            setMessages([INITIAL_ASSISTANT_MESSAGE]);
            localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
            clearChatMessagesRemote().catch(() => {
                // offline/local fallback mode
            });
            setError(null);
        }
    };

    return (
        <div className={cn(
            "h-full w-full min-w-0 flex flex-col gap-2 md:gap-4 overflow-x-hidden",
            theme === 'light' ? "text-slate-900" : "text-slate-100"
        )}>
            {/* Header */}
            <div className={cn(
                "overflow-hidden transition-all duration-300 shrink-0",
                isHeaderCollapsed ? "max-h-0 opacity-0" : "max-h-[420px] opacity-100"
            )}>
                <header className={cn(
                    "flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 rounded-xl border backdrop-blur-md gap-4 transition-colors duration-300",
                    theme === 'light'
                        ? "bg-white/80 border-slate-200 shadow-sm"
                        : "bg-slate-900/50 border-slate-700"
                )}>
                    <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className={cn("text-xl font-bold truncate", theme === 'light' ? "text-slate-900" : "text-white")}>3D Printing AI Expert</h1>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Zap className="w-3 h-3 text-yellow-500" />
                                <span className="truncate">Powered by {selectedModel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-[560px] space-y-2.5">
                        <button
                            onClick={clearHistory}
                            className={cn(
                                "px-3 py-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-medium",
                                "w-full sm:w-auto justify-center sm:justify-start sm:ml-auto",
                                theme === 'light'
                                    ? "bg-white border-slate-200 hover:bg-slate-100 text-slate-500"
                                    : "bg-slate-800/50 border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white"
                            )}
                            title="Clear History"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            <span>대화 삭제</span>
                        </button>

                        <div className={cn(
                            "flex p-1 rounded-lg border w-full",
                            theme === 'light' ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"
                        )}>
                            <button
                                onClick={() => setMode('free')}
                                className={cn(
                                    "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2",
                                    mode === 'free'
                                        ? (theme === 'light' ? "bg-white text-slate-900 shadow-sm" : "bg-slate-700 text-white shadow-sm")
                                        : (theme === 'light' ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200")
                                )}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Free
                            </button>
                            <button
                                onClick={() => setMode('paid')}
                                className={cn(
                                    "flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2",
                                    mode === 'paid'
                                        ? "bg-purple-600 text-white shadow-sm"
                                        : (theme === 'light' ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200")
                                )}
                            >
                                <DollarSign className="w-3.5 h-3.5" />
                                Paid
                            </button>
                        </div>

                        <div className={cn(
                            "flex p-1 rounded-lg border w-full gap-1",
                            theme === 'light' ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"
                        )}>
                            {selectedModelOptions.map((modelName) => {
                                const isActive = selectedModel === modelName;
                                const isProModel = modelName === 'gemini-3.1-pro-preview';

                                return (
                                    <button
                                        key={modelName}
                                        onClick={() => (mode === 'paid' ? setPaidModel(modelName) : setFreeModel(modelName))}
                                        className={cn(
                                            "flex-1 min-w-0 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                            isActive
                                                ? (isProModel
                                                    ? "bg-purple-600 text-white shadow-sm"
                                                    : (theme === 'light' ? "bg-white text-slate-900 shadow-sm" : "bg-slate-700 text-white shadow-sm"))
                                                : (theme === 'light' ? "text-slate-500 hover:text-slate-900" : "text-slate-400 hover:text-slate-200")
                                        )}
                                        title={modelName}
                                    >
                                        {MODEL_LABELS[modelName] || modelName}
                                    </button>
                                );
                            })}
                        </div>

                        <div className={cn(
                            "text-xs rounded-lg border px-3 py-1.5",
                            theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-slate-800/50 border-slate-700 text-slate-300"
                        )}>
                            {mode === 'free'
                                ? `Daily ${usageData.dailyRequests}/${FREE_TIER_DAILY_REQUESTS} · Est. $${usageData.estimatedFreeCost.toFixed(4)}`
                                : `Paid Total Cost: $${usageData.paidTotalCost.toFixed(4)}`}
                        </div>
                    </div>
                </header>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 rounded-2xl border overflow-hidden flex flex-col relative transition-colors duration-300 min-w-0",
                theme === 'light'
                    ? "bg-slate-50 border-slate-200"
                    : "bg-slate-900/50 border-slate-700"
            )}>
                {/* Messages List */}
                <div
                    ref={messagesContainerRef}
                    onScroll={handleMessagesScroll}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-5 md:space-y-6 custom-scrollbar"
                >
                    {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex min-w-0", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "min-w-0 relative",
                                msg.role === 'model' ? "w-full" : "max-w-[92%] md:max-w-[85%]"
                            )}>
                                {msg.role === 'model' && (
                                    <div className={cn(
                                        "mb-1 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center",
                                        theme === 'light' ? "bg-blue-100 text-blue-600" : "bg-slate-800 text-blue-400"
                                    )}>
                                        <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    </div>
                                )}

                                {/* Message Bubble */}
                                <div className={cn(
                                    "rounded-2xl p-3.5 md:p-4 shadow-sm min-w-0",
                                    msg.role === 'user'
                                        ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-tr-none"
                                        : cn(
                                            "w-full rounded-tl-none border",
                                            theme === 'light'
                                                ? "bg-white border-slate-200 text-slate-800"
                                                : "bg-[#2d2d2d] border-slate-700 text-slate-200"
                                        )
                                )}
                                    style={{ fontSize: `${mobileFontScale}rem` }}
                                >

                                {/* Image Preview in Message */}
                                {msg.image && (
                                    <div className="mb-3 rounded-lg overflow-hidden max-w-[300px] border border-slate-700/50">
                                        <img src={msg.image} alt="Upload" className="w-full h-auto object-cover" />
                                    </div>
                                )}

                                {/* Markdown Content */}
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code: ({ inline, className, children, ...props }) => (
                                            <CodeBlock inline={inline} className={className} {...props}>{children}</CodeBlock>
                                        ),
                                        // Custom styling for other markdown elements in light/dark mode
                                        p: (props) => <p className={cn("mb-2 last:mb-0 leading-relaxed", theme === 'light' ? "text-slate-800" : "text-slate-200")} {...props} />,
                                        strong: (props) => <strong className={cn("font-bold", theme === 'light' ? "text-slate-900" : "text-white")} {...props} />,
                                        h1: (props) => <h1 className={cn("text-2xl font-bold mb-4 border-b pb-2", theme === 'light' ? "text-slate-900 border-slate-200" : "text-white border-slate-700")} {...props} />,
                                        h2: (props) => <h2 className={cn("text-xl font-bold mb-3 mt-6", theme === 'light' ? "text-slate-900" : "text-white")} {...props} />,
                                        h3: (props) => <h3 className={cn("text-lg font-bold mb-2 mt-4", theme === 'light' ? "text-slate-900" : "text-white")} {...props} />,
                                        ul: (props) => <ul className={cn("list-disc list-outside ml-6 mb-4 space-y-1", theme === 'light' ? "text-slate-800" : "text-slate-200")} {...props} />,
                                        ol: (props) => <ol className={cn("list-decimal list-outside ml-6 mb-4 space-y-1", theme === 'light' ? "text-slate-800" : "text-slate-200")} {...props} />,
                                        li: (props) => <li className="pl-1" {...props} />,
                                        blockquote: (props) => <blockquote className={cn("border-l-4 pl-4 py-1 my-4 italic", theme === 'light' ? "border-slate-300 text-slate-600 bg-slate-50" : "border-slate-600 text-slate-400 bg-slate-800/30")} {...props} />,
                                        a: (props) => <a className="text-blue-500 hover:text-blue-400 hover:underline transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                        table: (props) => (
                                            <div className="w-full overflow-x-auto my-4 rounded-lg border border-slate-700/50">
                                                <table
                                                    className={cn("w-full table-fixed text-sm text-left border-collapse", theme === 'light' ? "text-slate-700" : "text-slate-300")}
                                                    style={{ writingMode: 'horizontal-tb' }}
                                                    {...props}
                                                />
                                            </div>
                                        ),
                                        thead: (props) => <thead className={cn("text-xs uppercase", theme === 'light' ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-slate-400")} {...props} />,
                                        th: (props) => <th className="px-3 md:px-4 py-2.5 font-bold align-top whitespace-normal break-words [word-break:break-word]" {...props} />,
                                        tbody: (props) => <tbody className={cn("divide-y", theme === 'light' ? "divide-slate-200" : "divide-slate-700")} {...props} />,
                                        tr: (props) => <tr className={cn(theme === 'light' ? "hover:bg-slate-50" : "hover:bg-slate-800/50")} {...props} />,
                                        td: (props) => <td className="px-3 md:px-4 py-2.5 align-top whitespace-normal break-words [word-break:break-word] leading-relaxed" {...props} />,
                                        hr: (props) => <hr className={cn("my-6 border-0 h-px", theme === 'light' ? "bg-slate-200" : "bg-slate-700")} {...props} />,
                                    }}
                                >
                                    {msg.text}
                                </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="flex gap-4">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                                theme === 'light' ? "bg-blue-100 text-blue-600" : "bg-slate-800 text-blue-400"
                            )}>
                                <Bot className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className={cn(
                                "flex items-center gap-2 p-4 rounded-2xl rounded-tl-none border",
                                theme === 'light'
                                    ? "bg-white border-slate-200"
                                    : "bg-slate-900 border-slate-700"
                            )}>
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className={cn("text-sm", theme === 'light' ? "text-slate-500" : "text-slate-400")}>AI가 답변을 생성하고 있습니다...</span>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex justify-center my-4">
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg flex items-center gap-2 text-sm shadow-sm backdrop-blur-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={cn(
                    "border-t sticky bottom-0 z-10 transition-all duration-300",
                    isCompactMobileUI ? "p-2" : "p-4",
                    theme === 'light' ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-700 backdrop-blur"
                )}>
                    <div className={cn("mb-2", isCompactMobileUI && "mb-1")}>
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 whitespace-nowrap">
                            <button
                                type="button"
                                onClick={scrollToTop}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0",
                                    theme === 'light'
                                        ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                )}
                                title="맨 위로 이동"
                            >
                                <ArrowUpToLine className="w-3.5 h-3.5" />
                                <span>맨 위로</span>
                            </button>
                            <button
                                type="button"
                                onClick={copyLatestModelAnswer}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0",
                                    theme === 'light'
                                        ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                )}
                                title="최근 답변 복사"
                            >
                                {isLatestCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isLatestCopied ? '복사됨' : '복사'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={summarizeLatestAnswer}
                                disabled={isLoading}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0",
                                    theme === 'light'
                                        ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                )}
                                title="최근 답변 요약"
                            >
                                <span>요약</span>
                            </button>
                            <button
                                type="button"
                                onClick={regenerateLastAnswer}
                                disabled={isLoading}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0",
                                    theme === 'light'
                                        ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                                        : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                                )}
                                title="마지막 질문 재생성"
                            >
                                <span>재생성</span>
                            </button>
                            <div className={cn(
                                "inline-flex items-center gap-1 rounded-lg border shrink-0",
                                isCompactMobileUI ? "p-0.5" : "p-1",
                                theme === 'light' ? "bg-slate-100 border-slate-200" : "bg-slate-800 border-slate-700"
                            )}>
                                <button
                                    type="button"
                                    onClick={() => setMobileFontScale(0.9)}
                                    className={cn(
                                        "rounded text-xs font-bold transition-colors whitespace-nowrap",
                                        isCompactMobileUI ? "px-1.5 py-0.5" : "px-2 py-1",
                                        mobileFontScale === 0.9
                                            ? "bg-blue-600 text-white"
                                            : (theme === 'light' ? "text-slate-600 hover:bg-slate-200" : "text-slate-300 hover:bg-slate-700")
                                    )}
                                >
                                    {isCompactMobileUI ? 'A-' : '작게'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileFontScale(0.95)}
                                    className={cn(
                                        "rounded text-xs font-bold transition-colors whitespace-nowrap",
                                        isCompactMobileUI ? "px-1.5 py-0.5" : "px-2 py-1",
                                        mobileFontScale === 0.95
                                            ? "bg-blue-600 text-white"
                                            : (theme === 'light' ? "text-slate-600 hover:bg-slate-200" : "text-slate-300 hover:bg-slate-700")
                                    )}
                                >
                                    {isCompactMobileUI ? 'A' : '기본'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileFontScale(1)}
                                    className={cn(
                                        "rounded text-xs font-bold transition-colors whitespace-nowrap",
                                        isCompactMobileUI ? "px-1.5 py-0.5" : "px-2 py-1",
                                        mobileFontScale === 1
                                            ? "bg-blue-600 text-white"
                                            : (theme === 'light' ? "text-slate-600 hover:bg-slate-200" : "text-slate-300 hover:bg-slate-700")
                                    )}
                                >
                                    {isCompactMobileUI ? 'A+' : '크게'}
                                </button>
                            </div>
                        </div>
                    </div>
                    {selectedImage && (
                        <div className="mb-2 inline-flex items-center gap-2 bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-sm border border-slate-700">
                            <ImageIcon className="w-4 h-4 text-blue-400" />
                            <span className="truncate max-w-[200px]">{selectedImage.file.name}</span>
                            <button
                                onClick={() => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                className="ml-2 hover:bg-slate-700 rounded-full p-0.5"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className={cn(
                            "relative flex items-center gap-2 rounded-xl border focus-within:ring-2 focus-within:ring-blue-500/50 transition-all shadow-sm",
                            isCompactMobileUI ? "p-1.5" : "p-2",
                            isDragging
                                ? "border-blue-500 ring-2 ring-blue-500/50 bg-blue-500/10"
                                : theme === 'light'
                                    ? "bg-white border-slate-200"
                                    : "bg-slate-800 border-slate-700"
                        )}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={cn("p-2 rounded-lg transition-colors shrink-0",
                                theme === 'light'
                                    ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                            )}
                            title="Upload Image"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isDragging ? "이미지를 여기에 놓으세요" : "무엇이든 물어보세요... (Shift+Enter to send)"}
                            className={cn(
                                "flex-1 bg-transparent px-2 py-1 outline-none min-w-0 disabled:opacity-50",
                                theme === 'light' ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-slate-500"
                            )}
                            disabled={isLoading}
                        />

                        <button
                            type="submit"
                            disabled={isLoading || (!input.trim() && !selectedImage)}
                            className={cn(
                                "p-2 rounded-lg transition-all shrink-0",
                                (input.trim() || selectedImage) && !isLoading
                                    ? "bg-blue-600 text-white shadow-lg hover:bg-blue-500 hover:scale-105 active:scale-95"
                                    : "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                            )}
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </form>
                    <div className={cn("text-center mt-2", isCompactMobileUI && "hidden")}>
                        <p className={cn("text-xs", theme === 'light' ? "text-slate-400" : "text-slate-500")}>
                            AI는 실수를 할 수 있습니다. 중요한 정보는 확인이 필요합니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiChatbot;
