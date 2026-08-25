"""`.env` 키 등록 경로 회귀 테스트.

여기가 깨지면 키를 등록해도 서버가 못 읽거나, 최악의 경우 키가 저장소에 올라간다.
"""

import os
import subprocess
import sys

from scripts import set_key


def test_mask_never_reveals_full_key():
    secret = "sk-ant-abcdefghijklmnopqrstuvwxyz0123456789"
    masked = set_key.mask(secret)
    assert secret not in masked
    assert masked.startswith("sk-ant-")
    assert masked.endswith(secret[-4:])


def test_mask_short_value_is_fully_hidden():
    assert set_key.mask("short") == "*****"


def test_write_env_preserves_other_keys(tmp_path, monkeypatch):
    env_path = tmp_path / ".env"
    monkeypatch.setattr(set_key, "ENV_PATH", env_path)

    set_key.write_env({"ANTHROPIC_API_KEY": "sk-ant-aaa", "INTERNAL_TOKEN": "tok"})
    assert set_key.read_env() == {"ANTHROPIC_API_KEY": "sk-ant-aaa", "INTERNAL_TOKEN": "tok"}

    # 한 값만 바꿔도 나머지가 남아 있어야 한다
    values = set_key.read_env()
    values["INTERNAL_TOKEN"] = "new-token"
    set_key.write_env(values)
    assert set_key.read_env() == {"ANTHROPIC_API_KEY": "sk-ant-aaa", "INTERNAL_TOKEN": "new-token"}


def test_read_env_ignores_comments_and_blanks(tmp_path, monkeypatch):
    env_path = tmp_path / ".env"
    env_path.write_text("# 주석\n\nA=1\n  B = 2  \n망가진줄\n", encoding="utf-8")
    monkeypatch.setattr(set_key, "ENV_PATH", env_path)
    assert set_key.read_env() == {"A": "1", "B": "2"}


def test_dotenv_reaches_os_environ(tmp_path):
    """pydantic-settings는 os.environ을 채우지 않는다 — LLM SDK는 거기서 키를 읽는다.

    app/config.py의 load_dotenv()가 그 간극을 메운다. 이게 사라지면
    `.env`에 키를 넣어도 SDK가 보지 못한다.
    """
    (tmp_path / ".env").write_text("ANTHROPIC_API_KEY=sk-ant-from-dotenv-file\n", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-c", "import os, app.config; print(os.environ.get('ANTHROPIC_API_KEY'))"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        env={"PATH": "", "PYTHONPATH": str(set_key.ROOT), "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")},
    )
    assert result.stdout.strip() == "sk-ant-from-dotenv-file", result.stderr


def test_deployment_env_beats_dotenv(tmp_path):
    """Cloud Run이 주입한 시크릿을 로컬 .env가 덮어쓰면 안 된다 (override=False)."""
    (tmp_path / ".env").write_text("ANTHROPIC_API_KEY=sk-ant-local\n", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-c", "import os, app.config; print(os.environ.get('ANTHROPIC_API_KEY'))"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        env={
            "PATH": "",
            "PYTHONPATH": str(set_key.ROOT),
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
            "ANTHROPIC_API_KEY": "sk-ant-from-secret-manager",
        },
    )
    assert result.stdout.strip() == "sk-ant-from-secret-manager", result.stderr
