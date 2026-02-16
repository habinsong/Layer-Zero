# Layer Zero 프로젝트 가이드

![Layer Zero 홈 화면 (Light)](photo/docs/home-light.png)

Layer Zero는 Klipper 기반 3D 프린터 운영을 위해 만든 통합 웹 콘솔입니다.
이 문서는 기능 설명을 넘어, 실제 운영 관점에서 설치/연결/동기화/유지보수까지 빠짐없이 정리한 기준 문서입니다.

## 1. 프로젝트 목표
- 운영 중 판단 속도 향상: 핵심 상태를 한 화면에 집중
- 반복 작업 단순화: 자주 쓰는 제어를 클릭 기반으로 자동화
- 다중 기기 일관성: 어디서 접속해도 같은 설정/이력 사용
- 품질 개선 루프 구축: 출력 이력과 유지보수 기록 누적

## 2. 정보 구조 (탭 구성)
- 홈(Home): 실시간 상태 + 핵심 제어 + 경고/환경
- 프린터(Printer): Klipper 원본 UI 임베드
- 웹캠(Webcam): 듀얼 카메라 모니터링/보정
- AI 챗봇: 3D 프린팅 특화 대화형 보조
- 3D 도안: 도안/슬라이서/리소스 허브
- 유지보수(Maintenance): 소모품/체크리스트/로그/베드 메쉬 이력
- 도구(Tools): 캘리브레이션 계산기/분석 도구
- 리포트(Reports): 출력 완료 리포트/품질 분석
- 설정(Settings): 연결/비용/권한/동기화 설정

---

## 3. 탭별 기능 상세

### 3.1 홈 (Home)
![홈 (Light)](photo/docs/home-light.png)
![홈 (Dark)](photo/docs/home-dark.png)

핵심 운영 화면입니다.

주요 기능:
- 프린터 상태, 진행률, 남은 시간(초 단위), 완료 예정 시각
- 노즐/베드 온도, 유량, 속도, 팬, 높이 표시
- 실시간 비용 추정(재료비 + 전기요금)
- 콘솔 명령 전송 및 빠른 액션 버튼
- BLTouch 자동 레벨링(베드 히팅 포함 단계 실행)
- 경고 카드(중요 에러만 요약)
- 외부 환경(날씨/공기질) 표시

### 3.2 프린터 (Printer)
![프린터 (Light)](photo/docs/printer-light.png)
![프린터 (Dark)](photo/docs/printer-dark.png)

Klipper/Mainsail/Fluidd 인터페이스를 그대로 임베드합니다.

주요 기능:
- G-code 파일 확인/실행 흐름 연동
- Klipper 원본 기능 접근
- 설정 파일 조정/매크로 운용

### 3.3 웹캠 (Webcam)
![웹캠 (Light)](photo/docs/webcam-light.png)
![웹캠 (Dark)](photo/docs/webcam-dark.png)

ESP32-CAM 기반 환경을 고려해 경량 모니터링에 맞췄습니다.

주요 기능:
- 웹캠 1/2 전환
- 회전(0/90/180/270), 좌우 반전
- 업스케일/노이즈 보정/밝기/대비/채도 조정
- 스냅샷 및 전체화면 보기

### 3.4 AI 챗봇
![AI 챗봇 (Light)](photo/docs/chatbot-light.png)
![AI 챗봇 (Dark)](photo/docs/chatbot-dark.png)

3D 프린팅 트러블슈팅/설정 상담에 특화된 보조 도구입니다.

주요 기능:
- Free / Paid 모드 전환
- Paid 모델 선택(Flash/Pro)
- 대화 유지/동기화
- 최근 답변 복사/요약/재생성
- 모바일 폰트 크기 제어

### 3.5 3D 도안
![도안 사이트 (Light)](photo/docs/models-models-light.png)
![웹 슬라이서 (Light)](photo/docs/models-slicers-light.png)
![생성기 (Light)](photo/docs/models-generators-light.png)
![칼리브레이션 (Light)](photo/docs/models-calibration-light.png)
![리소스 (Light)](photo/docs/models-resources-light.png)

도안 탐색부터 출력 준비까지 한 탭에서 연결합니다.

주요 기능:
- 도안 사이트 북마크/태그 필터
- 웹 슬라이서 바로가기
- 생성기/캘리브레이션 리소스 모음

### 3.6 유지보수 (Maintenance)
![유지보수 (Light)](photo/docs/maintenance-light.png)
![유지보수 (Dark)](photo/docs/maintenance-dark.png)

장비 상태를 수치화해 관리하기 위한 탭입니다.

주요 기능:
- 소모품/주기성 작업 추적
- 유지보수 로그 기록
- 체크리스트 동기화
- 베드 메쉬 이력 저장 및 3D 시각화

### 3.7 도구 (Tools)
![도구 (Light)](photo/docs/tools-light.png)
![도구 (Dark)](photo/docs/tools-dark.png)

출력 품질 튜닝 도구 모음입니다.

주요 기능:
- E-step 계산기
- Flow Rate 계산기
- PID 보조 계산
- 리트랙션/모션 관련 보조 도구

