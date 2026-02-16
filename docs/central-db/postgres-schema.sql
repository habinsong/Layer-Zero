-- Layer Zero Central DB Schema (PostgreSQL 15+)
-- 목적: 다중기기 동기화(설정/리포트/레벨링/유지보수/챗) 지원

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 사용자
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR username IS NOT NULL)
);

-- 2) 리프레시 토큰(세션)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_name TEXT,
  user_agent TEXT,
  ip_addr TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- 3) 사용자 설정(1:1)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  printer_name TEXT NOT NULL DEFAULT 'Layer Zero Printer',
  klipper_host TEXT NOT NULL DEFAULT '127.0.0.1:7125',
  webcam_url_1 TEXT,
  webcam_url_2 TEXT,

  theme TEXT NOT NULL DEFAULT 'dark',
  language TEXT NOT NULL DEFAULT 'ko',

  weather_city TEXT NOT NULL DEFAULT '서울시',
  weather_lat DOUBLE PRECISION NOT NULL DEFAULT 37.5665,
  weather_lon DOUBLE PRECISION NOT NULL DEFAULT 126.9780,

  filament_cost_per_kg NUMERIC(12,2) NOT NULL DEFAULT 18000,
  electricity_cost_per_kwh NUMERIC(12,2) NOT NULL DEFAULT 200,

  dashboard_poll_ms INTEGER NOT NULL DEFAULT 5000,
  dashboard_stats_poll_ms INTEGER NOT NULL DEFAULT 60000,

  notify_print_complete BOOLEAN NOT NULL DEFAULT TRUE,

  -- 민감값(서버 암호화 권장)
  ai_free_api_key_enc TEXT,
  ai_paid_api_key_enc TEXT,

  -- 동기화 충돌 제어용
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) 베드 메쉬 이력
CREATE TABLE IF NOT EXISTS bed_mesh_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  source TEXT NOT NULL DEFAULT 'home-auto-level',
  filename TEXT,

  rows INTEGER NOT NULL,
  cols INTEGER NOT NULL,
  min_value NUMERIC(10,5),
  max_value NUMERIC(10,5),
  avg_value NUMERIC(10,5),

  -- [[...],[...]] 형태
  matrix_json JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bed_mesh_user_created ON bed_mesh_histories(user_id, created_at DESC);

-- 5) 출력 리포트
CREATE TABLE IF NOT EXISTS print_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  filename TEXT,
  state TEXT NOT NULL DEFAULT 'complete',

  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,
  progress NUMERIC(6,3),

  quality_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  key_issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  speed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  temperatures_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  quality_timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  alert_timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_reports_user_created ON print_reports(user_id, created_at DESC);

-- 6) 유지보수 로그
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_user_created ON maintenance_logs(user_id, created_at DESC);

-- 7) 유지보수 체크리스트 상태
CREATE TABLE IF NOT EXISTS maintenance_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  checklist_key TEXT NOT NULL,
  label TEXT NOT NULL,
  period TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, checklist_key)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_checklists_user ON maintenance_checklists(user_id);

-- 8) 챗 세션
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  model_mode TEXT NOT NULL DEFAULT 'free', -- free | paid
  model_name TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

-- 9) 챗 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role TEXT NOT NULL, -- user | assistant | system
  content TEXT NOT NULL,

  token_usage_json JSONB,
  meta_json JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at ASC);

-- 10) 감사 로그(선택)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

COMMIT;
