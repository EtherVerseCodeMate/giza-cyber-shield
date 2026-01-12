@echo off
REM ==============================================================================
REM Dilithium3 Git Signing Wrapper (Windows)
REM Replaces GPG with post-quantum Dilithium3 signatures
REM ==============================================================================

setlocal EnableDelayedExpansion

REM Input from Git (commit message file)
set INPUT_FILE=%~1

REM Generate signature file path
set SIGNATURE_FILE=%INPUT_FILE%.sig

REM Path to adinkhepra binary
set KHEPRA_BIN=%~dp0..\bin\adinkhepra.exe

REM Path to signing key (create if doesn't exist)
set KEY_DIR=%~dp0..\.khepra
set KEY_PATH=%KEY_DIR%\dag-signing-key

REM Ensure .khepra directory exists
if not exist "%KEY_DIR%" (
    mkdir "%KEY_DIR%"
)

REM Check if signing key exists, generate if not
if not exist "%KEY_PATH%" (
    echo [DILITHIUM-SIGN] Generating new Dilithium3 signing key... 1>&2
    "%KHEPRA_BIN%" keygen --out "%KEY_PATH%" --tenant "khepra-audit"
    if errorlevel 1 (
        echo [DILITHIUM-SIGN] ERROR: Failed to generate key 1>&2
        exit /b 1
    )
)

REM Sign the commit data
"%KHEPRA_BIN%" sign --key "%KEY_PATH%" --input "%INPUT_FILE%" --output "%SIGNATURE_FILE%"
if errorlevel 1 (
    echo [DILITHIUM-SIGN] ERROR: Failed to sign 1>&2
    exit /b 1
)

REM Git expects signature on stdout
type "%SIGNATURE_FILE%"

REM Cleanup temp signature file
del /q "%SIGNATURE_FILE%" 2>nul

endlocal
exit /b 0
