"""
services — 业务逻辑层
=====================
包含所有核心业务逻辑，不直接处理HTTP请求。

模块:
  document_service.py     — PDF/Word/PPT 解析 + 公式检测 + 表格定位
  gamification_service.py — RPG 等级/称号/技能树 + 注册管理
  learning_service.py     — 艾宾浩斯复习 + 每日计划
  llm_service.py          — LLM API 调用（DeepSeek/Qwen）+ 批处理
  table_formatter.py      — AABB 表格定位与格式化
"""
