package com.haebing.backend.draft.dto;

/** docs/02-architecture/api-contract.md "/api/draft/revise". text와 excluded는 분리된 개념 — 둘 다 nullable/optional. */
public record ReviseSentenceInput(String sentenceId, String text, Boolean excluded) {
}
