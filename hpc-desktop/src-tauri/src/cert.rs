#[cfg(target_os = "windows")]
pub fn install_root_ca_bytes(bytes: &[u8]) -> Result<(), String> {
    use std::ptr;
    use windows_sys::Win32::Security::Cryptography::*;

    unsafe {
        let store = CertOpenStore(
            CERT_STORE_PROV_SYSTEM_A,
            0,
            0,
            CERT_SYSTEM_STORE_CURRENT_USER,
            b"Root\0".as_ptr() as _,
        );

        if store.is_null() {
            return Err("Failed to open Windows CurrentUser certificate store".into());
        }

        let added = CertAddEncodedCertificateToStore(
            store,
            X509_ASN_ENCODING | PKCS_7_ASN_ENCODING,
            bytes.as_ptr(),
            bytes.len() as u32,
            CERT_STORE_ADD_REPLACE_EXISTING,
            ptr::null_mut(),
        );

        CertCloseStore(store, 0);

        if added == 0 {
            return Err("Failed to register clinic root CA in Windows store".into());
        }

        Ok(())
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
