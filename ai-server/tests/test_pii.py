from app import pii


def test_scrub_rrn():
    text, hits = pii.scrub_text("주민번호 900101-1234567 확인")
    assert hits == 1
    assert "900101" not in text


def test_scrub_phone():
    text, hits = pii.scrub_text("연락처 010-1234-5678로 문의")
    assert hits == 1
    assert "5678" not in text


def test_scrub_long_digit_run():
    text, hits = pii.scrub_text("계좌 110-123-456789012 입금")
    assert hits == 1
    assert "456789012" not in text


def test_scrub_keeps_normal_amounts():
    text, hits = pii.scrub_text("물품대금 450,000원 입금")
    assert hits == 0
    assert text == "물품대금 450,000원 입금"


def test_scrub_name_nulls_on_digits():
    value, hits = pii.scrub_name("010-1234-5678")
    assert value is None and hits == 1
    value, hits = pii.scrub_name("김민준")
    assert value == "김민준" and hits == 0


def test_clean_account_last4():
    assert pii.clean_account_last4("123456789") == "6789"
    assert pii.clean_account_last4("48-21") == "4821"
    assert pii.clean_account_last4("없음") is None
    assert pii.clean_account_last4(None) is None
