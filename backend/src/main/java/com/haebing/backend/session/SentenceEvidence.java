package com.haebing.backend.session;

/**
 * docs/02-architecture/data-model.md — 이미지 바이트를 담지 않는다. 몇 번째 이미지의 어느 영역인지
 * (순번 + bbox)만 담는다. 문장 하나가 근거를 여러 개 가지면 같은 sentenceId로 여러 원소가 생긴다.
 */
public record SentenceEvidence(String sentenceId, String type, Integer imageIndex, SourceRegion bbox) {
    public static final String TYPE_EVIDENCE = "evidence";
    public static final String TYPE_INTAKE = "intake";
    public static final String TYPE_USER_TEXT = "user_text";
}
