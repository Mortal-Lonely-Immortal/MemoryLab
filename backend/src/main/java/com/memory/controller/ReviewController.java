package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping("/queue")
    public Result<List<Views.QueueItem>> queue(@RequestParam(defaultValue = "20") int limit,
                                               @RequestParam(defaultValue = "mixed") String mode) {
        return Result.ok(reviewService.queue(limit, mode));
    }

    @PostMapping("/{cardId}")
    public Result<Views.ReviewResult> review(@PathVariable Long cardId,
                                             @Valid @RequestBody Dtos.ReviewRequest req) {
        return Result.ok(reviewService.review(cardId, req));
    }
}
