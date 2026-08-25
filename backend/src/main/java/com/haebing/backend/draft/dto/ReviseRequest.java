package com.haebing.backend.draft.dto;

import java.util.List;

public record ReviseRequest(List<ReviseSentenceInput> sentences) {
}
