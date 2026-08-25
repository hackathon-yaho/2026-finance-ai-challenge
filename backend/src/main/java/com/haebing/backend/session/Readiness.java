package com.haebing.backend.session;

/**
 * Phase 4가 계산한 사유·준비도의 캐시 — Phase 5(`/api/draft`)가 재계산 없이 그대로 쓴다
 * ("AI-server는 이 값을 재해석하지 않는다"와 같은 이유로, 백엔드도 Stage 3에서 본 값과
 * Stage 4에서 쓰는 값을 다르게 만들지 않는다). 전체 응답(`ReadinessResponse`)은 여기 두지
 * 않는다 — session 패키지가 readiness 패키지를 참조하는 순환 의존을 피하기 위해서다.
 */
public record Readiness(String reason, String readiness) {
}
