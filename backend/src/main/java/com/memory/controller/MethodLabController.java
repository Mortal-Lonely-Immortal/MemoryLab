package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.MethodDtos;
import com.memory.dto.MethodViews;
import com.memory.service.MethodLabService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/method-lab")
@RequiredArgsConstructor
public class MethodLabController {

    private final MethodLabService methodLabService;

    @GetMapping("/methods")
    public Result<List<MethodViews.MethodView>> methods() {
        return Result.ok(methodLabService.methods());
    }

    @GetMapping("/plan/current")
    public Result<MethodViews.PlanView> current() {
        return Result.ok(methodLabService.current());
    }

    @GetMapping("/plan/{id}")
    public Result<MethodViews.PlanView> plan(@PathVariable Long id) {
        return Result.ok(methodLabService.plan(id));
    }

    @PostMapping("/plan")
    public Result<MethodViews.PlanView> create(@Valid @RequestBody MethodDtos.CreatePlanRequest req) {
        return Result.ok(methodLabService.create(req));
    }

    @PostMapping("/plan/next-draft")
    public Result<MethodViews.PlanView> nextDraft() {
        return Result.ok(methodLabService.ensureNextWeekDraft());
    }

    @PostMapping("/score")
    public Result<MethodViews.PlanView> score(@Valid @RequestBody MethodDtos.ScoreRequest req) {
        return Result.ok(methodLabService.score(req));
    }

    @PostMapping("/review")
    public Result<MethodViews.PlanView> review(@Valid @RequestBody MethodDtos.ReviewRequest req) {
        return Result.ok(methodLabService.review(req));
    }
}
