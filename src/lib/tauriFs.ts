import { invoke } from "@tauri-apps/api/core";
import type { DirEntry, ProjectFs } from "./core/fs";

/** Project filesystem backed by the Rust commands in src-tauri/src/files.rs. */
export class TauriFs implements ProjectFs {
  constructor(public root: string) {}

  list(path: string) {
    return invoke<DirEntry[]>("list_dir", { root: this.root, path });
  }
  readText(path: string) {
    return invoke<string>("read_text", { root: this.root, path });
  }
  writeText(path: string, content: string) {
    return invoke<void>("write_text", { root: this.root, path, content });
  }
  rename(from: string, to: string) {
    return invoke<void>("rename_path", { root: this.root, from, to });
  }
  mkdir(path: string) {
    return invoke<void>("create_dir", { root: this.root, path });
  }
  exists(path: string) {
    return invoke<boolean>("path_exists", { root: this.root, path });
  }
  remove(path: string) {
    return invoke<void>("remove_path", { root: this.root, path });
  }
  async readBytes(path: string) {
    return new Uint8Array(await invoke<ArrayBuffer>("read_bytes", { root: this.root, path }));
  }
  /** Opens the file with the application the system uses for its kind. */
  openWithSystem(path: string) {
    return invoke<void>("open_with_system", { root: this.root, path });
  }
  /** Copies files from the computer into `dir`; returns their project paths. */
  importFiles(dir: string, sources: string[]) {
    return invoke<string[]>("import_files", { root: this.root, dir, sources });
  }
}

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
