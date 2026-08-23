# Backend — 해빙 (解氷)

지급정지 계좌 소명 지원 서비스의 백엔드. 세션 관리, 타임라인 조립, **제출 준비도 점검(결정적 규칙 엔진)**, AI-server 호출 오케스트레이션을 담당합니다.

- 스택: Java 21 · Spring Boot 3.x · Gradle · PostgreSQL(Supabase) · Render
- **작업 계획과 결정 로그는 [`docs/`](docs/) 에 있습니다. 작업 시작 전 [`docs/README.md`](docs/README.md) 를 먼저 여세요.**

## 절대 원칙

> **제출 준비도 점검에 LLM을 쓰지 않습니다.** `ReadinessService`는 결정적 규칙 엔진이며, 이 서비스는 은행의 승인·기각을 예측하지 않습니다. 산출하는 것은 "제출 서류가 갖춰졌는가"입니다.

> **이미지를 저장하지 않습니다.** 메모리로 받아 AI-server로 전달하고 응답 수신 즉시 폐기합니다. 디스크·DB·Storage 어디에도 쓰지 않습니다.

## 참고 문서

| 문서 | 내용 |
| --- | --- |
| [`docs/`](docs/) | 백엔드 실행 계획 (Phase 1~6), 결정 로그, 패키지 구조 규칙 |
| [`../docs/01-product/reason-type-rules.md`](../docs/01-product/reason-type-rules.md) | 사유유형·준비도 산출 로직 (단일 출처) |
| [`../docs/02-architecture/api-contract.md`](../docs/02-architecture/api-contract.md) | 프론트↔백엔드 공개 API 계약 |
| [`../docs/02-architecture/internal-api-contract.md`](../docs/02-architecture/internal-api-contract.md) | 백엔드↔AI-server 내부 API 계약 |
| [`../docs/02-architecture/data-model.md`](../docs/02-architecture/data-model.md) | Supabase 스키마, 인메모리 세션 구조 |
