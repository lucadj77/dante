// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // On macOS 10.15 this restarts Dante with the WebKit of the updated Safari.
    dante_lib::webkit::use_staged_webkit();
    dante_lib::run()
}
