import React, { useEffect, useMemo, useState } from 'react';
import {
    ExternalLink,
    Search,
    Wrench,
    Database,
    Sparkles,
    Layers,
    Star,
    Link2,
    Check,
    Wand2,
    Compass,
    Filter
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { cn } from '../lib/utils';

const FAVORITES_KEY = 'model-sites-favorites-v1';

const sites = {
    models: [
        { name: 'Thingiverse', url: 'https://www.thingiverse.com/', description: '가장 큰 3D 모델 커뮤니티 - 수백만 개의 무료 STL', tags: ['#무료', '#커뮤니티', '#레거시'], icon: '📦' },
        { name: 'Printables', url: 'https://www.printables.com/', description: 'Prusa 운영 - 고품질 모델과 콘테스트', tags: ['#무료', '#고품질', '#콘테스트'], icon: '⭐' },
        { name: 'MakerWorld', url: 'https://makerworld.com/', description: 'Bambu Lab 공식 - 빠른 출력용 모델', tags: ['#무료', '#Bambu', '#최적화'], icon: '🌍' },
        { name: 'Cults3D', url: 'https://cults3d.com/', description: '디자이너 마켓플레이스 - 유료/무료 혼합', tags: ['#유료', '#디자이너', '#아트'], icon: '🎨' },
        { name: 'GrabCAD', url: 'https://grabcad.com/library', description: 'CAD 전문가용 엔지니어링 모델 라이브러리', tags: ['#무료', '#엔지니어링', '#CAD'], icon: '⚙️' }
    ],
    slicers: [
        { name: 'Kiri:Moto', url: 'https://grid.space/kiri/', description: '강력한 웹 기반 통합 슬라이서 (FDM, CNC, Laser)', tags: ['#무료', '#다기능', '#설치불필요'], icon: '🧊' },
        { name: 'SliceCrafter', url: 'https://ice-sl.github.io/slicecrafter/', description: 'IceSL 기반의 심플하고 빠른 웹 슬라이서', tags: ['#무료', '#심플', '#IceSL'], icon: '❄️' },
        { name: 'AstroPrint', url: 'https://cloud.astroprint.com/', description: '클라우드 기반 슬라이싱 & 원격 프린터 관리', tags: ['#클라우드', '#관리', '#계정필요'], icon: '🚀' },
        { name: 'SelfCAD Slicer', url: 'https://www.selfcad.com/slicer', description: '모델링부터 슬라이싱까지 올인원 웹 솔루션', tags: ['#올인원', '#모델링', '#통합'], icon: '🛠️' }
    ],
    generators: [
        { name: 'Voronator', url: 'https://www.voronator.com/', description: '평범한 STL 파일을 보로노이 패턴으로 자동 변환', tags: ['#무료', '#패턴생성', '#예술'], icon: '🌐' },
        { name: 'TouchTerrain', url: 'https://touchterrain.geol.iastate.edu/', description: '구글 지도 지형을 3D 모델(STL)로 추출', tags: ['#무료', '#지형', '#교육'], icon: '🗺️' },
        { name: 'QR Code Generator', url: 'https://printer.tools/qrcode2stl/', description: '3D 프린팅 최적화된 QR 코드 STL 생성', tags: ['#무료', '#QR', '#실용'], icon: '📱' },
        { name: 'Gear Generator', url: 'https://geargenerator.com/', description: '톱니 수와 모듈을 입력하면 정밀 기어 생성', tags: ['#무료', '#기어', '#메카닉'], icon: '⚙️' },
        { name: 'Text2STL', url: 'https://text2stl.com/', description: '텍스트를 입력하면 명판/열쇠고리 STL 생성', tags: ['#무료', '#텍스트', '#명판'], icon: '🔤' },
        { name: 'Boxes.py', url: 'https://www.festi.info/boxes.py/', description: '만능 상자 생성기 - 다양한 크기와 구조', tags: ['#무료', '#상자', '#수납'], icon: '📦' }
    ],
    calibration: [
        { name: 'Teaching Tech Calibration', url: 'https://teachingtechyt.github.io/calibration.html', description: '가장 완벽한 3D 프린터 튜닝 가이드', tags: ['#무료', '#칼리브레이션', '#완전판'], icon: '🎓' },
        { name: 'Retraction Calibration', url: 'http://retractioncalibration.com/', description: '리트랙션 테스트 G-Code 자동 생성', tags: ['#무료', '#리트랙션', '#스트링'], icon: '🔧' },
        { name: 'NC Viewer', url: 'https://ncviewer.com/', description: '모바일에서 G-Code 경로 시뮬레이션', tags: ['#무료', '#G-Code', '#뷰어'], icon: '👁️' },
        { name: 'GCode.ws', url: 'https://gcode.ws/', description: 'G-Code 엑스레이 - 레이어별 분석', tags: ['#무료', '#G-Code', '#분석'], icon: '🔬' },
        { name: 'Prusa Material Table', url: 'https://help.prusa3d.com/materials', description: '모든 필라멘트 물성/온도 데이터베이스', tags: ['#무료', '#재료', '#데이터'], icon: '📊' }
    ],
    resources: [
        { name: 'Thangs', url: 'https://thangs.com/', description: '형상 검색 - STL 업로드로 유사 모델 찾기', tags: ['#무료', '#검색', '#AI'], icon: '🔍' },
        { name: 'NASA 3D Resources', url: 'https://nasa3d.arc.nasa.gov/models', description: 'NASA 공식 우주선/행성 고해상도 STL', tags: ['#무료', '#NASA', '#우주'], icon: '🚀' },
        { name: 'FilamentColors.xyz', url: 'https://www.filamentcolors.xyz/', description: '실제 출력물 기반 필라멘트 색상 비교', tags: ['#무료', '#색상', '#비교'], icon: '🎨' },
        { name: 'FullControl.xyz', url: 'https://fullcontrol.xyz/', description: 'G-Code 마법사 - 파라메트릭 디자인', tags: ['#무료', '#G-Code', '#고급'], icon: '🧙' },
        { name: 'ItsLitho', url: 'https://itslitho.com/', description: '리소페인 끝판왕 - 사진을 입체 리소페인으로', tags: ['#무료', '#리소페인', '#사진'], icon: '🖼️' }
    ]
};

const tabs = [
    { id: 'models', label: '도안 사이트', icon: Database, gradient: 'from-orange-500 to-red-500' },
    { id: 'slicers', label: '웹 슬라이서', icon: Layers, gradient: 'from-yellow-500 to-amber-500' },
    { id: 'generators', label: '생성기', icon: Sparkles, gradient: 'from-purple-500 to-pink-500' },
    { id: 'calibration', label: '칼리브레이션', icon: Wrench, gradient: 'from-blue-500 to-cyan-500' },
    { id: 'resources', label: '검색 & 리소스', icon: Compass, gradient: 'from-emerald-500 to-green-500' }
];

const workflows = [
    {
        id: 'quick-print',
        title: '빠른 출력 루트',
        description: '도안 검색부터 웹 슬라이싱까지 한 번에 이동',
        links: [
            { label: '도안 찾기', url: 'https://www.printables.com/' },
            { label: '바로 슬라이싱', url: 'https://grid.space/kiri/' }
        ]
    },
    {
        id: 'quality-tune',
        title: '품질 튜닝 루트',
        description: '캘리브레이션 + 재료 데이터 확인',
        links: [
            { label: '튜닝 가이드', url: 'https://teachingtechyt.github.io/calibration.html' },
            { label: '재료 테이블', url: 'https://help.prusa3d.com/materials' }
        ]
    },
    {
        id: 'creative-lab',
        title: '크리에이티브 실험',
        description: '파라메트릭/지형/패턴 생성 툴 모음',
        links: [
            { label: '지형 생성', url: 'https://touchterrain.geol.iastate.edu/' },
            { label: '패턴 생성', url: 'https://www.voronator.com/' }
        ]
    }
];

const ThreeDResources = () => {
    const { theme } = useTheme();
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('models');
    const [query, setQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [copiedUrl, setCopiedUrl] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [favorites, setFavorites] = useState(() => {
        try {
            const raw = localStorage.getItem(FAVORITES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        const remote = settings.modelSiteFavorites;
        if (!Array.isArray(remote)) return;
        setFavorites(remote);
        try {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(remote));
        } catch {
            // ignore local fallback write failure
        }
    }, [settings.modelSiteFavorites]);

    const currentSites = sites[activeTab] || [];

    const tabFavoritesCount = useMemo(
        () => currentSites.filter((site) => favorites.includes(site.url)).length,
        [currentSites, favorites]
    );

    const allTags = useMemo(() => {
        const set = new Set();
        currentSites.forEach((site) => site.tags.forEach((tag) => set.add(tag)));
        return Array.from(set);
    }, [currentSites]);

    const filteredSites = useMemo(() => {
        const q = query.trim().toLowerCase();
        return currentSites.filter((site) => {
            const matchesQuery = !q
                || site.name.toLowerCase().includes(q)
                || site.description.toLowerCase().includes(q)
                || site.tags.some((tag) => tag.toLowerCase().includes(q));
            const matchesTag = !selectedTag || site.tags.includes(selectedTag);
            const isFavorite = favorites.includes(site.url);
            return matchesQuery && matchesTag && (!showFavoritesOnly || isFavorite);
        });
    }, [currentSites, query, selectedTag, showFavoritesOnly, favorites]);

    const toggleFavorite = (url) => {
        setFavorites((prev) => {
            const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
            updateSettings({ modelSiteFavorites: next });
            return next;
        });
    };

    const openExternal = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const copyLink = async (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(url);
            setCopiedUrl(url);
            setTimeout(() => setCopiedUrl(''), 1200);
        } catch {
            setCopiedUrl('');
        }
    };

    return (
        <div className="w-full space-y-6 animate-fade-in px-3 md:px-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black gradient-text gradient-primary">3D 리소스 허브</h1>
                    <p className={cn('mt-1 text-sm md:text-base', theme === 'dark' ? 'text-slate-400' : 'text-slate-700')}>
                        자주 쓰는 루트를 빠르게 열고, 사이트를 태그/즐겨찾기로 관리하세요.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                {workflows.map((flow) => (
                    <div
                        key={flow.id}
                        className={cn(
                            'rounded-2xl border p-3 md:p-4',
                            theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Wand2 className={cn('w-4 h-4', theme === 'dark' ? 'text-amber-300' : 'text-amber-600')} />
                            <h2 className={cn('font-extrabold text-sm md:text-base', theme === 'dark' ? 'text-white' : 'text-slate-900')}>
                                {flow.title}
                            </h2>
                        </div>
                        <p className={cn('mt-1.5 text-xs md:text-sm', theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}>
                            {flow.description}
                        </p>
                        <div className="mt-3 flex gap-2">
                            {flow.links.map((link) => (
                                <button
                                    key={link.url}
                                    onClick={(e) => openExternal(e, link.url)}
                                    className={cn(
                                        'flex-1 rounded-lg px-2.5 py-2 text-xs font-bold border transition-colors',
                                        theme === 'dark'
                                            ? 'bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700'
                                            : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
                                    )}
                                >
                                    {link.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div
                className={cn(
                    'rounded-2xl border p-3 md:p-4 space-y-3',
                    theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
                )}
            >
                <div
                    className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2',
                        theme === 'dark' ? 'bg-slate-950/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                    )}
                >
                    <Search className={cn('w-4 h-4', theme === 'dark' ? 'text-slate-400' : 'text-slate-500')} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="사이트·태그 검색"
                        className={cn(
                            'w-full min-w-0 bg-transparent outline-none text-sm',
                            theme === 'dark' ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
                        )}
                    />
                    <button
                        onClick={() => setShowFavoritesOnly((v) => !v)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shrink-0 whitespace-nowrap min-w-[92px]',
                            showFavoritesOnly
                                ? 'bg-amber-500 text-white border-amber-500'
                                : theme === 'dark'
                                    ? 'text-slate-300 border-slate-600 hover:bg-slate-800'
                                    : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-100'
                        )}
                    >
                        즐겨찾기만
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSelectedTag('');
                            }}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all',
                                activeTab === tab.id
                                    ? `bg-gradient-to-r ${tab.gradient} text-white border-transparent shadow-lg`
                                    : theme === 'dark'
                                        ? 'text-slate-200 bg-slate-800/70 border-slate-700 hover:bg-slate-700'
                                        : 'text-slate-800 bg-slate-50 border-slate-300 hover:bg-slate-100'
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className={cn('flex items-center gap-1.5 text-xs font-semibold', theme === 'dark' ? 'text-slate-300' : 'text-slate-700')}>
                        <Filter className="w-3.5 h-3.5" />
                        해시태그 필터
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setSelectedTag('')}
                            className={cn(
                                'px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors',
                                !selectedTag
                                    ? 'bg-sky-500 border-sky-500 text-white'
                                    : theme === 'dark'
                                        ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                            )}
                        >
                            전체
                        </button>
                        {allTags.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={cn(
                                    'px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors',
                                    selectedTag === tag
                                        ? 'bg-sky-500 border-sky-500 text-white'
                                        : theme === 'dark'
                                            ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                                )}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    'rounded-xl px-3 py-2 text-xs md:text-sm flex items-center justify-between',
                    theme === 'dark' ? 'bg-slate-900/50 border border-slate-800 text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-700'
                )}
            >
                <span>{filteredSites.length}개 결과</span>
                <span className="inline-flex items-center gap-1 opacity-90">
                    <Star className="w-3.5 h-3.5" />
                    현재 탭 즐겨찾기 {tabFavoritesCount}개
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                {filteredSites.map((site) => {
                    const isFavorite = favorites.includes(site.url);
                    return (
                        <article
                            key={site.url}
                            className={cn(
                                'relative rounded-2xl border p-4 transition-all group hover:-translate-y-1',
                                theme === 'dark'
                                    ? 'bg-slate-900/60 border-slate-700 hover:border-slate-500'
                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0', theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100')}>
                                    {site.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={cn('font-black truncate', theme === 'dark' ? 'text-white' : 'text-slate-900')}>{site.name}</h3>
                                        <ExternalLink className={cn('w-4 h-4 shrink-0', theme === 'dark' ? 'text-slate-500' : 'text-slate-500')} />
                                    </div>
                                    <p className={cn('text-sm mt-1 line-clamp-2', theme === 'dark' ? 'text-slate-400' : 'text-slate-700')}>
                                        {site.description}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {site.tags.map((tag) => (
                                    <span
                                        key={`${site.url}-${tag}`}
                                        className={cn(
                                            'px-2 py-1 text-[11px] font-semibold rounded-md border',
                                            theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                                        )}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                                <button
                                    onClick={(e) => openExternal(e, site.url)}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors',
                                        theme === 'dark'
                                            ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                                            : 'border-slate-300 text-slate-800 hover:bg-slate-100'
                                    )}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    열기
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleFavorite(site.url);
                                    }}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors',
                                        isFavorite
                                            ? 'bg-amber-500 border-amber-500 text-white'
                                            : theme === 'dark'
                                                ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                                                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                    )}
                                >
                                    <Star className="w-3.5 h-3.5" />
                                    저장
                                </button>

                                <button
                                    onClick={(e) => copyLink(e, site.url)}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors',
                                        theme === 'dark'
                                            ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                                            : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                    )}
                                >
                                    {copiedUrl === site.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
                                    {copiedUrl === site.url ? '완료' : '복사'}
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>

            {!filteredSites.length && (
                <div
                    className={cn(
                        'rounded-2xl border px-4 py-6 text-center text-sm',
                        theme === 'dark' ? 'border-slate-700 bg-slate-900/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                    )}
                >
                    조건에 맞는 사이트가 없습니다. 검색어/태그/즐겨찾기 필터를 조정해보세요.
                </div>
            )}
        </div>
    );
};

export default ThreeDResources;
