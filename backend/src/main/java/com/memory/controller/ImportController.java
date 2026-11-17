package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Views;
import com.memory.entity.ImportJob;
import com.memory.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @PostMapping("/docx")
    public Result<Views.ImportResult> importDocx(@RequestParam("file") MultipartFile file) {
        return Result.ok(importService.importDocx(file));
    }

    @GetMapping("/jobs/{id}")
    public Result<ImportJob> job(@PathVariable Long id) {
        return Result.ok(importService.getJob(id));
    }
}
