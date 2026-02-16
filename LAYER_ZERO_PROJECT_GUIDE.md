# Layer Zero 프로젝트 가이드

![Layer Zero 홈 화면 (다크)](photo/home.png)
![Layer Zero 홈 화면 (라이트)](<photo/home(light).png>)

Layer Zero는 Klipper 기반 3D 프린터 운영을 위한 실전형 웹 콘솔입니다.

## 1. 프로젝트 목적

- 출력 중 상태 판단 시간을 줄인다.
- 문제 발생 시 즉시 조치할 수 있게 한다.
- 출력 결과를 리포트로 저장해 다음 출력 품질을 올린다.

## 2. 핵심 기능

### 2.1 홈

- 진행률(원형 프로그레스) + ETA + 출력 세부 지표
- 온도/팬/유량/높이/비용 실시간 표시
- 경고/에러 카드 + 원클릭 조치
- BLTouch 자동레벨링 실행 및 결과 팝업

### 2.2 자동레벨링

실행 순서:

1. 베드 50도 가열
2. `G28`
3. `BED_MESH_CALIBRATE`
4. 메쉬 결과 수집
5. `SAVE_CONFIG`

결과:

- 레벨링 값 테이블
- 3D 평탄도 그래프
- 유지보수 탭 이력 저장

### 2.3 웹캠

- CAM1/CAM2 선택
- 회전(0/90/180/270), 좌우반전
- 보정(업스케일/노이즈/대비/밝기/채도)
- 모바일/PC 반응형 뷰

### 2.4 AI 챗봇

- Free/Paid 모드
- Paid 모델 선택: Flash/Pro
- 최근 답변 복사/요약/재생성
- 대화 기록 중앙 저장

### 2.5 유지보수/리포트

- 점검 체크리스트, 로그, 주기 관리
- 출력 완료 리포트 자동 생성/저장
- 품질 하락 구간, 경고 타임라인, 비용 추이

## 3. 데이터 저장 구조 (현재)

### 3.1 중앙 저장

- 파일: `server/data/store.json`
- 엔드포인트: `/lzapi/*`
- 실시간 이벤트: `/lzapi/events` (SSE)

### 3.2 로컬 fallback

- 서버 저장 실패 시 localStorage 사용
- 네트워크 복구 후 서버 동기화

## 4. 실시간 동기화

- `settings.updated`
- `reports.updated`
- `maintenance.state.updated`
- `maintenance.logs.updated`
- `maintenance.checklist.updated`
- `mesh.updated`
- `chat.messages.updated`

각 이벤트는 변경분(action/item/data) payload를 포함하며, 프론트는 전체 재조회 대신 patch 반영을 우선 사용합니다.

## 5. 설치/실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

배포 확인:

```bash
npm run build
npm run preview
```

## 6. 운영 팁

- 다중 기기 환경: SSE로 동기화되므로 동일 계열 UI 상태가 빠르게 맞춰짐
- iOS Safari: 백그라운드 복귀 시 WS 폴백 동작 가능 (구조상 자동 복구)
- 웹캠 메모리 부담 시: 보정값/새로고침 빈도 조절 권장

## 7. 보안 체크리스트

- `.env.local`만 사용하고 커밋 금지
- `server/data/store.json` 커밋 금지
- API 키는 설정 입력 후 서버에도 저장될 수 있으므로 저장소 유출 시 즉시 키 폐기/재발급

