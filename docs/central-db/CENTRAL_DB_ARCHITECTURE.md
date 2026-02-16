# Layer Zero 중앙 저장 아키텍처 (현행)

이 문서는 현재 코드 기준 중앙 저장/실시간 동기화 구조를 설명합니다.

## 1. 개요

Layer Zero는 로컬 단독 저장에서 확장해 다음 구조로 동작합니다.

- 프론트: React + Vite
- 중앙 API: `server/index.js` (Express)
- 저장소: `server/data/store.json`
- 실시간 이벤트: SSE (`GET /lzapi/events`)
- 로컬 fallback: localStorage 병행 유지

## 2. 저장 스키마

```json
{
  "meta": {
    "revision": 1,
    "updatedAt": "2026-02-16T00:00:00.000Z",
    "resources": {}
  },
  "settings": {},
  "meshHistory": [],
  "reports": [],
  "maintenance": {
    "state": {},
    "logs": [],
    "checklist": []
  },
  "chat": {
    "messages": []
  }
}
```

## 3. 엔드포인트

- `GET /lzapi/health`
- `GET/PUT /lzapi/settings`
- `GET/POST/DELETE /lzapi/mesh-history`
- `GET/POST/DELETE /lzapi/reports`
- `DELETE /lzapi/reports/:id`
- `GET/PUT /lzapi/maintenance/state`
- `GET/POST/DELETE /lzapi/maintenance/logs`
- `GET/PUT /lzapi/maintenance/checklist`
- `GET/PUT/DELETE /lzapi/chat/messages`
- `GET /lzapi/events`

## 4. 실시간 이벤트 (SSE)

공통 필드:

- `type`
- `revision`
- `at`

리소스별 payload:

- `settings.updated` → `data`
- `reports.updated` → `action`(`upsert/delete/clear`), `item|id`
- `maintenance.state.updated` → `data`
- `maintenance.logs.updated` → `action`(`add/clear`), `item`
- `maintenance.checklist.updated` → `items`
- `mesh.updated` → `action`(`upsert/clear`), `item`
- `chat.messages.updated` → `items`

## 5. 데이터 일관성

- settings 저장은 deep merge
- 변경 시 `meta.revision` 증가
- append 리소스는 최신순/개수 제한 저장
- 프론트는 payload patch 반영 우선
- payload 불충분 시 해당 리소스만 fallback fetch

## 6. fallback/복구 전략

- 서버 실패 시 localStorage에 즉시 기록
- 네트워크 복구 시 서버 우선 동기화
- 베드메쉬는 실패 시 `pending-mesh-history-v1` 큐에 저장 후 자동 재전송

## 7. 보안

- `.env`, `.env.local`, `.env.*` Git 추적 제외
- `server/data/store.json` Git 추적 제외
- API 키 유출 이력 발생 시 키 폐기/재발급

## 8. 운영 권장

- 개발 시 `npm run dev`로 웹(5173)+API(8787) 동시 실행
- 백엔드 헬스체크/자동재기동(pm2/systemd) 권장
- 장기적으로 PostgreSQL/인증/충돌제어 도입 권장

## 9. 화면 참조

- 홈: `photo/docs/home-desktop.png`
- 유지보수: `photo/docs/maintenance-desktop.png`
- 리포트: `photo/docs/reports-desktop.png`
- 설정: `photo/docs/settings-desktop.png`
