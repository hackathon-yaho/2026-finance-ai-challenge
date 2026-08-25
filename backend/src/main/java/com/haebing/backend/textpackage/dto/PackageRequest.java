package com.haebing.backend.textpackage.dto;

import java.util.List;

/** docs/02-architecture/api-contract.md "/api/package/text 요청 바디". 11필드 + excludedSentenceIds, 서비스 미저장. */
public record PackageRequest(Applicant applicant, Account account, List<String> excludedSentenceIds) {
}
