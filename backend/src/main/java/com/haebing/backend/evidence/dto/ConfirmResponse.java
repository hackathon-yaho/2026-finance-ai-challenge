package com.haebing.backend.evidence.dto;

public record ConfirmResponse(boolean ok, int confirmedCount, int unconfirmedCount) {
}
