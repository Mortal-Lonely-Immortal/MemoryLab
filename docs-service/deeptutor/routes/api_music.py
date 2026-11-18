"""System media controls for the local music panel.

Browsers cannot enumerate or control native music apps directly. On Windows
we can at least send the standard media keys; whichever app owns the OS media
session (QQ Music, NetEase Cloud Music, Spotify, etc.) receives them.
"""
import ctypes
import sys

from flask import Blueprint, jsonify, request

music_bp = Blueprint("music", __name__)

_VK = {
    "play_pause": 0xB3,
    "next": 0xB0,
    "prev": 0xB1,
}


def _send_media_key(action: str) -> None:
    vk = _VK[action]
    user32 = ctypes.windll.user32
    user32.keybd_event(vk, 0, 0, 0)
    user32.keybd_event(vk, 0, 2, 0)


@music_bp.route("/system", methods=["GET"])
def system_capabilities():
    return jsonify({
        "available": sys.platform == "win32",
        "method": "windows-media-key",
        "actions": list(_VK.keys()),
        "note": "控制当前系统媒体会话；不读取歌曲名，也不能浏览播放器歌单。",
    })


@music_bp.route("/system", methods=["POST"])
def system_media():
    if sys.platform != "win32":
        return jsonify({"error": "系统媒体控制仅支持 Windows"}), 501
    data = request.get_json(silent=True) or {}
    action = str(data.get("action", "")).strip()
    if action not in _VK:
        return jsonify({"error": "action 必须是 play_pause / next / prev"}), 400
    try:
        _send_media_key(action)
        return jsonify({"status": "ok", "action": action})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
