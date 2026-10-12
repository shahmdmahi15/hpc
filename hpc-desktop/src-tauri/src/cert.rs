use std::path::Path;

#[cfg(target_os = "windows")]
pub fn install_root_ca_bytes(bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    use std::process::Command;

    let temp_dir = std::env::temp_dir();
    let temp_cert_path = temp_dir.join("hpc_clinic_root_ca.crt");

    let mut file = std::fs::File::create(&temp_cert_path)
        .map_err(|e| format!("Failed to create temp cert file: {}", e))?;
    file.write_all(bytes)
        .map_err(|e| format!("Failed to write cert bytes: {}", e))?;

    let output = Command::new("certutil")
        .args(["-addstore", "-user", "Root", temp_cert_path.to_str().unwrap_or("")])
        .output()
        .map_err(|e| format!("Failed to execute certutil: {}", e))?;

    let _ = std::fs::remove_file(temp_cert_path);

    if output.status.success() {
        Ok(())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("certutil failed: {}", err_msg))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn install_root_ca_bytes(_bytes: &[u8]) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn install_clinic_root_ca() -> Result<(), String> {
    const ROOT_CA_BYTES: &[u8] = include_bytes!("../certificates/rootCA.crt");
    install_root_ca_bytes(ROOT_CA_BYTES)
}

#[cfg(not(target_os = "windows"))]
pub fn install_clinic_root_ca() -> Result<(), String> {
    Ok(())
}
