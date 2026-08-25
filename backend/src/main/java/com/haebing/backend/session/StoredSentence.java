package com.haebing.backend.session;

/**
 * 소명서 문장의 현재 상태 — data-model.md의 `sentenceEvidence`(근거 참조만)와 별개로,
 * `/api/draft/revise`가 문장 텍스트·제외 여부를 다루려면 현재 텍스트를 세션에 들고 있어야 한다.
 * 근거(원본 이미지 위치)는 `Session.sentenceEvidence`에 sentenceId로 계속 연결된다.
 */
public record StoredSentence(String sentenceId, String text, boolean excluded, boolean userEdited) {

    public StoredSentence withText(String newText) {
        return new StoredSentence(sentenceId, newText, excluded, true);
    }

    public StoredSentence withExcluded(boolean newExcluded) {
        return new StoredSentence(sentenceId, text, newExcluded, userEdited);
    }
}
