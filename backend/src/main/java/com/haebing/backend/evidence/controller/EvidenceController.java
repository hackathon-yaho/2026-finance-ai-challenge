package com.haebing.backend.evidence.controller;

import com.haebing.backend.ai.dto.ExtractResult;
import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.evidence.dto.ConfirmRequest;
import com.haebing.backend.evidence.dto.ConfirmResponse;
import com.haebing.backend.evidence.dto.TextEvidenceRequest;
import com.haebing.backend.evidence.service.EvidenceService;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/** docs/backend/phase-3-evidence-timeline.md 3-2·3-3·3-4. */
@RestController
@RequestMapping("/api/evidence")
@RequiredArgsConstructor
public class EvidenceController {

    private static final int MAX_TEXT_LENGTH = 2000;

    private final EvidenceService evidenceService;

    @PostMapping
    public ResponseEntity<ExtractResult> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("imageIndex") List<Integer> imageIndex,
            HttpServletRequest request) {
        Session session = currentSession(request);
        return ResponseEntity.ok(evidenceService.uploadImages(session, files, imageIndex));
    }

    @PostMapping("/confirm")
    public ResponseEntity<ConfirmResponse> confirm(@RequestBody ConfirmRequest req, HttpServletRequest request) {
        Session session = currentSession(request);
        return ResponseEntity.ok(evidenceService.confirm(session, req));
    }

    @PostMapping("/text")
    public ResponseEntity<ExtractResult> text(@RequestBody TextEvidenceRequest req, HttpServletRequest request) {
        if (req.rawText() == null || req.rawText().isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "rawText가 필요합니다");
        }
        if (req.rawText().length() > MAX_TEXT_LENGTH) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "rawText는 " + MAX_TEXT_LENGTH + "자를 넘을 수 없습니다");
        }
        Session session = currentSession(request);
        return ResponseEntity.ok(evidenceService.uploadText(session, req.rawText()));
    }

    private Session currentSession(HttpServletRequest request) {
        return (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
    }
}
