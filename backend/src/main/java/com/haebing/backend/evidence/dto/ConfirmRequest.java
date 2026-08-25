package com.haebing.backend.evidence.dto;

/** docs/02-architecture/api-contract.md "/api/evidence/confirm 요청". */
public record ConfirmRequest(String cardId, boolean confirmed, Corrections corrections) {
}
