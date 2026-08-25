# 데이터 모델

> **수정 기록 (2026-08-24, 백엔드)**
> - 인메모리 세션 구조에 **F5-02 병합 후보·거절 상태 필드** 추가 — `api-contract.md` v1.4의 `mergeCandidates`/`POST /api/timeline/merge`를 반영하면서 세션 쪽이 누락돼 있었습니다. 거절된 후보를 어디에 기록하는지 정의가 없으면 "이후 응답에서 제외" 요구사항(F5-02)을 구현할 수 없습니다
> - 별지 제4호서식 필드가 세션에 없다는 단서 추가 (`spec.md` §5-2와 동기화)

> 출처: `../00-context/prd.md` §7, §5.1. **개인정보 완전 무저장 원칙에 따라 Supabase의 영속 테이블은 익명 통계 전용입니다.** 개인 식별 가능 정보(대화 내용, 계좌번호, 이미지 등)는 어떤 테이블에도 저장하지 않습니다.
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
  readiness     text,     -- SUBMISSION_READY / SUPPLEMENT_NEEDED / BANK_CHECK_REQUIRED
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

## 인메모리 세션 (DB에 저장하지 않음, 백엔드에만 존재)

```java
record Session(
    String hash,
    Instant expiresAt,                        // 30분 TTL
    Map<String,String> intake,                // 문진 6문항
    List<ExtractedEvent> timeline,
    List<MergeCandidate> mergeCandidates,     // F5-02 — 병합 후보 (자동 병합 금지)
    Set<String> rejectedMergeGroupIds,        // F5-02 — approved:false로 거절된 groupId. 이후 mergeCandidates 산출 시 제외
    Signals signals,
    Readiness readiness,
    String draftText,
    Map<String,Boolean> cardConfirmed,        // FR-028 — 카드별 확인 상태
    List<SentenceEvidence> sentenceEvidence,  // FR-046 — (imageIndex, bbox) 참조만
    Map<String,QualityFlags> qualityFlags     // FR-029
) {}
```

이 구조체가 담고 있는 모든 내용(문진 응답, 추출된 타임라인, 소명서 텍스트)은 세션 종료 또는 30분 무활동 시 완전히 삭제됩니다. Redis 등 외부 저장소를 쓰더라도 TTL을 반드시 걸어야 합니다.

**`sentenceEvidence`는 이미지 바이트를 담지 않습니다.** 몇 번째 이미지의 어느 영역인지(순번 + bbox 좌표)만 담으며, 실제 이미지는 프론트엔드가 자기 브라우저 메모리의 blob에서 찾아 표시합니다. AI-server도 이 참조만 응답으로 돌려줍니다(`internal-api-contract.md`).

**`rejectedMergeGroupIds`는 `mergeCandidates`를 재산출할 때마다 대조합니다.** `POST /api/timeline/merge`가 `approved: false`를 받으면 해당 `groupId`를 여기에 추가하고, 그 뒤로는 같은 이벤트 조합이 다시 후보로 뜨지 않게 합니다. 이벤트 자체는 병합하지 않습니다(F5-02).

**별지 제4호서식 11개 필드(신청인 성명·생년월일·주소·연락처·휴대전화번호·전자우편주소 / 계좌 금융회사·개설점포·예금종별·계좌번호·명의인)는 이 구조체에 없습니다.** `POST /api/package/text` 요청 바디로만 받아 PDF 생성에 즉시 사용하고 세션에 넣지 않습니다(`../00-context/spec.md` §5-2, `../03-infra-ops/privacy-and-safety.md`).

> **필드 수 정정 예정**: 서식 원본 대조 결과 8개가 아니라 11개(휴대전화번호·전자우편주소·명의인 추가)로 확인됐습니다 — `../request/frontend/legal-form-and-package.md` 회신 대기 중. 회신 오면 이 문단과 §5-2를 함께 갱신합니다.

## 이미지 처리 (Storage를 거치지 않음)

| 항목 | 값 |
| --- | --- |
| 경유 서비스 | 브라우저(리사이즈·마스킹 완료) → 백엔드(메모리) → AI-server(메모리) → LLM API |
| 영구 보관 | 없음 |
| 삭제 시점 | 백엔드: AI-server 응답 수신 즉시 / AI-server: LLM 응답 수신 즉시 |

이미지 전달 방식(멀티파트 포워딩 vs base64)은 `internal-api-contract.md`에서 백엔드·AI 담당이 확정합니다.

## 백엔드 구현 체크리스트

- [ ] `session_stat`, `stage_event`, `keepalive` 테이블 마이그레이션 스크립트 작성 (백업이 없으므로 스키마를 코드로 관리)
- [ ] 세션 TTL 만료 시 인메모리 데이터 정리 스케줄러
- [ ] 이미지가 백엔드·AI-server 어느 쪽에도 디스크에 기록되지 않는지 확인 (메모리 처리만)
- [ ] 로그에 이미지 내용·추출 텍스트가 남지 않는지 확인 (NFR-08)
