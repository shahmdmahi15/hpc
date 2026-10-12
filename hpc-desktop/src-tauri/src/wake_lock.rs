#[cfg(windows)]
use windows::Win32::System::Power::{
    SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
};

pub fn keep_screen_on(enabled: bool) {
    #[cfg(windows)]
    unsafe {
        if enabled {
            // Keeps waiting room display awake without dimming or system sleep
            SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED);
        } else {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
    }
}
