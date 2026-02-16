# Layer Zero

![Layer Zero 홈 화면 (다크)](photo/docs/home-desktop.png)

Klipper + Moonraker 기반 3D 프린터를 모바일/PC에서 제어하는 통합 운영 대시보드입니다.

## 핵심 요약

- 실시간 상태/진행률/ETA/비용/품질 통합 대시보드
- G-code 업로드/출력/관리 + 썸네일
- 웹캠 2대(CAM1/CAM2) + 회전/반전/보정
- BLTouch 자동레벨링 (가열 → G28 → 메쉬 → 저장)
- AI 챗봇(Free/Paid, 요약/재생성)
- 출력 완료 리포트 자동 생성/저장
- 유지보수 로그/체크리스트/베드메쉬 이력

---

## 탭별 캡처 (Desktop)

### 홈
![홈 (Desktop)](photo/docs/home-desktop.png)

### 프린터
![프린터 (Desktop)](photo/docs/printer-desktop.png)

### 웹캠
![웹캠 (Desktop)](photo/docs/webcam-desktop.png)

### AI 챗봇
![AI 챗봇 (Desktop)](photo/docs/chatbot-desktop.png)

### 3D 도안 - 도안 사이트
![3D 도안 - 도안 사이트 (Desktop)](photo/docs/models-models-desktop.png)

### 3D 도안 - 웹 슬라이서
![3D 도안 - 웹 슬라이서 (Desktop)](photo/docs/models-slicers-desktop.png)

### 3D 도안 - 생성기
![3D 도안 - 생성기 (Desktop)](photo/docs/models-generators-desktop.png)

### 3D 도안 - 칼리브레이션
![3D 도안 - 칼리브레이션 (Desktop)](photo/docs/models-calibration-desktop.png)

### 3D 도안 - 검색 & 리소스
![3D 도안 - 검색 & 리소스 (Desktop)](photo/docs/models-resources-desktop.png)

### 유지보수
![유지보수 (Desktop)](photo/docs/maintenance-desktop.png)

### 도구
![도구 (Desktop)](photo/docs/tools-desktop.png)

### 리포트
![리포트 (Desktop)](photo/docs/reports-desktop.png)

### 설정
![설정 (Desktop)](photo/docs/settings-desktop.png)

---

## 모바일 캡처

### 홈 (Mobile)
![홈 (Mobile)](photo/docs/home-mobile.png)

### 웹캠 (Mobile)
![웹캠 (Mobile)](photo/docs/webcam-mobile.png)

### AI 챗봇 (Mobile)
![AI 챗봇 (Mobile)](photo/docs/chatbot-mobile.png)

### 유지보수 (Mobile)
![유지보수 (Mobile)](photo/docs/maintenance-mobile.png)

### 설정 (Mobile)
![설정 (Mobile)](photo/docs/settings-mobile.png)

---

## 탭별 기능 설명

### 1) 홈

- 프린터 상태/진행률/남은시간/완료예정/속도/유량/팬/높이 표시
- 실시간 비용 견적(재료비/전기세)
- 경고/에러 카드 + 즉시 조치 버튼
- BLTouch 자동레벨링 실행 및 결과 팝업

### 2) 프린터

- 파일 업로드/삭제/출력 시작
- 현재 출력 상태와 파일 메타데이터 확인

### 3) 웹캠

- CAM1/CAM2 선택
- 회전(0/90/180/270), 좌우반전
- 보정(업스케일, 노이즈, 대비, 밝기, 채도)
- 스냅샷 저장, 전체화면

### 4) AI 챗봇

- Free/Paid 모드 전환
- Paid 모델 선택(Flash/Pro)
- 복사/요약/재생성 버튼
- 대화 이력 중앙 저장 + 다중기기 동기화

### 5) 3D 도안

- 도안 사이트 모음
- 웹 슬라이서 모음
- 생성기/칼리브레이션/검색 리소스 허브
- 즐겨찾기/검색/필터

### 6) 유지보수

- 정비 상태 카드(노즐/윤활/필라멘트)
- 로그 기록/체크리스트
- 베드메쉬 이력 저장 + 3D 평탄도 시각화

### 7) 도구

- E-step, Flow, PID, 리트랙션 계산기
- 모션 프로파일 계산 및 그래프
- 실패 증상 트리아지

### 8) 리포트

- 출력 완료 자동 리포트
- 품질 하락 원인, 경고 타임라인, 비용 추이
- 리포트 목록/필터/상세/삭제

### 9) 설정

- 프린터/웹캠/날씨/성능/알림/AI/API 키/프로필
- 테마, UI, 백업/복원
- 알림 권한 상태 및 실패 원인 안내

---

## 아키텍처 (현재 구현)

- Moonraker: WebSocket 우선 + HTTP 폴백
- 중앙 저장 API: `server/index.js` (Express)
- 저장소: `server/data/store.json`
- 실시간 동기화: SSE (`GET /lzapi/events`)
- 프론트 API 유틸: `src/utils/centralApi.js`

### 중앙 API

- `GET /lzapi/health`
- `GET/PUT /lzapi/settings`
- `GET/POST/DELETE /lzapi/mesh-history`
- `GET/POST/DELETE /lzapi/reports`, `DELETE /lzapi/reports/:id`
- `GET/PUT /lzapi/maintenance/state`
- `GET/POST/DELETE /lzapi/maintenance/logs`
- `GET/PUT /lzapi/maintenance/checklist`
- `GET/PUT/DELETE /lzapi/chat/messages`
- `GET /lzapi/events`

### 동기화 정책

- 서버 우선 저장 + localStorage fallback
- SSE 이벤트 payload(action/item/data)로 patch 반영
- 베드메쉬 저장 실패 시 `pending-mesh-history-v1` 큐에 적재 후 자동 재시도

---

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

### 개발 실행

```bash
npm run dev
```

`npm run dev`는 웹(5173) + API(8787)를 같이 실행합니다.

### 빌드

```bash
npm run build
npm run preview
```

---

## 보안 가이드

- 민감값은 `.env.local`에만 저장
- `.env`, `.env.local`, `.env.*`는 Git 추적 제외
- `server/data/store.json`은 Git 추적 제외
- API 키 유출 이력이 있으면 즉시 키 폐기/재발급

### 알림 권한 참고

- Notification 권한 요청은 HTTPS/localhost에서 정상 동작
- `http://172.x.x.x` 환경에서는 브라우저 정책으로 제한될 수 있음

---

## 문서

- 프로젝트 상세 가이드: `LAYER_ZERO_PROJECT_GUIDE.md`
- 중앙 저장 아키텍처: `docs/central-db/CENTRAL_DB_ARCHITECTURE.md`
- 프론트 전환 맵: `docs/central-db/FRONTEND_MIGRATION_MAP.md`
