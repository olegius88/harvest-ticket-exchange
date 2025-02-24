@echo off
REM fixGradlePermissionsAndBuild.bat
REM This script takes ownership of the .gradle folder, grants full access, deletes the folder,
REM stops any running Gradle daemons, cleans the project, and attempts a build.

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
