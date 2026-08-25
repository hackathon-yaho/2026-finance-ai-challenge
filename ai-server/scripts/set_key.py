"""API 키를 CLI로 입력받아 `.env`에 저장한다.

    python scripts/set_key.py

한 번 등록하면 다시 입력할 필요가 없다. 값은 저장소에 절대 들어가지 않는다 —
`.env`는 `.gitignore`에 있고, 이 스크립트는 그 사실을 매번 확인한 뒤에만 쓴다.

설계 원칙:
- **입력은 화면에 찍히지 않는다** (getpass). 터미널 기록·어깨너머 노출 방지
- **키를 인자로 받지 않는다.** `--key sk-...`를 허용하면 셸 히스토리에 남는다
- **기존 값은 보존한다.** 파일을 통째로 덮어쓰지 않고 해당 줄만 교체
- 출력에는 항상 마스킹된 값만 보여준다
"""

from __future__ import annotations

import getpass
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"

# 저장소의 LLM 호출부는 OpenAI 전용이다 (app/llm/client.py, 2026-08-26 확정).
# 읽는 코드가 없는 공급자를 고를 수 있게 두면 저장은 되는데 첫 호출이
# 설정 오류로 실패한다 — 고를 수 있으면 고른 사람이 생긴다.
PROVIDERS = {
    "1": ("openai", "OPENAI_API_KEY", "sk-"),
}

UNSUPPORTED = {
    "2": (
        "Anthropic",
        "지원하지 않습니다. LLM 호출부(app/llm/client.py)가 OpenAI 전용이라 "
        "Anthropic 키를 저장해도 읽는 코드가 없습니다.",
    ),
}


def fail(message: str) -> None:
    print(f"\n[중단] {message}")
    sys.exit(1)


def ensure_gitignored() -> None:
    """.env가 git에 추적되지 않는지 확인한다. 아니면 아무것도 쓰지 않는다."""
    try:
        tracked = subprocess.run(
            ["git", "check-ignore", "-q", str(ENV_PATH)],
            cwd=ROOT,
            capture_output=True,
        )
    except FileNotFoundError:
        print("  git이 없어 무시 여부를 확인하지 못했습니다. .gitignore에 .env가 있는지 직접 확인하세요.")
        return
    if tracked.returncode != 0:
        fail(
            ".env가 .gitignore에 없습니다. 이대로 쓰면 키가 저장소에 올라갈 수 있습니다.\n"
            "        .gitignore에 '.env'를 추가한 뒤 다시 실행하세요."
        )


def mask(value: str) -> str:
    if len(value) <= 10:
        return "*" * len(value)
    return f"{value[:7]}{'*' * 12}{value[-4:]}"


def read_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    values: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def write_env(values: dict[str, str]) -> None:
    body = "\n".join(f"{k}={v}" for k, v in values.items())
    ENV_PATH.write_text(
        "# 이 파일은 저장소에 올라가지 않습니다 (.gitignore).\n"
        "# 수정은 `python scripts/set_key.py`로 하세요.\n" + body + "\n",
        encoding="utf-8",
    )
    try:
        os.chmod(ENV_PATH, 0o600)  # Windows에서는 부분적으로만 적용된다
    except OSError:
        pass


def prompt_secret(label: str, current: str | None, expect_prefix: str = "") -> str | None:
    if current:
        print(f"  현재 등록됨: {mask(current)}")
        if input("  바꿀까요? (y/N): ").strip().lower() != "y":
            return None
    while True:
        value = getpass.getpass(f"  {label} (화면에 표시되지 않습니다, 빈 입력=취소): ").strip()
        if not value:
            return None
        if expect_prefix and not value.startswith(expect_prefix):
            print(f"  '{expect_prefix}'로 시작하지 않습니다. 다시 확인해 주세요.")
            continue
        if len(value) < 20:
            print("  키가 너무 짧습니다. 잘라서 붙여넣지 않았는지 확인해 주세요.")
            continue
        return value


def show() -> int:
    """등록된 항목만 마스킹해 보여준다 (입력받지 않는다)."""
    values = read_env()
    if not values:
        print("등록된 값이 없습니다. set-key.ps1 을 실행해 등록하세요.")
        return 0
    print("현재 .env에 등록된 항목:")
    for key, value in values.items():
        print(f"  {key:20s} {mask(value)}")
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if "--show" in sys.argv:
        return show()

    print("AI-server 키 등록\n" + "=" * 46)
    print(f"저장 위치: {ENV_PATH}")
    ensure_gitignored()
    print("  .env는 git이 무시합니다 — 저장소에 올라가지 않습니다.\n")

    values = read_env()

    print("[1/2] LLM API 키")
    print("  어느 공급자인가요?   1) OpenAI   2) Anthropic (미지원)   (엔터=건너뛰기)")
    choice = input("  선택: ").strip()
    if choice in UNSUPPORTED:
        name, reason = UNSUPPORTED[choice]
        print("")
        print(f"  [{name}] {reason}")
        print("  건너뜁니다.")
    elif choice in PROVIDERS:
        _name, var, prefix = PROVIDERS[choice]
        secret = prompt_secret(f"{var} 입력", values.get(var), prefix)
        if secret:
            values[var] = secret
            print(f"  저장했습니다: {var}={mask(secret)}")
    else:
        print("  건너뜁니다.")

    print("\n[2/2] INTERNAL_TOKEN (백엔드와 공유하는 값)")
    token = prompt_secret("INTERNAL_TOKEN 입력", values.get("INTERNAL_TOKEN"))
    if token:
        values["INTERNAL_TOKEN"] = token
        print(f"  저장했습니다: INTERNAL_TOKEN={mask(token)}")

    if not values:
        print("\n등록된 값이 없습니다.")
        return 0

    write_env(values)
    print("\n" + "=" * 46)
    print("현재 .env에 등록된 항목:")
    for key, value in values.items():
        print(f"  {key:20s} {mask(value)}")
    print("\n서버를 실행하면 자동으로 읽습니다. 다시 입력할 필요 없습니다.")
    print("배포 환경(Cloud Run)에서는 이 파일 대신 Secret Manager 값이 쓰입니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
