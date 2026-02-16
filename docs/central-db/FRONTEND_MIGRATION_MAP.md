# Frontend Migration Map (현행 상태)

이 문서는 Layer Zero 프론트에서
`localStorage -> 중앙 저장 API(/lzapi)` 전환 상태를 정리합니다.

## 1. 전환 상태 요약

- [x] SettingsContext 서버 연동
- [x] Reports 서버 연동
- [x] Maintenance 서버 연동
- [x] Chat messages 서버 연동
- [x] Bed mesh history 서버 연동
- [x] SSE 구독 + 변경분 patch 반영
- [x] localStorage fallback 유지

## 2. 모듈별 상태

### 2.1 Settings

파일:

- `src/context/SettingsContext.jsx`
- `src/pages/Settings.jsx`
- `src/contexts/ThemeContext.jsx`

서버 연동:

- `GET/PUT /lzapi/settings`
- `settings.updated` 수신 후 즉시 반영

### 2.2 Reports

파일:

- `src/utils/reportManager.js`
- `src/pages/Reports.jsx`

서버 연동:

- `GET/POST/DELETE /lzapi/reports`
- `reports.updated` 이벤트로 upsert/delete/clear patch 반영

### 2.3 Maintenance

파일:

- `src/pages/Maintenance.jsx`

서버 연동:

- `GET/PUT /lzapi/maintenance/state`
- `GET/POST/DELETE /lzapi/maintenance/logs`
- `GET/PUT /lzapi/maintenance/checklist`
- `GET/POST/DELETE /lzapi/mesh-history`

이벤트:

- `maintenance.state.updated`
- `maintenance.logs.updated`
- `maintenance.checklist.updated`
- `mesh.updated`

### 2.4 AI Chatbot

파일:

- `src/pages/AiChatbot.jsx`

서버 연동:

- `GET/PUT/DELETE /lzapi/chat/messages`
- `chat.messages.updated` 이벤트 patch 반영

### 2.5 Webcam / Favorites / Console history / Profiles

파일:

- `src/pages/Webcam.jsx`
- `src/pages/ModelSites.jsx`
- `src/pages/Home.jsx`
- `src/pages/Settings.jsx`

처리 방식:

- Settings payload에 포함해 서버 동기화
- localStorage는 fallback/호환 용도로 유지

## 3. fallback 상세

- 저장 실패 시 localStorage 유지
- 로드시 서버가 우선, 없으면 localStorage 사용
- 이벤트 미수신/불완전 payload 시 해당 리소스만 재조회

## 4. 남은 고도화 항목

- [ ] 중앙 저장을 PostgreSQL로 이전
- [ ] 사용자 인증/권한 모델 도입
- [ ] 이벤트 origin 식별 후 자기 이벤트 무시
- [ ] 충돌 제어(optimistic lock) 고도화

