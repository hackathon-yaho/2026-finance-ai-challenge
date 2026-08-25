package com.haebing.backend.draft.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.haebing.backend.ai.dto.DraftSentence;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReviseResponse(List<DraftSentence> sentences, String warning) {
}
