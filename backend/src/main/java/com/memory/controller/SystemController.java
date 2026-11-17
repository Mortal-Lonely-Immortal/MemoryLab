package com.memory.controller;

import com.memory.common.Result;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    private final ApplicationContext context;

    public SystemController(ApplicationContext context) {
        this.context = context;
    }

    @PostMapping("/shutdown")
    public Result<Void> shutdown() {
        new Thread(() -> {
            try {
                Thread.sleep(250);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            int code = SpringApplication.exit(context, () -> 0);
            System.exit(code);
        }, "memorylab-shutdown").start();
        return Result.ok();
    }
}
