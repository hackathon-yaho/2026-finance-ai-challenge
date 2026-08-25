package com.haebing.backend.timeline.service;

import com.haebing.backend.session.Session;
import com.haebing.backend.timeline.dto.MergeRequest;
import com.haebing.backend.timeline.dto.TimelineResponse;

public interface TimelineService {

    /** F5-01 정렬 + F5-02 병합 후보 + F5-03 공백 탐지. */
    TimelineResponse getTimeline(Session session);

    /** F5-02 병합 승인/거절. */
    TimelineResponse approveMerge(Session session, MergeRequest request);
}
