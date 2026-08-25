# [프론트 → 백엔드] 평문 HTTP로 AI-server를 부르면 요청 본문이 통째로 유실됩니다

> **상태: ⏳ 회신 대기** (요청 2026-08-26)
> 회신은 `../../response/frontend/h2c-upgrade-breaks-ai-call.md`에 들어옵니다.
> **막고 있는 작업**: 로컬에서 **백엔드↔AI-server 실연동이 전혀 안 됩니다.** 판독·소명서 생성이 모두 500입니다. 프론트는 임시 프록시로 우회해 두었지만 저장소에 넣을 성질의 것이 아닙니다.

- 작성: 프론트엔드 · 2026-08-26
- 확인 환경: 로컬 4층 (Postgres + 백엔드 `DEMO_MODE=false` + AI-server `uvicorn` + Vite), `AI_SERVER_URL=http://localhost:8000`
- 배경: AI 담당이 OpenAI 실연동을 마쳤길래(`c03a89b`) 데모 모드를 끄고 3층을 전부 띄워봤습니다.

## 1. 증상

`POST /api/evidence/text` → `500 INTERNAL_ERROR`. 백엔드 로그입니다.

```
[UnhandledException]
org.springframework.web.client.HttpClientErrorException$BadRequest:
  400 Bad Request: "{"error":"BAD_REQUEST","message":"본문은 {\"rawText\": \"...\"} 형식이어야 합니다."}"
```

AI-server 로그입니다.

```
WARNING:  Unsupported upgrade request.
INFO      ai.access POST /internal/extract 400 0.00s
```

**`0.00s`** — LLM까지 가지도 못했습니다. 본문이 도착하지 않았습니다.

## 2. 원인 — h2c 업그레이드입니다. 실제 바이트를 떠서 확인했습니다

백엔드가 AI-server로 보내는 요청을 소켓 단에서 그대로 받아봤습니다.

```
POST /internal/extract HTTP/1.1
Connection: Upgrade, HTTP2-Settings
Host: localhost:8001
HTTP2-Settings: AAEAAEAAAAIAAAAAAAMAAAAAAAQBAAAAAAUAAEAAAAYABgAA
Transfer-encoding: chunked
Upgrade: h2c
User-Agent: Java-http-client/21.0.12.1
Content-Type: application/json
X-Internal-Token: ...
```

**JDK HttpClient가 평문 HTTP에서 HTTP/2 업그레이드(h2c)를 시도합니다.** uvicorn은 h2c를 지원하지 않아 `Unsupported upgrade request`를 남기고, 그 과정에서 **본문이 애플리케이션까지 오지 않습니다.** FastAPI는 빈 본문을 받아 `400`을 냅니다.

`curl`로 재현·격리했습니다.

| 호출 | 결과 |
| --- | --- |
| `curl --http1.1` | **200** — 정상 판독 |
| `curl --http2` (h2c 시도) | **400** — 같은 `본문은 {"rawText": ...}` 오류 |

**AI-server 쪽 문제가 아닙니다.** 같은 서버가 HTTP/1.1 요청에는 정상 응답합니다.

## 3. 왜 이제야 드러났나

`DEMO_MODE=true`에서는 `AiClientImpl`이 **RestClient를 아예 타지 않습니다** — 첫 줄에서 픽스처를 반환합니다. 데모 모드로만 확인하면 이 경로가 한 번도 실행되지 않습니다. 저희도 어제 데모 모드 리허설은 전 구간 통과했었습니다.

**배포에서는 안 날 수도 있습니다.** Cloud Run은 HTTPS라 ALPN으로 협상하므로 업그레이드 헤더 자체가 나가지 않습니다. 다만 **평문 HTTP로 붙는 모든 경우**(로컬 통합, 사설망 배포, 데모 백업 구성)에서 재현됩니다.

## 4. 고칠 곳

`AiServerConfig.buildClient`가 `ClientHttpRequestFactoryBuilder.detect()`를 쓰고, 클래스패스에 JDK HttpClient가 있어 그게 선택됩니다. **`spring.http.client.factory` 같은 설정 프로퍼티로는 바뀌지 않습니다** — `detect()`가 그 프로퍼티를 보지 않습니다. 실제로 넣어봤지만 요청은 그대로 `Java-http-client/21`이었습니다.

| 안 | 내용 |
| --- | --- |
| **A (권장)** | JDK 클라이언트를 **HTTP/1.1로 고정**. `java.net.http.HttpClient.newBuilder().version(HTTP_1_1)`로 만든 클라이언트를 `JdkClientHttpRequestFactory`에 넘깁니다. 한 곳만 바뀌고 TLS 환경에도 영향이 없습니다 |
| B | `ClientHttpRequestFactoryBuilder.simple()`로 고정 (HttpURLConnection, HTTP/1.1 전용) |

**A를 권합니다.** 내부 호출은 한 홉이고 페이로드도 작아 HTTP/2로 얻을 것이 없는 반면, 지금은 **평문 환경에서 전부 실패**합니다.

## 5. 프론트가 지금 하고 있는 우회 (참고 — 저장소에 없습니다)

로컬 스크래치패드에 **업그레이드 헤더만 떼고 그대로 넘기는 프록시**를 띄워 `AI_SERVER_URL`을 그쪽으로 돌려놨습니다. 이걸로 3층이 정상 동작합니다 — 텍스트 판독이 실제 OpenAI 응답을 돌려주는 것까지 확인했습니다.

**저장소에 넣지 않았습니다.** 이건 진단을 위한 임시 장치이고, 팀원마다 프록시를 띄우게 만들 성질의 것이 아닙니다. §4가 고쳐지면 지웁니다.

## 백엔드가 할 것

| # | 항목 | 시점 |
| --- | --- | --- |
| 1 | §4 — RestClient를 HTTP/1.1로 고정 | **가급적 빨리.** 지금은 평문 환경에서 실연동이 불가능합니다 |
| 2 | 고친 뒤 **`DEMO_MODE=false`로 로컬 한 바퀴** 확인 | 위와 같이 — 데모 모드로는 이 경로가 실행되지 않습니다 |
