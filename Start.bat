@echo off
chcp 936 >nul
title UltraPokechill

echo.
echo ========================================
echo        UltraPokechill ���ط�����
echo ========================================
echo.
echo [��Ϣ] ʹ�� Python ����������...
echo [��ַ] ���ʵ�ַ: http://127.0.0.1:8000/
echo [��ʾ] ��������رշ��������˳�...
echo.
echo ========================================
echo.

REM ����Python HTTP������
start /B python -m http.server 8000 >nul 2>&1

REM �������
start http://127.0.0.1:8000/

pause >nul

REM �ر�Python����
taskkill /F /IM python.exe >nul 2>&1

echo �������ѹرա�
timeout /t 1 /nobreak >nul