### 3.8 리포트 (Reports)
![리포트 (Light)](photo/docs/reports-light.png)
![리포트 (Dark)](photo/docs/reports-dark.png)

출력 완료 데이터와 품질 변동을 복기하는 탭입니다.

주요 기능:
- 출력 완료 리포트 자동 저장
- 품질 하락 구간/원인 요약
- 비용 추이 및 상세 값 확인

### 3.9 설정 (Settings)
![설정 (Light)](photo/docs/settings-light.png)
![설정 (Dark)](photo/docs/settings-dark.png)

운영의 기준값을 설정하는 탭입니다.

주요 기능:
- Klipper 주소, 웹캠 URL, 날씨 위치
- 재료비/전기요금 기준값
- 알림/권한 요청
- 데이터 초기화 및 동기화 상태

---

## 4. 동기화/저장 아키텍처

### 4.1 저장소
- 중앙 저장 파일: `server/data/store.json`
- API 서버: `server/index.js` (`/lzapi/*`)
- 실시간 이벤트: `SSE (/lzapi/events)`

### 4.2 저장되는 데이터
- `settings`
- `meshHistory`
- `reports`
- `maintenance.state`
- `maintenance.logs`
- `maintenance.checklist`
- `chat.messages`

### 4.3 폴백 전략
- 서버 연결 가능: 중앙 저장소 우선
- 서버 연결 불가: LocalStorage 임시 사용
- 재연결 시: 중앙 상태 재동기화

---

## 5. 설치/실행

### 5.1 요구사항
- Node.js 18+
- npm
- Moonraker (Klipper)

### 5.2 설치
```bash
git clone https://github.com/habinsong/Layer-Zero.git
cd Layer-Zero
npm install
cp .env.example .env.local
```

### 5.3 개발 실행
```bash
npm run dev
```
- UI: `http://localhost:5173`
- API: `http://localhost:8787`

---

## 6. 환경 변수 가이드

`/.env.local` 기준:

| 변수 | 설명 |
|---|---|
| `VITE_DEFAULT_PRINTER_NAME` | 초기 프린터 표시명 |
| `VITE_DEFAULT_KLIPPER_IP` | Moonraker 주소(보통 `IP:7125`) |
| `VITE_DEFAULT_WEBCAM_URL` | 웹캠 1 URL |
| `VITE_DEFAULT_WEBCAM_URL2` | 웹캠 2 URL |
| `VITE_DEFAULT_WEATHER_CITY` | 날씨 기본 도시명 |
| `VITE_DEFAULT_WEATHER_LAT` | 날씨 위도 |
| `VITE_DEFAULT_WEATHER_LON` | 날씨 경도 |
| `VITE_MOONRAKER_FALLBACK_IP` | 폴백용 Moonraker IP |
| `VITE_DEV_PROXY_TARGET` | Vite `/api` 프록시 대상 |
| `VITE_APP_API_BASE` | 중앙 API prefix (`/lzapi`) |
| `VITE_APP_API_TARGET` | Vite `/lzapi` 프록시 대상 |
| `VITE_DEFAULT_AI_FREE_API_KEY` | 무료 모드 기본 API 키 |
| `VITE_DEFAULT_AI_PAID_API_KEY` | 유료 모드 기본 API 키 |

---

## 7. 서버 안 꺼지게 운영하기

### 7.1 기본 스크립트
```bash
chmod +x start-server.sh
./start-server.sh
```

### 7.2 PM2 직접 운용
```bash
pm2 start ecosystem.config.cjs
pm2 list
pm2 logs web-print
pm2 restart web-print
pm2 stop web-print
pm2 delete web-print
```

### 7.3 재부팅 자동 시작
```bash
pm2 save
pm2 startup
```

---

## 8. 장애 대응 체크리스트

### 8.1 OFFLINE 표시
1. Moonraker 포트 확인 (`7125`)
2. 설정 탭 주소와 실제 장비 주소 일치 확인
3. Moonraker CORS/trusted_clients 확인
4. 브라우저 Network 탭에서 `/api/*` 응답 확인

### 8.2 파일 목록은 보이는데 업로드 실패
- Moonraker `file_manager` 권한/경로 확인
- 업로드 최대 용량(`max_upload_size`) 확인

### 8.3 iOS Safari 복귀 시 멈춤
- 현재 구조는 HTTP 폴백 후 WS 재연결 로직 포함
- 그래도 멈추면 새로고침 후 네트워크 상태 확인

### 8.4 알림 미동작
- 브라우저 정책상 HTTPS 또는 localhost 환경 필요
- iOS PWA의 제한사항 확인 필요

---

## 9. 보안 운영 권장사항
- `.env.local` 커밋 금지
- 공개 배포 전 API 키 제거/교체
- 외부망 공개 시 VPN 또는 Reverse Proxy + HTTPS 적용
- `server/data/store.json`은 민감정보 포함 가능, 접근 제어 필수

---

## 10. 개발 참고
- 상세 실행 스크립트: `package.json`, `start-server.sh`, `ecosystem.config.cjs`
- 프록시 설정: `vite.config.js`
- 중앙 저장소 API: `server/index.js`
