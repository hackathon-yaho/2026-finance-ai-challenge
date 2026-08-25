package com.haebing.backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.haebing.backend.session.SourceRegion;

/** docs/02-architecture/api-contract.md "evidenceRefs.type 3종". intake/user_text는 imageIndex·bbox가 없는 게 정상이다. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EvidenceRef(String type, Integer imageIndex, SourceRegion bbox) {
    public static final String TYPE_EVIDENCE = "evidence";
    public static final String TYPE_INTAKE = "intake";
    public static final String TYPE_USER_TEXT = "user_text";
}
