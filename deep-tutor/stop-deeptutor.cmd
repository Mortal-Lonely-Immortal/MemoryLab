@echo off
setlocal
set "HERE=%~dp0"
if not defined DEEPTUTOR_HOME set "DEEPTUTOR_HOME=%HERE%data"
"%HERE%.venv\Scripts\deeptutor.exe" stop --home "%DEEPTUTOR_HOME%"




