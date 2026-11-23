@echo off
setlocal
set "HERE=%~dp0"
cd /d "%HERE%"
set "DT_VENV_CFG=%HERE%.venv\pyvenv.cfg"
set "DT_BASE_PY=%HERE%python"
"%HERE%python\python.exe" -c "import os,pathlib; pathlib.Path(os.environ['DT_VENV_CFG']).write_text('home = ' + os.environ['DT_BASE_PY'] + '\ninclude-system-site-packages = false\nversion = 3.14.3\n', encoding='utf-8')"
if not defined DEEPTUTOR_HOME set "DEEPTUTOR_HOME=%HERE%data"
"%HERE%.venv\Scripts\python.exe" -c "from deeptutor_cli.main import main; main()" stop --home "%DEEPTUTOR_HOME%"






