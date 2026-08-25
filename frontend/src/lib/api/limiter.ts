/**
 * 동시 실행 상한 (api-contract.md "동시 요청 상한 — 4").
 *
 * `/api/evidence`는 이미지를 **1장씩 병렬로** 호출하는데, 프론트가 10장을 한꺼번에 던지면
 * 백엔드에서 큐만 쌓이고 처리량은 늘지 않는다 — 백엔드→AI-server 구간이 이미 최대 4 동시다.
 * 게다가 Render 인스턴스가 **512MB RAM / 0.1 CPU**이고 이미지는 저장되지 않고 메모리로만
 * 통과하므로, **동시 개수가 곧 메모리 점유**다.
 *
 * 4는 백엔드의 거부선이 아니라 **프론트가 지켜야 할 발신 상한**이다.
 */
export function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []

  const next = () => {
    if (active >= limit) return
    const run = queue.shift()
    if (!run) return
    active += 1
    run()
  }

  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1
            next()
          })
      })
      next()
    })
  }
}

/** 10장이면 4 → 4 → 2로 끊어 보낸다. */
export const evidenceLimiter = createLimiter(4)
