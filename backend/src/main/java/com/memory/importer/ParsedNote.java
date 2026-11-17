package com.memory.importer;

import java.util.List;

public record ParsedNote(
        String title,
        String chapter,
        String oneLiner,
        String pitfalls,
        String corrections,
        List<String> bullets,
        List<String> tables,
        String source
) {
}
