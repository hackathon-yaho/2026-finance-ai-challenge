package com.haebing.backend.session;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 세션 전체의 누적 신호 (F5-03 공백 탐지 입력). 이미지 하나를 판독할 때마다 OR로 합쳐 갱신한다 —
 * "이 세션에서 협박 정황이 한 번이라도 감지됐는가"처럼 한 번 true면 계속 true여야 하는 값들이다.
 */
public record Signals(
        @JsonProperty("threat_detected") boolean threatDetected,
        @JsonProperty("delivery_evidence") boolean deliveryEvidence,
        @JsonProperty("life_activity") boolean lifeActivity,
        @JsonProperty("quality_flags") QualityFlags qualityFlags
) {
    public static Signals empty() {
        return new Signals(false, false, false, new QualityFlags(false, false, false));
    }

    public Signals mergedWith(Signals other) {
        return new Signals(
                this.threatDetected || other.threatDetected,
                this.deliveryEvidence || other.deliveryEvidence,
                this.lifeActivity || other.lifeActivity,
                new QualityFlags(
                        this.qualityFlags.blurry() || other.qualityFlags.blurry(),
                        this.qualityFlags.missingDate() || other.qualityFlags.missingDate(),
                        this.qualityFlags.amountMismatch() || other.qualityFlags.amountMismatch()
                )
        );
    }
}
