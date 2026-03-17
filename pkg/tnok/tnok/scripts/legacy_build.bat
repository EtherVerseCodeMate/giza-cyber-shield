@echo off

pyinstaller ^
    --clean ^
    -y ^
    --onefile ^
    --name tnok ^
    ./src/tnok/__main__.py

pyinstaller ^
    --clean ^
    -y ^
    --onefile ^
    --name tnokd ^
    --collect-data cincoconfig ^
    ./src/tnokd/__main__.py

pyinstaller ^
    --clean ^
    -y ^
    --onefile ^
    --name tssh ^
    ./src/tnok/wrappers/tssh.py

pyinstaller ^
    --clean ^
    -y ^
    --onefile ^
    --name tscp ^
    ./src/tnok/wrappers/tscp.py