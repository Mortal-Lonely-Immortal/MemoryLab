package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.service.DeckService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/decks")
@RequiredArgsConstructor
public class DeckController {

    private final DeckService deckService;

    @GetMapping
    public Result<List<Views.DeckView>> list() {
        return Result.ok(deckService.list());
    }

    @PostMapping
    public Result<Views.DeckView> create(@Valid @RequestBody Dtos.DeckRequest req) {
        return Result.ok(deckService.create(req));
    }

    @PutMapping("/{id}")
    public Result<Views.DeckView> update(@PathVariable Long id, @Valid @RequestBody Dtos.DeckRequest req) {
        return Result.ok(deckService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        deckService.delete(id);
        return Result.ok();
    }
}
