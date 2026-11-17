package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Views;
import com.memory.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/overview")
    public Result<Views.Overview> overview() {
        return Result.ok(statsService.overview());
    }

    @GetMapping("/heatmap")
    public Result<List<Views.HeatmapItem>> heatmap(@RequestParam(defaultValue = "365") int days) {
        return Result.ok(statsService.heatmap(days));
    }

    @GetMapping("/forecast")
    public Result<List<Views.ForecastItem>> forecast(@RequestParam(defaultValue = "30") int days) {
        return Result.ok(statsService.forecast(days));
    }

    @GetMapping("/leeches")
    public Result<List<Views.CardView>> leeches() {
        return Result.ok(statsService.leeches());
    }

    @GetMapping("/daily")
    public Result<List<Views.DailyPoint>> daily(@RequestParam(defaultValue = "30") int days) {
        return Result.ok(statsService.daily(days));
    }

    @GetMapping("/card-states")
    public Result<List<Views.StateCount>> cardStates() {
        return Result.ok(statsService.cardStates());
    }
}
