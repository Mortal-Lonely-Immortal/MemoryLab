package com.memory.controller;

import com.memory.common.Result;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.service.NoteService;
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

import java.util.List;

@RestController
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping
    public Result<List<Views.NoteView>> list(@RequestParam(required = false) Long deckId,
                                             @RequestParam(required = false) String keyword) {
        return Result.ok(noteService.list(deckId, keyword));
    }

    @GetMapping("/{id}")
    public Result<Views.NoteView> get(@PathVariable Long id) {
        return Result.ok(noteService.get(id));
    }

    @PostMapping
    public Result<Views.NoteView> create(@Valid @RequestBody Dtos.NoteRequest req) {
        return Result.ok(noteService.create(req));
    }

    @PutMapping("/{id}")
    public Result<Views.NoteView> update(@PathVariable Long id, @Valid @RequestBody Dtos.NoteRequest req) {
        return Result.ok(noteService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        noteService.delete(id);
        return Result.ok();
    }
}
