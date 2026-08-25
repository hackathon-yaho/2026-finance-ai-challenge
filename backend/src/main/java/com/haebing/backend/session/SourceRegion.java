package com.haebing.backend.session;

/** FR-046 문장-근거 연결의 bbox — 근사 좌표(비율 0~1). 텍스트 입력 카드는 null. */
public record SourceRegion(double x, double y, double w, double h) {
}
