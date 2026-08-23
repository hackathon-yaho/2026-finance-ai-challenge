# 시스템 아키텍처

> **수정 기록 (2026-08-23, 백엔드)**
> - 기술 스택 Java 17 → **Java 21**
> - `TimelineService`를 AI-server 박스에서 **백엔드 박스로 이동** (다이어그램 + 컴포넌트 책임표). 근거: `../00-context/spec.md` 총괄표가 F5-01~03의 담당을 `A`(백엔드)로 지정했고, `internal-api-contract.md`에 타임라인 관련 내부 엔드포인트가 없으며, 공개 API에는 `GET /api/timeline`이 존재합니다. 정렬·병합·공백 탐지 규칙이 모두 결정적이라 LLM이 필요하지 않습니다

> 출처: `../00-context/prd.md` §6. 기술 스택: Java 21 / Spring Boot 3.x (백엔드) / AI-server(언어·프레임워크는 AI 담당자 재량) / 정적 호스팅(프론트) / Supabase(PostgreSQL) / 멀티모달 LLM API.
>
> **개정 (2026-08-23 이후)**: 프론트엔드·백엔드·AI-server가 각각 독립적으로 배포되는 3개의 서비스로 분리되었습니다. 아래는 이 구조를 반영한 최신 다이어그램입니다.

## 전체 구조

```
┌──────────────────────────────┐
│  Frontend (SPA)               │   ← 정적 호스팅 (Vercel/Netlify 등)
│  독립 배포, 프론트 담당        │      스핀다운 없음
└──────────────┬────────────────┘
               │ HTTPS (CORS)
┌──────────────▼────────────────┐
│  Backend — Spring Boot 3.x    │   ← Render Web Service, 백엔드 담당
│  ┌────────────┬─────────────┐ │
│  │ IntakeCtrl │ ReadinessCtrl│ │
│  ├────────────┴─────────────┤ │
│  │ EvidenceCtrl (오케스트레이션) │
│  │ TimelineService (정렬·병합·공백 — 결정적) │
│  │ ReadinessService (규칙 엔진 — 결정적) │
│  │ SessionStore (인메모리+TTL) │ │
│  └───────────────────────────┘ │
└──────┬─────────────────┬───────┘
       │                 │ 내부 API (사설)
┌──────▼────────┐  ┌─────▼──────────────────────┐
│  Supabase       │  │  AI-server                  │  ← 별도 Render Web
│  PostgreSQL     │  │  독립 배포, AI 담당         │     Service, AI 담당
│  (익명 통계만)   │  │  ┌────────────────────────┐ │
└─────────────────┘  │  │ ExtractionService       │ │
                      │  │ (멀티모달 LLM 호출, 품질검사) │
                      │  │ DraftService            │ │
                      │  │ (소명서 생성+사실검증+문장근거연결) │
                      │  └───────────┬────────────┘ │
                      └──────────────┼──────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  LLM API (멀티모달)  │
                          └──────────────────────┘
```

## 컴포넌트 책임

| 컴포넌트 | 소속 서비스 | 담당 | 책임 | 절대 하지 않는 것 |
| --- | --- | --- | --- | --- |
| SPA UI | 프론트엔드 | 프론트 | 5단계 화면, 상태관리, 이미지 리사이즈·마스킹·blob 관리, PDF 병합 | 백엔드/AI-server에 원본 이미지 영구 저장 요청 |
| IntakeCtrl | 백엔드 | 백엔드 | 문진 문항 수신·검증 | — |
| EvidenceCtrl | 백엔드 | 백엔드 | 이미지 업로드 수신, AI-server 호출 오케스트레이션 | 이미지를 로컬 디스크에 저장 |
| ReadinessCtrl / **ReadinessService** | 백엔드 | 백엔드 | `../01-product/reason-type-rules.md`의 로직을 결정적으로 실행 | 임의 스코어링, LLM 호출, 승인·기각 예측 |
| SessionStore | 백엔드 | 백엔드 | 세션 데이터 인메모리 보관, TTL(30분) 관리 | 디스크나 DB에 개인정보 영속 저장 |
| ExtractionService | AI-server | AI | 멀티모달 LLM 호출, 이미지→구조화 카드 변환, 증빙 품질 검사 | 지급정지 해제 가능 여부 판단 |
| TimelineService | **백엔드** | **백엔드** | 이벤트 정렬, 중복 병합 후보 산출, 증거 공백 탐지 (전부 결정적 규칙) | LLM 호출, 없는 날짜 생성 |
| DraftService | AI-server | AI | 타임라인+판정 결과 → 소명서 문장 생성, 사실 검증, 문장-근거 연결 | 타임라인에 없는 사실 생성, 준비도 재해석 |

## 서비스 간 통신

| 구간 | 계약 문서 | 비고 |
| --- | --- | --- |
| 프론트 ↔ 백엔드 | `api-contract.md` | 공개 API, CORS 필요 |
| 백엔드 ↔ AI-server | `internal-api-contract.md` | 내부 API, 프론트가 직접 호출하지 않음 |
| 백엔드 ↔ Supabase | `data-model.md` | 익명 통계 전용, AI-server는 Supabase에 접근하지 않음 |

## 설계 원칙

1. **제출 준비도 점검은 LLM이 하지 않는다.** ReadinessService는 백엔드 안의 규칙 엔진이며, AI-server와 물리적으로 분리되어 있다. 이 경계가 심사 방어 논리의 핵심이며, 서비스가 분리되면서 코드 레벨뿐 아니라 배포 레벨에서도 명확해졌다.
2. **세션은 백엔드 인메모리.** Render 티어는 파일시스템이 휘발성이므로 디스크 의존 코드를 만들지 않는다.
3. **이미지는 어느 서비스에도 영구 저장하지 않는다.** 브라우저가 리사이즈·마스킹까지 마친 blob을 백엔드에 전달하면 → 백엔드는 디스크에 쓰지 않고 그대로 AI-server로 전달 → AI-server는 LLM API 호출 후 즉시 폐기한다. 자세한 흐름은 `../03-infra-ops/privacy-and-safety.md` 참조.
4. **각 서비스는 그 서비스를 만든 담당자가 배포·운영한다.** 프론트=프론트, 백엔드=백엔드, AI-server=AI. 자세한 배포 리스크와 체크리스트는 `../03-infra-ops/deployment-and-uptime.md` 참조.

## 역할별로 이 문서를 어떻게 쓰는가

- **프론트엔드**: 브라우저는 백엔드와만 직접 통신한다. LLM API, Supabase, AI-server에 직접 접근하지 않는다. 모든 요청은 `api-contract.md`에 정의된 REST 엔드포인트를 통한다.
- **백엔드**: `ReadinessService`를 구현할 때 `../01-product/reason-type-rules.md`의 의사코드를 그대로 옮기면 된다. AI-server 호출은 `internal-api-contract.md`를 따른다.
- **AI 개발자**: AI-server 안의 서비스들(ExtractionService, DraftService)은 "준비도"라는 개념을 갖지 않는다 — 준비도는 백엔드의 몫이다. 프롬프트 설계는 `../00-context/prd.md` §10, 서버 API 형식은 `internal-api-contract.md`를 참조한다.
