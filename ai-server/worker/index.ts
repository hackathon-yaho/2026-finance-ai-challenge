/**
 * 해빙 AI-server — Cloudflare Worker 앞단.
 *
 * 이 Worker는 **라우팅만 한다.** 인증(X-Internal-Token) 검증, 계약 스키마 처리,
 * 오류 코드 매핑은 전부 컨테이너 안의 FastAPI가 한다. 같은 검증을 두 곳에 두면
 * 어느 쪽이 진짜 계약인지 알 수 없게 되고, 한쪽만 고치는 사고가 난다.
 *
 * 내부 API 계약: docs/02-architecture/internal-api-contract.md
 */
import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class AiServer extends Container {
  /** Dockerfile의 uvicorn 포트 */
  defaultPort = 8000;

  /**
   * 킵얼라이브 간격(5~10분)보다 훨씬 길게 둔다. 심사 기간(9/7~9/11)에는
   * 백엔드의 GitHub Actions가 주기적으로 /internal/health를 때리므로
   * 실제로는 잠들지 않는다. 잠들더라도 콜드스타트는 1~3초이고
   * 앞단 Worker는 살아 있어 연결 거부가 나지 않는다.
   */
  sleepAfter = "45m";

  /**
   * 컨테이너에 넘길 환경변수. 값은 `wrangler secret put`으로 등록한 시크릿에서
   * 온다 — 저장소에 커밋하지 않는다.
   *
   * ANTHROPIC_API_KEY는 LLM 공급자가 확정되면 그때 이름이 바뀔 수 있다.
   * 키가 없어도 서버는 뜨고 /internal/health는 200을 준다(LLM 경로만 502).
   */
  envVars = {
    // Dockerfile은 ${PORT:-8000}으로 바인딩한다. 플랫폼이 PORT를 주입해
    // defaultPort와 어긋나면 연결이 거부되므로 명시적으로 못 박는다.
    PORT: "8000",
    INTERNAL_TOKEN: env.INTERNAL_TOKEN,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ?? "",
  };
}

/** 무상태 서버이므로 항상 같은 인스턴스로 보낸다. */
const INSTANCE = "haebing-ai-server";

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    // 계약에 없는 경로는 컨테이너를 깨우지 않고 여기서 끝낸다.
    if (!pathname.startsWith("/internal/")) {
      return Response.json(
        { error: "NOT_FOUND", message: "이 서버는 내부 API 전용입니다." },
        { status: 404 },
      );
    }

    // /internal/health도 컨테이너까지 보낸다.
    // 엣지에서 끊으면 "Worker는 살아 있고 컨테이너는 죽은" 상태를 정상으로
    // 보고하게 되어 킵얼라이브·모니터링의 목적이 사라진다.
    return env.AI_SERVER.getByName(INSTANCE).fetch(request);
  },
};
