package com.memory.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Keeps existing cards classified after a version upgrade.
 * Imported cards are classified during import; this pass handles cards that
 * were imported before the book/chapter hierarchy existed.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ClassificationBootstrap implements ApplicationRunner {

    private final CardClassificationService classificationService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int changed = classificationService.classifyAll();
            log.info("startup classification finished: {} notes moved", changed);
        } catch (Exception e) {
            log.warn("startup classification skipped: {}", e.getMessage());
        }
    }
}
