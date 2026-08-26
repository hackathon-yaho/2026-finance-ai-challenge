package com.haebing.backend.session;

/**
 * docs/02-architecture/internal-api-contract.md "recurrence — 반복 거래를 카드 한 장으로".
 * 반복이 아닌 카드는 이 필드 자체가 null이다. count·first·last는 AI-server가 계산해 보내는 값을
 * 그대로 신뢰한다 — 백엔드는 해석하지 않고 통과시키거나 표시 문구에 붙이기만 한다.
 */
public record Recurrence(Integer count, String period, String first, String last) {
}
