-- 근거: docs/02-architecture/data-model.md "Supabase — 영속 테이블 (익명 통계만)"
-- 백업이 없으므로 스키마를 코드로 관리한다. 로컬(compose Postgres)·배포(Supabase) 양쪽에 그대로 적용한다.
-- 개인 식별 가능 정보는 이 3테이블 중 어디에도 넣지 않는다.

create table session_stat (
  id            bigserial primary key,
  session_hash  char(16) not null,        -- 랜덤 해시. 역추적 불가
  created_at    timestamptz default now(),
  last_stage    smallint,                 -- 도달 단계 1~5
  reason_type   text,                     -- 재화/용역/채권/미확정
  readiness     text,     -- SUBMISSION_READY / SUPPLEMENT_NEEDED / BANK_CHECK_REQUIRED
  evidence_cnt  smallint,
  completed     boolean default false
);

create table stage_event (
  id            bigserial primary key,
  session_hash  char(16) not null,
  stage         smallint not null,
  event         text not null,            -- enter / complete / abandon
  occurred_at   timestamptz default now()
);

create table keepalive (
  id          bigserial primary key,
  pinged_at   timestamptz default now()
);

create index idx_stat_created on session_stat(created_at);
create index idx_event_session on stage_event(session_hash);
