package com.memory.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SPA fallback: Vue Router uses history mode, so direct visits to page paths
 * must return index.html instead of a 404.
 */
@Controller
public class SpaController {

    @GetMapping({"/", "/review", "/cards", "/methods", "/import", "/stats", "/settings"})
    public String index() {
        return "forward:/index.html";
    }
}
