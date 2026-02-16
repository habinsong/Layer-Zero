# Layer Zero 프로젝트 가이드

![홈 (Desktop)](photo/docs/home-desktop.png)

Layer Zero는 3D 프린터 운영에서 필요한 기능을 한 화면 체계로 묶은 통합 웹 콘솔입니다.

## 1. 프로젝트 목표

- 상태 파악 시간을 줄이고 빠르게 판단
- 에러/경고 발생 시 즉시 조치
- 출력 결과를 누적해 품질 개선 루프 형성

## 2. IA(정보 구조)

- 홈
- 프린터
- 웹캠
- AI 챗봇
- 3D 도안
- 유지보수
- 도구
- 리포트
- 설정

## 3. 탭별 상세

### 3.1 홈
![홈 (Desktop)](photo/docs/home-desktop.png)

핵심 항목:

- 상태/진행률/남은시간/완료예정
- 온도/속도/유량/팬/높이
- 실시간 비용 견적
- 경고/에러 카드
- BLTouch 자동레벨링 버튼

BLTouch 자동레벨링 절차:

1. 베드 50도 가열
2. `G28`
3. `BED_MESH_CALIBRATE`
4. 메쉬 결과 수집
5. `SAVE_CONFIG`

저장 안정성:

- 서버 저장 실패 시 `pending-mesh-history-v1` 큐에 적재
- 다음 저장/재접속 시 자동 재전송

### 3.2 프린터
![프린터 (Desktop)](photo/docs/printer-desktop.png)

- 파일 업로드/삭제/출력 시작
- 출력 관련 메타데이터 및 상태 확인

### 3.3 웹캠
![웹캠 (Desktop)](photo/docs/webcam-desktop.png)
![웹캠 (Mobile)](photo/docs/webcam-mobile.png)

- CAM1/CAM2 전환
- 회전/반전
- 업스케일/노이즈/대비/밝기/채도 보정
- 스냅샷/전체화면

### 3.4 AI 챗봇
![AI 챗봇 (Desktop)](photo/docs/chatbot-desktop.png)
![AI 챗봇 (Mobile)](photo/docs/chatbot-mobile.png)

- Free/Paid 모드
- Paid 모델(Flash/Pro)
- 복사/요약/재생성
- 대화 이력 중앙 저장 + SSE 동기화

### 3.5 3D 도안
![도안 사이트](photo/docs/models-models-desktop.png)
![웹 슬라이서](photo/docs/models-slicers-desktop.png)
![생성기](photo/docs/models-generators-desktop.png)
![칼리브레이션](photo/docs/models-calibration-desktop.png)
![검색 & 리소스](photo/docs/models-resources-desktop.png)

- 카테고리별 사이트 큐레이션
- 검색/태그/즐겨찾기

### 3.6 유지보수
![유지보수 (Desktop)](photo/docs/maintenance-desktop.png)
![유지보수 (Mobile)](photo/docs/maintenance-mobile.png)

- 점검 카드(노즐/윤활/필라멘트)
- 로그/체크리스트
- 베드메쉬 이력 + 3D 평탄도 그래프

### 3.7 도구
![도구 (Desktop)](photo/docs/tools-desktop.png)

- E-step/Flow/PID/리트랙션
- 모션 프로파일 계산
- 실패 증상 트리아지

### 3.8 리포트
![리포트 (Desktop)](photo/docs/reports-desktop.png)

- 출력 완료 자동 리포트
- 품질 하락 원인, 경고 타임라인, 비용 추이
- 필터/상세/삭제

### 3.9 설정
![설정 (Desktop)](photo/docs/settings-desktop.png)
![설정 (Mobile)](photo/docs/settings-mobile.png)

- 연결(프린터/웹캠/날씨)
- 성능/알림/UI
- AI 키/프로필/백업
- 알림 권한 실패 원인 표시(지원불가/비보안/차단)

## 4. 동기화/데이터 구조

### 4.1 중앙 저장

- API: `/lzapi/*`
- 저장소: `server/data/store.json`
- 실시간: `/lzapi/events` (SSE)

### 4.2 이벤트

- `settings.updated`
- `reports.updated`
- `maintenance.state.updated`
- `maintenance.logs.updated`
- `maintenance.checklist.updated`
- `mesh.updated`
- `chat.messages.updated`

각 이벤트는 변경분 payload(`action/item/data`)를 담아 patch 반영합니다.

### 4.3 fallback

- 서버 실패 시 localStorage fallback
- 복구 후 서버 데이터 우선 동기화

## 5. 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

- 웹: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

`npm run dev`는 웹+API를 동시에 실행합니다.

## 6. 운영 이슈 대응

### 6.1 흰 화면

- 5173만 뜨고 8787이 죽으면 일부 페이지가 비정상 동작 가능
- `npm run dev`로 두 프로세스 동시에 재기동

### 6.2 알림 권한

- HTTPS/localhost 환경에서만 권한 요청이 정상 동작
- 로컬 IP `http://172.x.x.x`는 브라우저 정책으로 차단 가능

### 6.3 베드메쉬 이력 누락

- 서버 저장 실패 시 큐 적재 + 자동 재전송으로 유실 최소화

## 7. 보안 체크리스트

- `.env.local`만 사용
- `.env*`는 커밋 금지
- `server/data/store.json` 커밋 금지
- 키 유출 시 즉시 폐기/재발급
