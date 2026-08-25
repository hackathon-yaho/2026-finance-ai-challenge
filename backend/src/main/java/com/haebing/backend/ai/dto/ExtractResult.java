package com.haebing.backend.ai.dto;

import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.QualityFlags;
import com.haebing.backend.session.Signals;

import java.util.List;
import java.util.Map;

/** docs/02-architecture/internal-api-contract.md "POST /internal/extract" 응답. */
public record ExtractResult(List<ExtractedEvent> cards, Signals signals, Map<String, QualityFlags> qualityFlags) {
}
