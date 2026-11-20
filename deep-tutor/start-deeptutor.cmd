@echo off
setlocal
set "HERE=%~dp0"
set "PYTHONPATH=%HERE%truststore_bootstrap;%PYTHONPATH%"
if not defined DEEPTUTOR_HOME set "DEEPTUTOR_HOME=%HERE%data"
if not exist "%DEEPTUTOR_HOME%" mkdir "%DEEPTUTOR_HOME%"
echo DeepTutor home: %DEEPTUTOR_HOME%
"%HERE%.venv\Scripts\deeptutor.exe" init --home "%DEEPTUTOR_HOME%" --non-interactive
"%HERE%.venv\Scripts\deeptutor.exe" start --home "%DEEPTUTOR_HOME%" --no-browser --detach
echo.
echo DeepTutor should be at http://127.0.0.1:3782






