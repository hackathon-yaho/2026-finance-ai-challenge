package com.haebing.backend.session.dto;

import java.time.Instant;

/** docs/02-architecture/api-contract.md POST /api/session 응답. */
public record SessionResponse(String sessionHash, Instant expiresAt, boolean demoMode) {
}
