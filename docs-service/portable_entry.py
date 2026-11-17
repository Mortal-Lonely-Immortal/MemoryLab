import os
from deeptutor import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("DOCS_PORT", "15000")), threaded=True)
