package com.haebing.backend.session.interceptor;

import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.SessionStore;
import com.haebing.backend.stats.service.StatsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;

/**
 * docs/backend/phase-2-session-intake.md 2-3.
 * X-Session-Hash로 세션을 조회해 유효하면 요청 속성 CURRENT_SESSION_ATTR에 담아 컨트롤러에 넘긴다.
 * 세션 생성(POST /api/session)만 예외로 통과시킨다 — 아직 세션이 없는 게 정상이기 때문이다.
 *
 * docs/backend/phase-6-infra-ops.md 6-2·6-3도 여기서 함께 처리한다 — 모든 /api/** 요청이 지나가는
 * 유일한 지점이라 컨트롤러마다 따로 걸 필요가 없다.
 * - 6-2: 5개 엔드포인트가 처음 성공할 때 stage_event(complete)를 적재한다
 * - 6-3: 세션 해시·엔드포인트를 MDC에 심어 오류 로그(GlobalExceptionHandler)에 자동으로 실린다
 */
@Component
@RequiredArgsConstructor
public class SessionInterceptor implements HandlerInterceptor {

    public static final String CURRENT_SESSION_ATTR = "currentSession";
    private static final String MDC_SESSION_HASH = "sessionHash";
    private static final String MDC_ENDPOINT = "endpoint";

    /** 완료 시점에 어느 단계에 도달했다고 볼지 — 계약에 별도 enter/complete API가 없어 호출 시점으로 근사한다. */
    private static final Map<String, Integer> STAGE_COMPLETE_ENDPOINTS = Map.of(
            "/api/intake", 1,
            "/api/evidence", 2,
            "/api/readiness", 3,
            "/api/draft", 4,
            "/api/package/text", 5
    );

    private final SessionStore sessionStore;
    private final StatsService statsService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        MDC.put(MDC_ENDPOINT, request.getMethod() + " " + request.getRequestURI());

        if ("POST".equalsIgnoreCase(request.getMethod()) && "/api/session".equals(request.getRequestURI())) {
            return true;
        }

        String sessionHash = request.getHeader("X-Session-Hash");
        Session session = (sessionHash == null ? java.util.Optional.<Session>empty() : sessionStore.find(sessionHash))
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_EXPIRED));

        request.setAttribute(CURRENT_SESSION_ATTR, session);
        MDC.put(MDC_SESSION_HASH, session.getHash());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        try {
            if ("POST".equalsIgnoreCase(request.getMethod()) && response.getStatus() < 300) {
                Integer stage = STAGE_COMPLETE_ENDPOINTS.get(request.getRequestURI());
                Session session = (Session) request.getAttribute(CURRENT_SESSION_ATTR);
                if (stage != null && session != null) {
                    statsService.recordStageComplete(session, stage);
                }
            }
        } finally {
            MDC.remove(MDC_SESSION_HASH);
            MDC.remove(MDC_ENDPOINT);
        }
    }
}
