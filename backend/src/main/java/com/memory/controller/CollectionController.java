package com.memory.controller;

import com.memory.common.PageResult;
import com.memory.common.Result;
import com.memory.dto.Views;
import com.memory.entity.Card;
import com.memory.service.CardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/collections")
@RequiredArgsConstructor
public class CollectionController {

    private final CardService cardService;

    @GetMapping("/summary")
    public Result<Views.CollectionSummary> summary() {
        return Result.ok(cardService.collectionSummary());
    }

    @GetMapping("/favorites")
    public Result<PageResult<Views.CardView>> favorites(@RequestParam(defaultValue = "1") long page,
                                                         @RequestParam(defaultValue = "50") long size) {
        return Result.ok(cardService.page(page, size, null, null, null, null, true, null));
    }

    @GetMapping("/wrong")
    public Result<PageResult<Views.CardView>> wrong(@RequestParam(defaultValue = "1") long page,
                                                    @RequestParam(defaultValue = "50") long size) {
        return Result.ok(cardService.page(page, size, null, null, null, null, null, true));
    }

    /** Markdown used by the AI/embedding ingestion pipeline. */
    @GetMapping("/ai-text")
    public Result<String> aiText() {
        StringBuilder sb = new StringBuilder("# Memory Lab 收藏与错题集\n\n");
        appendSection(sb, "收藏", cardService.collection(true, null, 500));
        appendSection(sb, "错题集", cardService.collection(null, true, 500));
        return Result.ok(sb.toString());
    }

    private static void appendSection(StringBuilder sb, String title, List<Card> cards) {
        sb.append("## ").append(title).append("\n\n");
        if (cards.isEmpty()) {
            sb.append("（空）\n\n");
            return;
        }
        for (Card c : cards) {
            sb.append("### ").append(c.getFront()).append("\n");
            sb.append(c.getBack()).append("\n");
            if (c.getExtra() != null && !c.getExtra().isBlank()) {
                sb.append("来源：").append(c.getExtra()).append("\n");
            }
            sb.append("\n");
        }
    }
}
