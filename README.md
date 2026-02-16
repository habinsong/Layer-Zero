# Layer Zero

![Layer Zero 홈 화면 (다크)](photo/home.png)
![Layer Zero 홈 화면 (라이트)](<photo/home(light).png>)

> Klipper + Moonraker 기반 3D 프린터를 모바일/PC 어디서든 안정적으로 제어하기 위한 실전형 운영 대시보드

![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)
![Moonraker](https://img.shields.io/badge/Moonraker-WebSocket%20%2B%20HTTP-1f2937)
![PWA](https://img.shields.io/badge/PWA-Enabled-0ea5e9)

## 왜 Layer Zero인가

Layer Zero는 3D 프린팅에서 가장 자주 발생하는 문제를 "화면 구성"으로 해결합니다.

- 상태 확인과 제어를 분리하지 않고 한 흐름으로 배치
- 문제 감지(경고/에러)와 즉시 조치(원클릭 액션)를 같은 맥락에서 제공
- 출력이 끝난 뒤 리포트로 남겨 다음 출력 품질을 높이는 구조

즉, 이 프로젝트는 "예쁜 모니터링 앱"이 아니라 **출력 실패율을 줄이기 위한 운영 도구**입니다.

## 핵심 기능 요약

| 모듈 | 핵심 목적 | 주요 기능 |
|---|---|---|
| 홈 대시보드 | 지금 상태를 빠르게 판단 | 진행률, ETA, 온도, 비용, 품질 점수, 경고/에러 카드 |
| 제어 센터 | 즉시 제어 | `G28`, 일시정지/재개, 취소, 예열, Z-Offset, 매크로 |
| 파일 관리자 | 출력 준비 시간 단축 | 업로드/출력/삭제, 메타데이터, 썸네일 표시 |
| 웹캠 | 원격 모니터링 강화 | CAM1/CAM2, 회전/반전, 보정(업스케일/노이즈/대비) |
| AI 챗봇 | 문제 해결 보조 | Free/Paid 모드, 모델 선택, 요약/재생성 |
| 리포트 | 출력 품질 회고 | 자동 저장, 품질/경고/비용 타임라인 |
| 유지보수/도구 | 반복 작업 자동화 | 보정 계산기, 점검 루틴, 진단 도구 |

### BLTouch 자동레벨링 업데이트

- 버튼명: `자동레벨링`
- 실행 순서: `베드 50°C 가열 → G28 → BED_MESH_CALIBRATE → SAVE_CONFIG`
- 진행 상태: 5단계(가열/홈/측정/수집/저장) 실시간 표시
- 결과 시각화: 유지보수/결과 팝업에서 3D 평탄도 그래프 + 프로빙 경로(START/END, serpentine) 제공

## UI 둘러보기

### 홈 대시보드 (다크/라이트)
출력 중 의사결정을 위한 핵심 카드(상태, 진행률, ETA, 비용, 품질, 경고)가 집약된 화면입니다.

![홈 대시보드 (다크)](photo/home.png)
![홈 대시보드 (라이트)](<photo/home(light).png>)

### AI 챗봇
출력 중 질문, 원인 분석, 설정 제안까지 연결되는 실전 보조 인터페이스입니다.

![AI 챗봇](photo/ai-chatbot.png)

### 3D 도안/리소스
도안 검색, 웹 슬라이서, 캘리브레이션 리소스를 빠르게 접근하는 허브입니다.

![3D 도안/리소스](photo/design-library.png)

### 도구
E-step/Flow/PID 등 실사용 빈도 높은 계산을 빠르게 처리하는 화면입니다.

![도구](photo/tools.png)

### 리포트
출력 완료 후 품질 하락 구간, 경고 타임라인, 비용 추이를 확인하는 화면입니다.

![리포트](photo/reports.png)

### 유지보수
정비 주기와 필라멘트/노즐 상태를 관리하는 운영 화면입니다.

![유지보수](photo/maintenance.png)

> 베드 메쉬 이력 카드에서 Min/Avg/Max + 3D 평탄도 그래프 + 측정 경로를 함께 확인할 수 있습니다.

### 설정
연결, 성능, 날씨 위치, AI 키, 프로필까지 한 곳에서 관리합니다.

![설정](photo/settings.png)

## 실시간 아키텍처

Layer Zero는 **WebSocket 우선 + HTTP 폴백** 구조를 사용합니다.

- WS 연결 성공 시: 상태/진행률/온도/파일 이벤트 즉시 반영
- WS 단절 시: 백오프 재연결 + watchdog + 폴백 폴링 자동 복구
- iOS Safari 복귀 이슈: visibility/pageshow 기반 복구 루틴 적용

이 구조 덕분에 네트워크 변동이 있어도 UI 정합성과 반응성을 동시에 확보합니다.

## 기술 스택

- Frontend: React + Vite
- UI: Tailwind CSS + 커스텀 컴포넌트 시스템
- 상태관리: Context API (`SettingsContext`, `ThemeContext`)
- 통신: Moonraker API (WS + HTTP fallback)
- 차트: Recharts
- PWA: `vite-plugin-pwa`

## 설치 및 빠른 시작

### 요구 사항
- Node.js 18+
- npm
- Klipper + Moonraker 실행 환경

### 1) 설치
```bash
npm install
```

### 2) 로컬 환경 파일 생성
```bash
cp .env.example .env.local
```

### 3) `.env.local` 최소 설정
```env
VITE_DEFAULT_PRINTER_NAME=My Printer
VITE_DEFAULT_KLIPPER_IP=http://<moonraker-ip>:7125
VITE_DEFAULT_WEBCAM_URL=http://<cam1-ip>/capture_flash
VITE_DEFAULT_WEBCAM_URL2=http://<cam2-ip>/capture_flash
VITE_DEFAULT_WEATHER_CITY=서울시
VITE_DEFAULT_WEATHER_LAT=37.5665
VITE_DEFAULT_WEATHER_LON=126.9780
VITE_MOONRAKER_FALLBACK_IP=<moonraker-ip>
VITE_DEV_PROXY_TARGET=http://<moonraker-ip>:7125

VITE_DEFAULT_AI_FREE_API_KEY=...
VITE_DEFAULT_AI_PAID_API_KEY=...
```

### 4) 개발 서버 실행
```bash
npm run dev
```

### 5) 빌드/프리뷰
```bash
npm run build
npm run preview
```

### 6) PM2 실행 (서버)
```bash
./start-server.sh
# 또는
pm2 start ecosystem.config.cjs
```

## 운영 가이드

### 필수 체크
1. 개발 모드에서 `/api` 프록시를 쓰려면 `VITE_DEV_PROXY_TARGET`이 반드시 필요합니다.
2. 배포 빌드에서는 Vite dev proxy가 동작하지 않으므로 운영 라우팅/CORS를 별도 구성해야 합니다.
3. 민감 정보(IP/API 키)는 `.env.local`에만 저장하고 저장소에는 올리지 않습니다.

### 권장 성능값 (다중 접속 기준)
- 대시보드 fallback 폴링: `5000~10000ms`
- 통계 갱신: `60000~120000ms`
- 웹캠 탭은 필요한 기기에서만 활성화

### 3D 그래프(Heightmap) 관련 메모
1. 홈 팝업 그래프는 카메라 시점을 유지하도록 처리되어, 모바일 터치 회전 후 원위치 복귀 현상을 줄였습니다.
2. 3D 표면 렌더링은 최소 `2x2` 매트릭스가 필요합니다.
3. `1x1`(단일 포인트) 측정은 표면 그래프 대신 수치 정보 중심으로 표시됩니다.

## 문서

- 설계/운영/트러블슈팅 상세: `LAYER_ZERO_PROJECT_GUIDE.md`
