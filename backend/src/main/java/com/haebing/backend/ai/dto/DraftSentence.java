package com.haebing.backend.ai.dto;

import java.util.List;

public record DraftSentence(String sentenceId, String text, List<EvidenceRef> evidenceRefs) {
}
