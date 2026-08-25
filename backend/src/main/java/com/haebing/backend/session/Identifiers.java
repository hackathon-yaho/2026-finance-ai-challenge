package com.haebing.backend.session;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Identifiers(
        @JsonProperty("tracking_no") String trackingNo,
        @JsonProperty("account_last4") String accountLast4
) {
}
