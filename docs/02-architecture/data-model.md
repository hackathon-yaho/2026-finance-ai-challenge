# 데이터 모델

> 출처: `../00-context/prd.md` §7, §5.1. **개인정보 무저장 원칙에 따라 Supabase의 영속 테이블은 익명 통계 전용입니다.** 개인 식별 가능 정보(대화 내용, 계좌번호, 이미지 등)는 어떤 테이블에도 저장하지 않습니다.
>
> **Supabase는 백엔드만 접근합니다.** AI-server는 Supabase에 접근하지 않으며, 이미지는 Storage를 거치지 않고 백엔드→AI-server 간 메모리로 직접 전달됩니다(자세한 배경은 `system-architecture.md` 개정 노트 참조).

## Supabase — 영속 테이블 (익명 통계만)

```sql
-- 익명 세션 통계 (개인 식별 정보 없음)
create table session_stat (
  id            bigserial primary key,
  session_hash  char(16) not null,        -- 랜덤 해시. 역추적 불가
  created_at    timestamptz default now(),
  last_stage    smallint,                 -- 도달 단계 1~5
  reason_type   text,                     -- 재화/용역/채권/미확정
  verdict       text,                     -- 일부해제가능/추가소명/기각가능
  evidence_cnt  smallint,
  completed     boolean default false
);

-- 단계별 이탈 추적
create table stage_event (
  id            bigserial primary key,
  session_hash  char(16) not null,
  stage         smallint not null,
  event         text not null,            -- enter / complete / abandon
  occurred_at   timestamptz default now()
);

-- 킵얼라이브 (03-infra-ops/deployment-and-uptime.md 참조)
create table keepalive (
  id          bigserial primary key,
  pinged_at   timestamptz default now()
);

create index idx_stat_created on session_stat(created_at);
create index idx_event_session on stage_event(session_hash);
```

`session_hash`는 세션 생성 시 서버에서 발급하는 랜덤 해시이며, 실제 사용자 식별자(IP, 계정 등)로부터 역산할 수 없어야 합니다.

## 인메모리 세션 (DB에 저장하지 않음)

```java
record Session(
    String hash,
    Instant expiresAt,              // 30분 TTL
    Map<String,String> intake,      // 문진 5문항
    List<ExtractedEvent> timeline,
    Signals signals,
    Verdict verdict,
    String draftText
) {}
```

이 구조체가 담고 있는 모든 내용(문진 응답, 추출된 타임라인, 소명서 텍스트)은 세션 종료 또는 30분 무활동 시 완전히 삭제됩니다. Redis 등 외부 저장소를 쓰더라도 TTL을 반드시 걸어야 합니다.

## 이미지 처리 (Storage를 거치지 않음)

| 항목 | 값 |
| --- | --- |
| 경유 서비스 | 브라우저 → 백엔드(메모리) → AI-server(메모리) → LLM API |
| 영구 보관 | 없음 |
| 삭제 시점 | 백엔드: AI-server 응답 수신 즉시 / AI-server: LLM 응답 수신 즉시 |

이미지 전달 방식(멀티파트 포워딩 vs base64)은 `internal-api-contract.md`에서 백엔드·AI 담당이 확정합니다.

## 백엔드 구현 체크리스트

- [ ] `session_stat`, `stage_event`, `keepalive` 테이블 마이그레이션 스크립트 작성 (백업이 없으므로 스키마를 코드로 관리)
- [ ] 세션 TTL 만료 시 인메모리 데이터 정리 스케줄러
- [ ] 이미지가 백엔드·AI-server 어느 쪽에도 디스크에 기록되지 않는지 확인 (메모리 처리만)
- [ ] 로그에 이미지 내용·추출 텍스트가 남지 않는지 확인 (NFR-08)
