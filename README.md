# Layer Zero

![Layer Zero 홈 화면 (다크)](photo/home.png)
![Layer Zero 홈 화면 (라이트)](<photo/home(light).png>)

Klipper + Moonraker 기반 3D 프린터를 모바일/PC에서 제어하는 통합 웹 대시보드입니다.

## 주요 특징

- 홈 대시보드: 실시간 상태/진행률/ETA/비용/품질 점수
- 제어 센터: G28, 일시정지/재개, 예열, Z-Offset, 매크로, 자동레벨링
- 파일 관리: G-code 업로드/삭제/출력, 썸네일 표시
- 웹캠: CAM1/CAM2, 회전/반전, 보정 필터
- AI 챗봇: Free/Paid, 요약/재생성, 대화 저장
- 리포트: 출력 완료 자동 저장 + 품질/경고/비용 추이
- 유지보수: 점검 루틴, 로그, 베드 메쉬 이력/3D 시각화

## 아키텍처 (현재 구현)

- Moonraker 연동: WebSocket 우선 + HTTP 폴백
- 중앙 저장 API: `server/index.js` (Express)
- 저장소: `server/data/store.json`
- 실시간 데이터 동기화: SSE (`GET /lzapi/events`)
- 클라이언트 API 유틸: `src/utils/centralApi.js`

### 중앙 API 엔드포인트

- `GET /lzapi/health`
- `GET/PUT /lzapi/settings`
- `GET/POST/DELETE /lzapi/mesh-history`
- `GET/POST/DELETE /lzapi/reports`, `DELETE /lzapi/reports/:id`
- `GET/PUT /lzapi/maintenance/state`
- `GET/POST/DELETE /lzapi/maintenance/logs`
- `GET/PUT /lzapi/maintenance/checklist`
- `GET/PUT/DELETE /lzapi/chat/messages`
- `GET /lzapi/events` (SSE)

## 동기화 정책

- 서버 우선 저장 + 로컬 fallback 유지
- 설정/리포트/유지보수/챗/메쉬는 서버 저장
- 서버 실패 시 localStorage fallback
- SSE 이벤트 수신 시 변경분 patch 반영

## 설치 및 실행

### 요구 사항

- Node.js 18+
- npm
- Moonraker 실행 환경

### 설치

```bash
npm install
```

### 환경 파일

```bash
cp .env.example .env.local
```

`.env.local` 예시:

```env
VITE_DEFAULT_PRINTER_NAME=My Printer
VITE_DEFAULT_KLIPPER_IP=172.30.1.83:7125
VITE_DEFAULT_WEBCAM_URL=http://172.30.1.72/capture_flash
VITE_DEFAULT_WEBCAM_URL2=http://172.30.1.93/capture_flash
VITE_DEFAULT_WEATHER_CITY=서울시
VITE_DEFAULT_WEATHER_LAT=37.5665
VITE_DEFAULT_WEATHER_LON=126.9780

# Dev proxy
VITE_DEV_PROXY_TARGET=http://172.30.1.83:7125
VITE_APP_API_TARGET=http://127.0.0.1:8787
VITE_APP_API_BASE=/lzapi

# 선택: 기본 API 키
VITE_DEFAULT_AI_FREE_API_KEY=
VITE_DEFAULT_AI_PAID_API_KEY=
```

### 개발 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
npm run preview
```

## 보안 가이드 (중요)

- 민감값은 `.env.local`에만 저장
- `.env`, `.env.local`, `.env.*`는 Git 추적 제외
- 런타임 저장소 `server/data/store.json`은 Git 추적 제외
- API 키를 GitHub에 올린 이력이 있으면 즉시 폐기/재발급

## 문서

- 프로젝트 가이드: `LAYER_ZERO_PROJECT_GUIDE.md`
- 중앙 저장 구조: `docs/central-db/CENTRAL_DB_ARCHITECTURE.md`
- 프론트 연동 맵: `docs/central-db/FRONTEND_MIGRATION_MAP.md`
