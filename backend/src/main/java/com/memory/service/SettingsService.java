package com.memory.service;

import com.memory.common.BizException;
import com.memory.dto.Dtos;
import com.memory.dto.Views;
import com.memory.entity.SysUser;
import com.memory.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SysUserMapper userMapper;

    public SysUser user() {
        SysUser user = userMapper.selectById(1L);
        if (user == null) {
            throw new BizException(500, "用户数据缺失，请检查 Flyway 种子数据");
        }
        return user;
    }

    public Views.UserView get() {
        SysUser u = user();
        return new Views.UserView(u.getId(), u.getNickname(), u.getTimezone(),
                u.getDailyNewLimit(), u.getDailyReviewLimit(), u.getDesiredRetention());
    }

    @Transactional
    public Views.UserView update(Dtos.SettingsRequest req) {
        SysUser u = user();
        if (req.dailyNewLimit() != null) {
            u.setDailyNewLimit(Math.max(0, Math.min(200, req.dailyNewLimit())));
        }
        if (req.dailyReviewLimit() != null) {
            u.setDailyReviewLimit(Math.max(0, Math.min(1000, req.dailyReviewLimit())));
        }
        if (req.desiredRetention() != null) {
            u.setDesiredRetention(Math.max(0.7, Math.min(0.99, req.desiredRetention())));
        }
        userMapper.updateById(u);
        return get();
    }
}
