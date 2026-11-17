package com.memory.controller;

import com.memory.common.PageResult;
import com.memory.common.Result;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.service.CardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cards")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;

    @GetMapping
    public Result<PageResult<Views.CardView>> page(@RequestParam(defaultValue = "1") long page,
                                                   @RequestParam(defaultValue = "20") long size,
                                                   @RequestParam(required = false) Long deckId,
                                                   @RequestParam(required = false) String keyword,
                                                   @RequestParam(required = false) Integer state) {
        return Result.ok(cardService.page(page, size, deckId, keyword, state));
    }

    @GetMapping("/{id}")
    public Result<Views.CardView> get(@PathVariable Long id) {
        return Result.ok(cardService.get(id));
    }

    @PostMapping
    public Result<Views.CardView> create(@Valid @RequestBody Dtos.CardRequest req) {
        return Result.ok(cardService.create(req));
    }

    @PutMapping("/{id}")
    public Result<Views.CardView> update(@PathVariable Long id, @Valid @RequestBody Dtos.CardRequest req) {
        return Result.ok(cardService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        cardService.delete(id);
        return Result.ok();
    }

    @PostMapping("/{id}/suspend")
    public Result<Views.CardView> suspend(@PathVariable Long id, @RequestParam(defaultValue = "true") boolean suspend) {
        return Result.ok(cardService.suspend(id, suspend));
    }
}
