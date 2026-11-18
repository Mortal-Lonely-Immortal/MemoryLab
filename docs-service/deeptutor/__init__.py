import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from deeptutor.config import Config
from deeptutor.database import init_db


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    os.makedirs(Config.DATA_DIR, exist_ok=True)
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(os.path.join(Config.UPLOAD_FOLDER, "images"), exist_ok=True)
    init_db()

    from deeptutor.routes.api_documents import documents_bp
    from deeptutor.routes.api_tutor import tutor_bp
    from deeptutor.routes.api_music import music_bp

    app.register_blueprint(tutor_bp, url_prefix="/api/tutor")
    app.register_blueprint(documents_bp, url_prefix="/api/documents")
    app.register_blueprint(music_bp, url_prefix="/api/music")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/uploads/images/<filename>")
    @app.get("/static/uploads/images/<filename>")
    def uploaded_image(filename):
        return send_from_directory(os.path.join(Config.UPLOAD_FOLDER, "images"), filename)

    return app
