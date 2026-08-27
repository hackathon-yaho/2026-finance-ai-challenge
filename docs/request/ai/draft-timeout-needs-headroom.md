# [백엔드 → AI] 소명서 생성(`/internal/draft`)이 이벤트 많은 케이스에서 100% 타임아웃됩니다 — `llm_timeout_draft` 여유가 필요합니다

> **상태: ✅ **완결** (2026-08-27 AI 회신 / 2026-08-28 백엔드 반영 완료)**
> - 회신: `../../response/backend/draft-timeout-needs-headroom.md`
> - **결론 요약**: 원인은 예산이 아니라 `draft_effort: medium`이었습니다(12건 17.9초). **`low`로 내리고**(12건 10.4초, 품질 동등) 실측 기준으로 `llm_timeout_draft` 10 → **25초**, `handler_budget_draft` 13 → **27초**로 올렸습니다.
> - **백엔드 반영 완료**: `draftRestClient` 타임아웃 15 → **30초**, `internal-api-contract.md` 갱신. 재시도 정책은 현행 유지(최악 50초 감수), 데모 픽스처 표식은 로그에만 — 회신: `../../response/ai/draft-timeout-needs-headroom.md`
> - **남은 것**: 없음
>
> 아래 본문은 **요청 당시 원문**입니다.

- 작성: 백엔드 · 2026-08-27
- 관련: `../backend/repeated-events-and-irrelevant-cards.md` §3(같은 성격의 `/internal/extract` 타임아웃 — 이미 A안으로 해소됨), `ai-server/app/config.py`, `ai-server/app/llm/client.py`

## 무엇을 재현했나

확인된 이벤트가 12건인 실제 시나리오로 "초안 만들기"(`/api/draft` → `/internal/draft`)를 **세 번 시도**했고, **세 번 다 타임아웃**했습니다. 매번 같은 패턴입니다.

```
19:09:17 WARNING ai.llm draft timeout after 10.0s   ← 1차
19:09:27 WARNING ai.llm draft timeout after 10.0s   ← 재시도도 실패
...
19:36:26 WARNING ai.llm draft timeout after 10.2s   ← 1차
19:36:36 WARNING ai.llm draft timeout after 10.0s   ← 재시도도 실패
```

반면 같은 세션에서 **이벤트가 적을 때**(`in=932`, 짧은 초안)는 안정적으로 통과합니다.

```
19:03:21 INFO ai.llm draft done in 3.80s in=932 out=120 ...
19:03:21 INFO ai.llm draft done in 4.32s in=932 out=171 ...
19:03:23 INFO ai.llm draft done in 3.31s in=932 out=173 ...
```

즉 우연한 지연이 아니라, **이벤트 수(=입력 사실관계 개수)가 늘어나면 `gpt-5.5`(medium reasoning)가 10초 안에 문장을 다 못 쓰는 것으로 100% 재현되는 구조적 한계**입니다.

## 코드에서 확인한 예산

```python
# ai-server/app/config.py
llm_timeout_extract: float = 15.0
llm_timeout_draft: float = 10.0      # ← 소명서 쪽이 오히려 더 짧습니다
handler_budget_draft: float = 13.0
```

주석에 "소명서: 텍스트만이라 빠르고, 문장 품질이 핵심"이라고 되어 있는데, 실측으로는 **이벤트 수가 늘면 추출(extract)보다 소명서(draft) 쪽이 먼저 한도에 걸립니다.** 이미지가 없어 입력은 가볍지만, `medium` reasoning + 확인된 사실 하나하나에 근거를 붙여 문장을 쓰는 출력 쪽 부담이 이벤트 수에 비례해 커지는 것으로 보입니다.

백엔드 쪽 예산은 여유가 있습니다 — `AiServerConfig.draftRestClient`가 15초(계약 `internal-api-contract.md`값)를 잡아뒀고, 재시도까지 최대 2회를 기다릴 수 있습니다. 그런데 AI-server가 **자기 안에서 10초 만에 먼저 포기**하고 504를 주기 때문에, 백엔드가 가진 여유 시간을 못 씁니다.

## 결과로 나타나는 증상 (참고)

`/internal/draft`가 실패하면 백엔드 세션에 문장이 저장되지 않고(`DraftServiceImpl.storeResult()` 미호출), 이후 PDF 생성 시 1면 요약 박스·2면 "사실관계 진술서"가 빈 문구("확인된 사실관계가 없습니다")로 나갑니다 — 이건 백엔드가 세션이 비었을 때 의도한 정상 동작이라, **원인은 여기(타임아웃)이지 백엔드 PDF 생성 로직이 아닙니다.**

(프론트 쪽에도 "타임아웃 실패를 화면에서 성공처럼 보여준다"는 별개 이슈가 있었는데, 이번에 원인을 좁혀보니 애초에 이벤트 많은 케이스는 재시도해도 항상 실패하는 구조적 문제라 프론트에는 요청을 넣지 않기로 했습니다. 여기서 예산을 늘리면 그쪽 증상도 같이 없어질 걸로 봅니다.)

## 요청

1. **`llm_timeout_draft`(현재 10.0)를 이벤트 많은 실사용 케이스 기준으로 넉넉히 올려주세요.** 실측(12건 · 두 번 다 10~10.2초에 걸림)을 보면 최소 15~20초는 필요해 보이는데, 정확한 값은 실제 최대 이벤트 수(F5-04 등 규칙상 상한이 있다면 그 값)로 다시 재보고 정해주시면 좋겠습니다.
2. **`handler_budget_draft`(13.0)도 1번 값에 맞춰 같이 올려주세요** — 지금처럼 `llm_timeout_draft`보다 여유가 3초뿐이면 다른 오버헤드(직렬화·검증 등) 여지가 별로 없습니다.
3. **1번 값이 백엔드 계약값(15초, `internal-api-contract.md` "/internal/draft는 15초")을 넘게 되면 알려주세요.** 그러면 저희가 `AiServerConfig.draftRestClient`의 `Duration.ofSeconds(15)`와 계약 문서를 같이 올리겠습니다. 재시도 1회 정책은 그대로 둘 생각이라, AI-server 쪽 1회 시도 시간 × 2 + 여유가 프론트 체감 대기시간이 됩니다 — 너무 길어지면 재시도 정책 자체를 다시 볼 수도 있으니 예상 값을 같이 알려주시면 좋겠습니다.

## 저희가 확인한 것 (참고)

- `AiClientImpl.callOnce()`가 AI-server의 504를 재시도 대상으로 정확히 분류하고 있고, 재시도 로직 자체는 의도대로 동작합니다 — 재시도해도 같은 이유로 또 실패하는 것뿐입니다.
- `handler_budget_extract`(18.0) vs `llm_timeout_extract`(15.0)는 3초 여유를 두고 있는데, `draft` 쪽만 여유가 3초로 같으면서 절대값이 작아 체감 여유가 더 없습니다.
