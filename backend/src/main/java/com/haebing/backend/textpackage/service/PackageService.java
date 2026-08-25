package com.haebing.backend.textpackage.service;

import com.haebing.backend.session.Session;
import com.haebing.backend.textpackage.dto.PackageRequest;

public interface PackageService {

    /** docs/backend/phase-5-draft-package.md 5-4. 표지 + 1~4면 PDF를 만든다. */
    byte[] generate(Session session, PackageRequest request);
}
