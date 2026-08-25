package com.haebing.backend.session.interceptor;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.SessionStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * docs/backend/phase-2-session-intake.md 2-3.
 * X-Session-Hash로 세션을 조회해 유효하면 요청 속성 CURRENT_SESSION_ATTR에 담아 컨트롤러에 넘긴다.
 * 세션 생성(POST /api/session)만 예외로 통과시킨다 — 아직 세션이 없는 게 정상이기 때문이다.
 */
@Component
@RequiredArgsConstructor
public class SessionInterceptor implements HandlerInterceptor {

    public static final String CURRENT_SESSION_ATTR = "currentSession";

    private final SessionStore sessionStore;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/session".equals(request.getRequestURI())) {
            return true;
        }

        String sessionHash = request.getHeader("X-Session-Hash");
        Session session = (sessionHash == null ? java.util.Optional.<Session>empty() : sessionStore.find(sessionHash))
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));

        request.setAttribute(CURRENT_SESSION_ATTR, session);
        return true;
    }
}
