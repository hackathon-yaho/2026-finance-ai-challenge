package com.haebing.backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** docs/02-architecture/internal-api-contract.md POST /internal/draft "intake 객체". 필드명은 공개 API와 동일하게 유지한다. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DraftIntake(String when, Long amount, String kind, String usage) {
}
