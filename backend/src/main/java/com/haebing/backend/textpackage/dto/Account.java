package com.haebing.backend.textpackage.dto;

/** 지급정지 계좌 5항목. 전부 선택. */
public record Account(String bank, String branch, String depositType, String accountNumber, String holderName) {
}
