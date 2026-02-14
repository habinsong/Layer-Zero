#!/bin/bash

# PM2 백그라운드 실행 스크립트

echo "🚀 웹서버를 백그라운드로 실행합니다..."

# 1. PM2가 설치되어 있는지 확인
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2를 설치합니다..."
    npm install -g pm2
fi

# 2. 기존 실행 중인 프로세스 종료
echo "🔄 기존 프로세스를 정리합니다..."
pm2 delete web-print 2>/dev/null || true

# 3. 새로 시작
echo "▶️  서버를 시작합니다..."
pm2 start ecosystem.config.cjs

# 4. 자동 재시작 설정 저장
echo "💾 재부팅 후 자동 실행 설정을 저장합니다..."
pm2 save

# 5. 상태 확인
echo ""
echo "✅ 서버가 백그라운드에서 실행 중입니다!"
echo ""
pm2 list
echo ""
echo "📊 로그 확인: pm2 logs web-print"
echo "⏹️  종료하기: pm2 stop web-print"
echo "🔄 재시작: pm2 restart web-print"
echo "❌ 완전 삭제: pm2 delete web-print"
