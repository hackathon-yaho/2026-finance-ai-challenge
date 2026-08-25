package com.haebing.backend.textpackage.dto;

/** 신청인 6항목. 전부 선택 — 빈 값은 공란으로 렌더한다. */
public record Applicant(String name, String birthDate, String address, String phone, String mobile, String email) {
}
