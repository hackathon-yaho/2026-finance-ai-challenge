package com.haebing.backend.draft.service;

import com.haebing.backend.ai.AiClient;
import com.haebing.backend.ai.dto.DraftIntake;
import com.haebing.backend.ai.dto.DraftRequest;
import com.haebing.backend.ai.dto.DraftResult;
import com.haebing.backend.ai.dto.DraftSentence;
import com.haebing.backend.ai.dto.EvidenceRef;
import com.haebing.backend.common.global.ErrorCode;
import com.haebing.backend.common.global.exception.BusinessException;
import com.haebing.backend.draft.dto.DraftResponse;
import com.haebing.backend.draft.dto.ReviseRequest;
import com.haebing.backend.draft.dto.ReviseResponse;
import com.haebing.backend.draft.dto.ReviseSentenceInput;
import com.haebing.backend.readiness.dto.ChecklistItem;
import com.haebing.backend.readiness.dto.ReadinessResponse;
import com.haebing.backend.readiness.service.ReadinessService;
import com.haebing.backend.session.ExtractedEvent;
import com.haebing.backend.session.SentenceEvidence;
import com.haebing.backend.session.Session;
import com.haebing.backend.session.StoredSentence;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** docs/backend/phase-5-draft-package.md 5-1·5-4a. 백엔드는 문장을 생성하지 않는다 — AI-server 결과를 검사·저장만 한다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DraftServiceImpl implements DraftService {

    private static final String REVISE_WARNING = "수정하신 문장은 업로드 자료와 연결되지 않아 '본인 진술'로 표시됩니다.";

    private final AiClient aiClient;
    private final ReadinessService readinessService;

    @Override
    public DraftResponse generate(Session session) {
        ReadinessResponse readiness = readinessService.evaluate(session);

        List<ExtractedEvent> confirmedEvents = session.getTimeline().stream()
                .filter(this::isConfirmed)
                .toList();
        DraftIntake intake = buildIntake(session);
        DraftRequest request = new DraftRequest(confirmedEvents, readiness.reason(), readiness.readiness(), intake);

        DraftResult result = aiClient.draft(request);
        if (!result.factCheckPassed()) {
            log.warn("[DraftService] factCheckPassed=false — 1회 재생성");
            result = aiClient.draft(request);
            if (!result.factCheckPassed()) {
                log.warn("[DraftService] 재생성 후에도 factCheckPassed=false — 응답을 그대로 반환한다(문장 단위 실패 지점을 알 수 없음)");
            }
        }

        storeResult(session, result);

        return new DraftResponse(session.getDraftText(), visibleSentenceDtos(session), readiness.checklist());
    }

    @Override
    public ReviseResponse revise(Session session, ReviseRequest request) {
        String warning = null;
        for (ReviseSentenceInput input : request.sentences()) {
            StoredSentence current = session.findSentence(input.sentenceId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST, "존재하지 않는 sentenceId입니다: " + input.sentenceId()));

            if (input.text() != null) {
                current = current.withText(input.text());
                // FR-045 ③은 LLM 출력에만 적용된다 — 사람이 적은 문장은 삭제하지 않고 본인 진술로 내린다.
                session.replaceSentenceEvidence(input.sentenceId(),
                        List.of(new SentenceEvidence(input.sentenceId(), SentenceEvidence.TYPE_USER_TEXT, null, null)));
                warning = REVISE_WARNING;
            }
            if (input.excluded() != null) {
                current = current.withExcluded(input.excluded());
            }
            session.updateSentence(current);
        }
        return new ReviseResponse(visibleSentenceDtos(session), warning);
    }

    private void storeResult(Session session, DraftResult result) {
        List<StoredSentence> stored = new ArrayList<>();
        List<SentenceEvidence> evidence = new ArrayList<>();
        for (DraftSentence s : result.sentences()) {
            stored.add(new StoredSentence(s.sentenceId(), s.text(), false, false));
            if (s.evidenceRefs() != null) {
                for (EvidenceRef ref : s.evidenceRefs()) {
                    evidence.add(new SentenceEvidence(s.sentenceId(), ref.type(), ref.imageIndex(), ref.bbox()));
                }
            }
        }
        session.replaceSentences(stored, evidence);
        session.setDraftText(result.draftText());
    }

    /** 제외된 문장은 목록에서 뺀다 — 최종 문서에서도 빠지므로 미리보기가 그 상태를 그대로 반영한다. */
    private List<DraftSentence> visibleSentenceDtos(Session session) {
        Map<String, List<EvidenceRef>> refsBySentence = new java.util.HashMap<>();
        for (SentenceEvidence e : session.getSentenceEvidence()) {
            refsBySentence.computeIfAbsent(e.sentenceId(), k -> new ArrayList<>())
                    .add(new EvidenceRef(e.type(), e.imageIndex(), e.bbox()));
        }
        List<DraftSentence> result = new ArrayList<>();
        for (StoredSentence s : session.getSentences()) {
            if (s.excluded()) continue;
            result.add(new DraftSentence(s.sentenceId(), s.text(), refsBySentence.getOrDefault(s.sentenceId(), List.of())));
        }
        return result;
    }

    private DraftIntake buildIntake(Session session) {
        Map<String, String> intake = session.getIntake();
        if (intake.isEmpty()) return null;
        String amountStr = intake.get("amount");
        Long amount = (amountStr == null || amountStr.isBlank()) ? null : Long.valueOf(amountStr);
        return new DraftIntake(intake.get("when"), amount, intake.get("kind"), intake.get("usage"));
    }

    private boolean isConfirmed(ExtractedEvent card) {
        return ExtractedEvent.USER_CONFIRMED.equals(card.confirmationStatus())
                || ExtractedEvent.USER_CORRECTED.equals(card.confirmationStatus());
    }
}
