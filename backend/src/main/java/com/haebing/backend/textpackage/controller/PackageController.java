package com.haebing.backend.textpackage.controller;

import com.haebing.backend.session.Session;
import com.haebing.backend.session.interceptor.SessionInterceptor;
import com.haebing.backend.textpackage.dto.PackageRequest;
import com.haebing.backend.textpackage.service.PackageService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/** docs/backend/phase-5-draft-package.md 5-4. 제출용 완성본이 아니라 작성 지원본이다(FR-047) — 빈 값도 400이 아니다. */
@RestController
@RequestMapping("/api/package")
@RequiredArgsConstructor
public class PackageController {

    private final PackageService packageService;

    @PostMapping("/text")
    public ResponseEntity<byte[]> generate(@RequestBody(required = false) PackageRequest req, HttpServletRequest request) {
        PackageRequest body = req != null ? req : new PackageRequest(null, null, null);
        Session session = (Session) request.getAttribute(SessionInterceptor.CURRENT_SESSION_ATTR);
        byte[] pdf = packageService.generate(session, body);

        String filename = "이의제기패키지_" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".pdf";
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(pdf);
    }
}
