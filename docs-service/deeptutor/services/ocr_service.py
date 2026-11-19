"""Umi-OCR / RapidOCR bridge.

Umi-OCR ships a standalone ``RapidOCR-json.exe``.  It speaks a line-delimited
JSON protocol over stdin/stdout and needs no GUI or HTTP server, so the docs
service can use it as a normal subprocess.

The OCR engine is started lazily: a text PDF never pays the model-loading cost.
"""
from __future__ import annotations

import atexit
import base64
import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional


def _candidate_dirs() -> List[Path]:
    here = Path(__file__).resolve()
    dirs: List[Path] = []
    env = os.environ.get("UMI_OCR_DIR")
    if env:
        dirs.append(Path(env))
    exe_dir = Path(sys.executable).resolve().parent
    dirs.extend([
        exe_dir / "umi-ocr",
        exe_dir / "docs" / "umi-ocr",
        here.parents[2] / "umi-ocr" if len(here.parents) > 2 else here.parent / "umi-ocr",
        Path.cwd() / "umi-ocr",
    ])
    return dirs


def _find_plugin() -> Optional[Path]:
    for d in _candidate_dirs():
        exe = d / "RapidOCR-json.exe"
        if exe.is_file() and (d / "models").is_dir():
            return d
        # Tolerate pointing at the plugin directory itself.
        if d.name == "win7_x64_RapidOCR-json" and exe.is_file():
            return d
    return None


class RapidOCR:
    """Small, thread-safe wrapper around RapidOCR-json.exe."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._proc: Optional[subprocess.Popen] = None
        self._dir: Optional[Path] = None
        self._start_error: Optional[str] = None

    @property
    def available(self) -> bool:
        return _find_plugin() is not None

    def _start(self) -> None:
        if self._proc is not None and self._proc.poll() is None:
            return
        plugin = _find_plugin()
        if plugin is None:
            raise RuntimeError("Umi-OCR RapidOCR 未安装（缺少 docs/umi-ocr）")
        self._dir = plugin
        exe = plugin / "RapidOCR-json.exe"
        args = [
            str(exe),
            "--models=" + str(plugin / "models"),
            "--det=ch_PP-OCRv3_det_infer.onnx",
            "--cls=ch_ppocr_mobile_v2.0_cls_infer.onnx",
            "--rec=rec_ch_PP-OCRv4_infer.onnx",
            "--keys=dict_chinese.txt",
            "--doAngle=0",
            "--mostAngle=0",
            "--maxSideLen=2880",
            "--numThread=2",
            "--ensureAscii=1",
        ]
        startup = None
        if os.name == "nt":
            startup = subprocess.STARTUPINFO()
            startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startup.wShowWindow = subprocess.SW_HIDE
        self._proc = subprocess.Popen(
            args,
            cwd=str(plugin),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            startupinfo=startup,
        )
        # The engine prints a banner and "OCR init completed.".
        deadline = 30
        for _ in range(deadline * 10):
            if self._proc.poll() is not None:
                raise RuntimeError("RapidOCR 启动失败")
            line = self._proc.stdout.readline()  # type: ignore[union-attr]
            if not line:
                break
            if b"OCR init completed." in line:
                return
        self.close()
        raise RuntimeError("RapidOCR 初始化超时")

    def recognize(self, png_bytes: bytes) -> List[Dict[str, Any]]:
        """Return OCR lines: ``[{text, box, score}, ...]``."""
        with self._lock:
            self._start()
            if self._proc is None or self._proc.stdin is None or self._proc.stdout is None:
                raise RuntimeError("RapidOCR 未启动")
            payload = {
                "image_base64": base64.b64encode(png_bytes).decode("ascii"),
            }
            self._proc.stdin.write(
                (json.dumps(payload, ensure_ascii=True) + "\n").encode("utf-8")
            )
            self._proc.stdin.flush()
            line = self._proc.stdout.readline()
            if not line:
                raise RuntimeError("RapidOCR 无返回")
            result = json.loads(line.decode("utf-8", errors="ignore"))
            if result.get("code") != 100:
                return []
            rows = result.get("data") or []
            if not isinstance(rows, list):
                return []
            out: List[Dict[str, Any]] = []
            for row in rows:
                if isinstance(row, dict) and row.get("text"):
                    out.append({
                        "text": str(row.get("text", "")).strip(),
                        "box": row.get("box") or [],
                        "score": float(row.get("score") or 0),
                    })
            return out

    def close(self) -> None:
        proc = self._proc
        self._proc = None
        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass


_engine = RapidOCR()
atexit.register(_engine.close)


def available() -> bool:
    return _engine.available


def recognize_png(png_bytes: bytes) -> List[Dict[str, Any]]:
    return _engine.recognize(png_bytes)


def close() -> None:
    _engine.close()
