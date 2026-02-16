# Layer Zero 중앙 저장 아키텍처 (현재 구현)

## 1. 개요

Layer Zero는 브라우저 단일 저장(localStorage)에서 확장해,
중앙 저장 API(`server/index.js`) + 로컬 fallback 구조를 사용합니다.

- 중앙 저장: `server/data/store.json`
- API Base: `/lzapi`
- 실시간 변경 전파: SSE (`/lzapi/events`)

## 2. 저장 모델

```json
{
  "meta": { "revision": 1, "updatedAt": "...", "resources": {} },
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

## 3. API 엔드포인트

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

## 4. 이벤트 모델 (SSE)

서버는 변경 시 이벤트를 발행합니다.

- `settings.updated` (`data`)
- `mesh.updated` (`action`, `item`)
- `reports.updated` (`action`, `item|id`)
- `maintenance.state.updated` (`data`)
- `maintenance.logs.updated` (`action`, `item`)
- `maintenance.checklist.updated` (`items`)
- `chat.messages.updated` (`items`)

공통 필드:

- `revision`
- `at`

## 5. 정합성 정책

- settings 저장은 deep merge
- 변경마다 `meta.revision` 증가
- append 계열 데이터는 최신순으로 제한 저장
- 클라이언트는 patch 반영 우선, 필요 시 fallback fetch

## 6. fallback 정책

- 서버 요청 실패: localStorage fallback 유지
- 네트워크 복구 시 서버 데이터 우선 반영

## 7. 보안 정책

- 민감값은 `.env.local` 관리
- `.env*`는 Git 추적 제외
- `server/data/store.json` Git 추적 제외
- 키 유출 가능성이 있으면 즉시 폐기/재발급

## 8. 향후 확장 권장

- 파일 JSON 저장소 -> PostgreSQL 전환
- 사용자/기기 단위 인증 도입
- revision 기반 optimistic lock 강화
- 이벤트 내 origin/device 식별로 자기 이벤트 무시 최적화
