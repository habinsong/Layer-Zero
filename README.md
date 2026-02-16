# Layer Zero

![Layer Zero 홈 화면 (Light)](photo/docs/home-light.png)

> Klipper + Moonraker 기반 3D 프린터를 위한 모바일 친화형 통합 운영 콘솔

![홈 대시보드 (Dark)](photo/docs/home-dark.png)

## 프로젝트 소개
Layer Zero는 "출력 준비 → 출력 중 모니터링/제어 → 완료 리포트/유지보수" 흐름을 한 곳에서 처리하기 위한 웹 애플리케이션입니다.

기존처럼 여러 페이지를 오가며 상태를 확인하지 않아도, 홈 대시보드와 사이드 탭만으로 운영이 가능하도록 설계되어 있습니다.

## 주요 특징
- 실시간 대시보드: 진행률, 남은 시간, 온도, 속도, 팬, 비용 추정
- Moonraker 제어: 콘솔 명령, 매크로, 긴급 정지, 자동 레벨링
- 듀얼 웹캠: ESP32-CAM 2채널, 회전/반전/보정
- AI 챗봇: Free/Paid 모드, 모델 선택, 대화 이력 동기화
- 유지보수: 소모품 추적, 점검 체크리스트, 로그
- 리포트: 출력 완료 데이터 자동 기록 및 상세 분석
- 중앙 저장소: 다중 기기에서 동일 데이터 공유 (SSE 실시간 동기화)

## 화면 미리보기
### 홈 / 프린터 / 웹캠
| 홈 | 프린터 | 웹캠 |
|---|---|---|
| ![홈](photo/docs/home-light.png) | ![프린터](photo/docs/printer-light.png) | ![웹캠](photo/docs/webcam-light.png) |

### AI 챗봇 / 유지보수 / 리포트
| AI 챗봇 | 유지보수 | 리포트 |
|---|---|---|
| ![챗봇](photo/docs/chatbot-light.png) | ![유지보수](photo/docs/maintenance-light.png) | ![리포트](photo/docs/reports-light.png) |

### 3D 도안 / 도구 / 설정
| 3D 도안 | 도구 | 설정 |
|---|---|---|
| ![3D 도안](photo/docs/models-models-light.png) | ![도구](photo/docs/tools-light.png) | ![설정](photo/docs/settings-light.png) |

---

## 빠른 시작 (로컬 개발)
### 1) 요구 사항
- Node.js 18 이상
- npm
- Moonraker가 설치된 Klipper 장비

### 2) 설치
```bash
git clone https://github.com/habinsong/Layer-Zero.git
cd Layer-Zero
npm install
```

### 3) 환경 변수 설정
```bash
cp .env.example .env.local
```

`/.env.local` 예시:
```env
VITE_DEFAULT_PRINTER_NAME=KP3S PRO
VITE_DEFAULT_KLIPPER_IP=172.30.1.83:7125
VITE_DEFAULT_WEBCAM_URL=http://172.30.1.72/capture_flash
VITE_DEFAULT_WEBCAM_URL2=http://172.30.1.93/capture_flash
VITE_DEFAULT_WEATHER_CITY=서울시
VITE_DEFAULT_WEATHER_LAT=37.5665
VITE_DEFAULT_WEATHER_LON=126.9780
VITE_MOONRAKER_FALLBACK_IP=172.30.1.83

VITE_DEV_PROXY_TARGET=http://172.30.1.83:7125
VITE_APP_API_BASE=/lzapi
VITE_APP_API_TARGET=http://127.0.0.1:8787

VITE_DEFAULT_AI_FREE_API_KEY=
VITE_DEFAULT_AI_PAID_API_KEY=
```

### 4) 실행
```bash
npm run dev
```

실행 후 접근:
- 웹 UI: `http://localhost:5173`
- 중앙 API: `http://localhost:8787/lzapi/health`

---

## 서버 안 꺼지게 운영하기 (PM2)
Layer Zero는 프론트엔드(Vite) + 중앙 API(Node/Express)를 함께 사용하므로, 장시간 운영 시 PM2 사용을 권장합니다.

### 방법 A) 프로젝트 기본 스크립트 사용
```bash
chmod +x start-server.sh
./start-server.sh
```

### 방법 B) PM2 직접 실행
```bash
# 앱 시작
pm2 start ecosystem.config.cjs

# 상태 확인
pm2 list

# 로그
pm2 logs web-print

# 재시작 / 중지 / 삭제
pm2 restart web-print
pm2 stop web-print
pm2 delete web-print
```

### 재부팅 후 자동 시작
```bash
pm2 save
pm2 startup
```

> `pm2 startup`이 출력하는 마지막 명령을 한 번 더 실행해야 자동 시작 설정이 완료됩니다.

---

## 데이터 저장/동기화 구조
- 저장 파일: `server/data/store.json`
- 동기화 방식: SSE (`/lzapi/events`)
- 주요 저장 대상:
  - 설정값(`settings`)
  - 베드 레벨링 이력(`meshHistory`)
  - 리포트(`reports`)
  - 유지보수 상태/로그/체크리스트(`maintenance.*`)
  - AI 챗봇 메시지(`chat.messages`)

브라우저 LocalStorage는 오프라인/폴백 용도로만 사용되며, 서버 연결 시 중앙 저장소를 우선 사용합니다.

---

## Moonraker 연결 체크리스트
설정 저장 후 OFFLINE이 뜨는 경우 아래를 우선 점검하세요.

1. Moonraker 실제 포트 확인 (`7125` 기본)
2. CORS / trusted_clients 설정 확인
3. `VITE_DEV_PROXY_TARGET` 또는 설정 탭의 Klipper 주소 확인
4. 브라우저 콘솔의 `/api/...` 응답 코드 확인

---

## 빌드/품질 확인
```bash
npm run lint
npm run build
```

---

## 보안 주의사항
- `.env.local`은 절대 커밋하지 마세요.
- API 키는 설정 탭에서 바꾸더라도 중앙 저장소에 남을 수 있으므로, 공개 저장소 배포 전 초기화/교체를 권장합니다.
- 내부망 외부 공개 시 HTTPS/인증/방화벽 정책을 반드시 적용하세요.

---

## 문서
- 상세 가이드: [LAYER_ZERO_PROJECT_GUIDE.md](LAYER_ZERO_PROJECT_GUIDE.md)

---

## 라이선스
현재 별도 라이선스 파일이 없으면 All rights reserved 상태입니다.
오픈소스로 공개할 계획이라면 `LICENSE` 파일을 추가하세요.
