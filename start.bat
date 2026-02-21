@echo off
echo.
echo ========================================
echo  MetalYapi Scheduling Platform
echo ========================================
echo.

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/3] Stopping old containers...
docker compose down 2>nul

echo [2/3] Building and starting...
docker compose up --build -d

echo.
echo [3/3] Checking status...
timeout /t 8 /nobreak >nul

docker compose ps

echo.
echo ========================================
echo  Frontend:  http://localhost:5173
echo  Backend:   http://localhost:8000
echo  API Docs:  http://localhost:8000/docs
echo ========================================
echo.
echo Opening browser...
start http://localhost:5173
echo.
echo To see logs: docker compose logs -f
echo To stop:     docker compose down
echo.
pause
