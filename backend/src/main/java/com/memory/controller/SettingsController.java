package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping("/auth/me")
    public Result<Views.UserView> me() {
        return Result.ok(settingsService.get());
    }

    @GetMapping("/settings")
    public Result<Views.UserView> get() {
        return Result.ok(settingsService.get());
    }

    @PutMapping("/settings")
    public Result<Views.UserView> update(@Valid @RequestBody Dtos.SettingsRequest req) {
        return Result.ok(settingsService.update(req));
    }
}
