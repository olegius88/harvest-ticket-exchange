@echo off
REM fixGradlePermissionsAndBuild.bat
REM !!!! внимание !!!! остановите все npm процессы с текущим проектом. иначе не сработает
REM Этот скрипт принимает владение папкой .gradle, предоставляет полный доступ,
REM удаляет папку, останавливает все запущенные Gradle-демоны, очищает проект и пытается собрать приложение.
REM Дополнительная ссылка: https://chatgpt.com/c/67bc926e-5a1c-800b-aaa8-9f173cd5b685

echo Stopping Gradle daemons...
call gradlew.bat --stop

echo Taking ownership of the .gradle folder...
takeown /F ".gradle" /R /D Y

echo Granting full control to the current user...
icacls ".gradle" /grant %USERNAME%:F /T

echo Deleting the .gradle folder...
rmdir /s /q .gradle

echo Cleaning the project...
call gradlew.bat clean

echo Building the app with stacktrace...
call gradlew.bat app:installDebug --stacktrace

echo.
echo Build process complete. Press any key to exit.
pause
