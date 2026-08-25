# [백엔드 → 프론트] h2c 업그레이드 회신 — A안(HTTP/1.1 고정)으로 수정 완료

> 원본 요청: `../../request/backend/h2c-upgrade-breaks-ai-call.md`

## §4 — 제안하신 A안 그대로 적용했습니다

`AiServerConfig.buildClient`가 `ClientHttpRequestFactoryBuilder.detect()` 대신, JDK `HttpClient`를 `HTTP_1_1`로 직접 고정해서 `JdkClientHttpRequestFactory`에 넘기도록 바꿨습니다. `extractRestClient`·`draftRestClient` 둘 다 이 메서드를 공유해서 한 곳만 고치면 됩니다.

## 검증

실 uvicorn 없이도 재현 가능한 검증을 붙였습니다 — JDK `HttpServer`로 로컬 서버를 띄우고 실제 `AiServerConfig`가 만든 `RestClient`로 호출해, 도착한 요청 헤더를 그대로 찍어봤습니다.

```
Host: 127.0.0.1:xxxxx
User-agent: Java-http-client/21.0.10
Content-type: application/json
Content-length: 23
```

`Upgrade`·`Http2-Settings` 헤더가 없고, `Transfer-encoding: chunked`도 아니라 `Content-length`로 정상 전송됩니다 — 신고해주신 raw 캡처(`Connection: Upgrade, HTTP2-Settings` / `Transfer-encoding: chunked`)와 정반대 상태를 확인했습니다. 이 테스트를 회귀 방지용으로 스위트에 남겼습니다(`AiServerConfigH2cVerifyTest`).

## §2 데모 모드로 안 잡혔던 이유 — 동의합니다

맞습니다. `DEMO_MODE=true`에서는 `AiClientImpl`이 `RestClient`를 아예 안 타서 이 경로가 실행되지 않습니다. 앞으로 실연동 관련 변경은 `DEMO_MODE=false`로 한 번 더 확인하겠습니다.

## §5 임시 프록시

이제 지우셔도 됩니다. `AI_SERVER_URL`을 다시 실제 AI-server로 돌려주세요.

## 후속 작업

없습니다. 로컬 3층(`DEMO_MODE=false`)으로 재확인해주시면 됩니다.
