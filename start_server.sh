#!/bin/bash
cd "$(dirname "$0")"

# PATH 설정 (필요시 brew 등 경로 포함)
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

# 기존 서버 종료
pkill -f "vite"

# 서버 백그라운드 실행 및 로그 저장
nohup npm run dev > server.log 2>&1 &
SERVER_PID=$!

echo "서버가 시작되었습니다. (PID: $SERVER_PID)"
echo "로그 확인: tail -f server.log"
