package com.haebing.backend.ai;

import com.haebing.backend.ai.dto.ExtractResult;

/** docs/backend/phase-3-evidence-timeline.md 3-1. AI-server 내부 API 클라이언트. */
public interface AiClient {

    ExtractResult extractFromImage(byte[] imageBytes, int imageIndex, String contentType);

    ExtractResult extractFromText(String rawText);
}
