package com.memory.scheduler;

import com.memory.service.MethodLabService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MethodPlanScheduler {

    private final MethodLabService methodLabService;

    /**
     * 每周日 20:00（Asia/Shanghai）为下周准备 3 个方法的草稿计划。
     */
    @Scheduled(cron = "0 0 20 * * SUN", zone = "Asia/Shanghai")
    public void planNextWeek() {
        try {
            var plan = methodLabService.ensureNextWeekDraft();
            log.info("weekly method plan ready: weekStart={}, planId={}", plan.weekStart(), plan.id());
        } catch (Exception e) {
            log.error("failed to create weekly method plan", e);
        }
    }
}
