@echo off
setlocal
set "HERE=%~dp0"
cd /d "%HERE%"
set "DT_VENV_CFG=%HERE%.venv\pyvenv.cfg"
set "DT_BASE_PY=%HERE%python"
"%HERE%python\python.exe" -c "import os,pathlib; pathlib.Path(os.environ['DT_VENV_CFG']).write_text('home = ' + os.environ['DT_BASE_PY'] + '\ninclude-system-site-packages = false\nversion = 3.14.3\n', encoding='utf-8')"
set "PYTHONPATH=%HERE%truststore_bootstrap;%PYTHONPATH%"
if exist "%HERE%certs\windows-roots.pem" (
  set "SSL_CERT_FILE=%HERE%certs\windows-roots.pem"
  set "REQUESTS_CA_BUNDLE=%HERE%certs\windows-roots.pem"
)
if not defined DEEPTUTOR_HOME set "DEEPTUTOR_HOME=%HERE%data"
if not exist "%DEEPTUTOR_HOME%" mkdir "%DEEPTUTOR_HOME%"
echo DeepTutor home: %DEEPTUTOR_HOME%
"%HERE%.venv\Scripts\python.exe" -c "from deeptutor_cli.main import main; main()" init --home "%DEEPTUTOR_HOME%" --non-interactive
"%HERE%.venv\Scripts\python.exe" -c "from deeptutor_cli.main import main; main()" start --home "%DEEPTUTOR_HOME%" --no-browser --detach
echo.
echo DeepTutor should be at http://127.0.0.1:3782












