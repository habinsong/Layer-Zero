# Frontend Migration Map (최신)

현행 코드 기준으로 `localStorage -> 중앙 저장 API(/lzapi)` 전환 완료 범위를 정리합니다.

## 1. 상태 요약

- [x] Settings 서버 연동
- [x] Reports 서버 연동
- [x] Maintenance 서버 연동
- [x] Chat messages 서버 연동
- [x] Bed mesh history 서버 연동
- [x] SSE 구독 + 변경분 patch 반영
- [x] localStorage fallback 유지
- [x] bed mesh pending queue 재전송

## 2. 페이지/모듈별 매핑

## 2.1 Settings

파일:

- `src/context/SettingsContext.jsx`
- `src/pages/Settings.jsx`
- `src/contexts/ThemeContext.jsx`

연동:

- `GET/PUT /lzapi/settings`
- `settings.updated` 이벤트 수신 후 즉시 반영

포함 데이터:

- 연결 정보, 폴링, 알림 옵션, UI 옵션
- 프로필/즐겨찾기/콘솔히스토리/챗봇 사용량/웹캠 뷰 상태 등

## 2.2 Reports

파일:

- `src/utils/reportManager.js`
- `src/pages/Reports.jsx`

연동:

- `GET/POST/DELETE /lzapi/reports`
- `reports.updated` 이벤트 action 기반 patch

## 2.3 Maintenance + Mesh

파일:

- `src/pages/Maintenance.jsx`
- `src/pages/Home.jsx`

연동:

- `GET/PUT /lzapi/maintenance/state`
- `GET/POST/DELETE /lzapi/maintenance/logs`
- `GET/PUT /lzapi/maintenance/checklist`
- `GET/POST/DELETE /lzapi/mesh-history`

복구:

- Home에서 메쉬 저장 실패 시 `pending-mesh-history-v1` 큐 적재
- 다음 시점 자동 flush

## 2.4 AI Chatbot

파일:

- `src/pages/AiChatbot.jsx`

연동:

- `GET/PUT/DELETE /lzapi/chat/messages`
- `chat.messages.updated` 이벤트로 즉시 반영

## 2.5 Webcam / ModelSites / Layout

파일:

- `src/pages/Webcam.jsx`
- `src/pages/ModelSites.jsx`
- `src/layouts/Layout.jsx`
- `src/layouts/Sidebar.jsx`

연동:

- settings payload를 통해 중앙 저장에 포함
- localStorage는 fallback/호환 유지

## 3. SSE 이벤트 소비 전략

- 가능한 경우 이벤트 payload를 직접 patch
- payload가 부족하거나 불확실하면 리소스 단건 fetch fallback
- 전체 reload는 최소화

## 4. 남은 확장 항목

- [ ] PostgreSQL 전환
- [ ] 사용자 인증/권한 분리
- [ ] 이벤트 origin/device 식별로 자기 이벤트 무시
- [ ] optimistic lock/충돌 처리 고도화

## 5. 캡처 기반 QA 참조

- 홈: `photo/docs/home-desktop.png`
- 프린터: `photo/docs/printer-desktop.png`
- 웹캠: `photo/docs/webcam-desktop.png`
- 챗봇: `photo/docs/chatbot-desktop.png`
- 도안(5개 카테고리): `photo/docs/models-*.png`
- 유지보수: `photo/docs/maintenance-desktop.png`
- 도구: `photo/docs/tools-desktop.png`
- 리포트: `photo/docs/reports-desktop.png`
- 설정: `photo/docs/settings-desktop.png`
