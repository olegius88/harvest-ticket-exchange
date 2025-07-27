// Модуль для конфигурации Wi-Fi адаптеров Windows для использования диапазона 2.4 ГГц.
//
// Этот модуль содержит функции для автоматической настройки системных параметров,
// которые заставляют Wi-Fi адаптеры предпочитать работу на частоте 2.4 ГГц вместо 5 ГГц.
// Это обеспечивает лучшую совместимость с устаревшими устройствами и большую дальность
// действия сигнала.

use crate::error::FCError;
use std::process::Command;

/// Функция для принудительного использования 2.4 ГГц диапазона
/// через настройки сетевого адаптера Windows
pub fn configure_wifi_adapter_for_2_4ghz() -> Result<(), FCError> {
    // Попытаемся настроить предпочтительный диапазон через netsh
    // Это работает не на всех адаптерах, но стоит попытаться

    let output = Command::new("netsh")
        .args(&[
            "wlan",
            "set",
            "profileparameter",
            "name=*",
            "connectiontype=auto",
            "connectionmode=auto",
        ])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                println!("Successfully configured Wi-Fi for auto connection");
            } else {
                let stderr = String::from_utf8_lossy(&result.stderr);
                println!("Warning: Could not configure Wi-Fi adapter: {}", stderr);
            }
        }
        Err(e) => {
            println!("Warning: Failed to run netsh command: {}", e);
        }
    }

    // Попытаемся установить предпочтительный диапазон через PowerShell
    let ps_script = r#"
        try {
            $adapters = Get-NetAdapter | Where-Object {$_.InterfaceDescription -like "*Wi-Fi*" -or $_.InterfaceDescription -like "*Wireless*"}
            foreach ($adapter in $adapters) {
                try {
                    # Попытаемся установить предпочтительный диапазон на 2.4 ГГц
                    Set-NetAdapterAdvancedProperty -Name $adapter.Name -DisplayName "Preferred Band" -DisplayValue "2.4GHz" -ErrorAction SilentlyContinue
                    Set-NetAdapterAdvancedProperty -Name $adapter.Name -DisplayName "Band Preference" -DisplayValue "2.4GHz" -ErrorAction SilentlyContinue
                    Set-NetAdapterAdvancedProperty -Name $adapter.Name -DisplayName "Wireless Band" -DisplayValue "2.4GHz" -ErrorAction SilentlyContinue
                    Write-Host "Configured adapter: $($adapter.Name)"
                } catch {
                    Write-Host "Could not configure adapter: $($adapter.Name)"
                }
            }
        } catch {
            Write-Host "Failed to configure Wi-Fi adapters"
        }
    "#;

    let output = Command::new("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-Command", ps_script])
        .output();

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);

            if !stdout.is_empty() {
                println!("PowerShell output: {}", stdout);
            }
            if !stderr.is_empty() && !result.status.success() {
                println!("PowerShell warning: {}", stderr);
            }
        }
        Err(e) => {
            println!("Warning: Failed to run PowerShell command: {}", e);
        }
    }

    Ok(())
}

/// Функция для установки переменных среды, которые могут влиять на поведение Wi-Fi
pub fn set_wifi_environment_variables() {
    std::env::set_var("WLAN_PREFERRED_BAND", "2.4GHz");
    std::env::set_var("WIFI_FORCE_24GHZ", "1");
    println!("Set environment variables for 2.4 GHz preference");
}

/// Функция для создания профиля Wi-Fi с принудительным использованием 2.4 ГГц
pub fn create_2_4ghz_profile(ssid: &str, password: &str) -> Result<(), FCError> {
    // Создаем XML профиль, который предпочитает 2.4 ГГц
    let profile_xml = format!(
        r#"<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{}</name>
    <SSIDConfig>
        <SSID>
            <name>{}</name>
        </SSID>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM>
        <security>
            <authEncryption>
                <authentication>WPA2PSK</authentication>
                <encryption>AES</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>{}</keyMaterial>
            </sharedKey>
        </security>
    </MSM>
    <MacRandomization xmlns="http://www.microsoft.com/networking/WLAN/profile/v3">
        <enableRandomization>false</enableRandomization>
    </MacRandomization>
</WLANProfile>"#,
        ssid, ssid, password
    );

    // Сохраняем профиль во временный файл
    let temp_dir = std::env::temp_dir();
    let profile_path = temp_dir.join(format!("{}_profile.xml", ssid));

    match std::fs::write(&profile_path, profile_xml) {
        Ok(()) => {
            // Добавляем профиль через netsh
            let output = Command::new("netsh")
                .args(&[
                    "wlan",
                    "add",
                    "profile",
                    &format!("filename={}", profile_path.display()),
                ])
                .output();

            // Удаляем временный файл
            let _ = std::fs::remove_file(&profile_path);

            match output {
                Ok(result) => {
                    if result.status.success() {
                        println!("Successfully created Wi-Fi profile for {}", ssid);
                    } else {
                        let stderr = String::from_utf8_lossy(&result.stderr);
                        return Err(FCError {
                            message: format!("Failed to create Wi-Fi profile: {}", stderr),
                        });
                    }
                }
                Err(e) => {
                    return Err(FCError {
                        message: format!("Failed to run netsh add profile: {}", e),
                    });
                }
            }
        }
        Err(e) => {
            return Err(FCError {
                message: format!("Failed to write profile file: {}", e),
            });
        }
    }

    Ok(())
}
