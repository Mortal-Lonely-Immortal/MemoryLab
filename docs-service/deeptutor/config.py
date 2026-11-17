import os
import secrets

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

    DATA_DIR = os.environ.get("DOCS_DATA_DIR", os.path.join(BASE_DIR, "data"))
    DATABASE = os.environ.get("DOCS_DATABASE", os.path.join(DATA_DIR, "tutor.db"))
    UPLOAD_FOLDER = os.environ.get("DOCS_UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))

    MAX_CONTENT_LENGTH = 60 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"pdf", "docx", "ppt", "pptx", "txt"}

    LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
    LLM_API_BASE = os.environ.get("LLM_API_BASE", "https://api.openai.com/v1")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-3.5-turbo")

    MEMORY_API_URL = os.environ.get("MEMORY_API_URL", "http://backend:8080/api/v1")
