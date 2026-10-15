fn main() {
    // The app's icons are built into the program: a new icon must rebuild it.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
