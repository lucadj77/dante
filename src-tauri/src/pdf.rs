//! PDF export. The frontend builds a Typst document from the manuscript and this module
//! compiles it in-process with the Typst crates, so no external tool is needed. Files
//! the document references (e.g. images) are read from the project folder only.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use typst::diag::{FileError, FileResult, PackageError, Severity, SourceDiagnostic};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World, WorldExt};
use typst_kit::datetime::Time;
use typst_kit::files::{FileLoader, FileStore};
use typst_kit::fonts::{self, FontStore};
use typst_layout::PagedDocument;

/// The standard library, built once.
static LIBRARY: LazyLock<LazyHash<Library>> = LazyLock::new(|| LazyHash::new(Library::default()));

/// Embedded fonts plus the system's fonts. Scanning the system is slow, so it happens
/// once per run, on the first export.
static FONTS: LazyLock<FontStore> = LazyLock::new(|| {
    let mut store = FontStore::new();
    store.extend(fonts::embedded());
    store.extend(fonts::system());
    store
});

/// Virtual path of the in-memory main file, at the project root so relative paths in
/// it resolve inside the project.
const MAIN_PATH: &str = "/__dante_export__.typ";

/// Serves the main source from memory and every other file from the project folder.
struct ProjectFiles {
    root: PathBuf,
    main: FileId,
    source: String,
}

impl FileLoader for ProjectFiles {
    fn load(&self, id: FileId) -> FileResult<Bytes> {
        if id == self.main {
            return Ok(Bytes::from_string(self.source.clone()));
        }
        if let VirtualRoot::Package(spec) = id.root() {
            return Err(FileError::Package(PackageError::Other(Some(
                format!("packages are not supported ({spec})").into(),
            ))));
        }
        let path = id.vpath().realize(&self.root).map_err(FileError::from)?;
        let io = |e| FileError::from_io(e, &path);
        // `realize` refuses lexical escapes; canonicalizing also catches symlinks.
        let real = path.canonicalize().map_err(io)?;
        let root = self.root.canonicalize().map_err(|e| FileError::from_io(e, &self.root))?;
        if !real.starts_with(&root) {
            return Err(FileError::AccessDenied);
        }
        if real.is_dir() {
            return Err(FileError::IsDirectory);
        }
        fs::read(&real).map(Bytes::new).map_err(io)
    }
}

/// The compilation environment for one export.
struct DanteWorld {
    main: FileId,
    files: FileStore<ProjectFiles>,
    time: Time,
}

impl DanteWorld {
    fn new(source: &str, root: &Path) -> Self {
        let main = RootedPath::new(VirtualRoot::Project, VirtualPath::new(MAIN_PATH).expect("valid path")).intern();
        let loader = ProjectFiles { root: root.to_path_buf(), main, source: source.to_owned() };
        Self { main, files: FileStore::new(loader), time: Time::system() }
    }

    /// Formats one diagnostic as "line N: message (hint: ...)".
    fn describe(&self, diag: &SourceDiagnostic) -> String {
        let mut text = String::new();
        if let (Some(id), Some(range)) = (diag.span.id(), self.range(diag.span)) {
            let line = self.source(id).ok().and_then(|s| s.lines().byte_to_line(range.start));
            match (id == self.main, line) {
                (true, Some(line)) => text.push_str(&format!("line {}: ", line + 1)),
                (false, Some(line)) => {
                    text.push_str(&format!("{}:{}: ", id.vpath().get_without_slash(), line + 1))
                }
                (false, None) => text.push_str(&format!("{}: ", id.vpath().get_without_slash())),
                (true, None) => {}
            }
        }
        text.push_str(&diag.message);
        for hint in &diag.hints {
            text.push_str(&format!("\n  hint: {}", hint.v));
        }
        text
    }

    /// Joins the errors of a failed compilation into one readable message.
    fn report(&self, diags: &[SourceDiagnostic]) -> String {
        let errors: Vec<String> =
            diags.iter().filter(|d| d.severity == Severity::Error).map(|d| self.describe(d)).collect();
        if errors.is_empty() { "PDF export failed".into() } else { errors.join("\n") }
    }
}

impl World for DanteWorld {
    fn library(&self) -> &LazyHash<Library> {
        &LIBRARY
    }

    fn book(&self) -> &LazyHash<FontBook> {
        FONTS.book()
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        self.files.source(id)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        FONTS.font(index)
    }

    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.time.today(offset)
    }
}

/// Compiles Typst `source` to PDF bytes; referenced files resolve inside `root`.
pub fn compile(source: &str, root: &Path) -> Result<Vec<u8>, String> {
    let world = DanteWorld::new(source, root);
    let document: PagedDocument = typst::compile(&world).output.map_err(|d| world.report(&d))?;
    typst_pdf::pdf(&document, &typst_pdf::PdfOptions::default()).map_err(|d| world.report(&d))
}

#[tauri::command]
pub async fn compile_pdf(root: String, source: String, output: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = compile(&source, Path::new(&root))?;
        fs::write(&output, bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        std::env::temp_dir()
    }

    #[test]
    fn compiles_a_small_novel() {
        let source = r#"#set page(paper: "a5")
#set text(font: "Libertinus Serif", lang: "it")
= Capitolo primo
Nel mezzo del cammin di _nostra_ vita.
#pagebreak()
= Capitolo secondo
Mi ritrovai per una selva oscura.
"#;
        let pdf = compile(source, &root()).expect("compiles");
        assert!(pdf.starts_with(b"%PDF"));
    }

    #[test]
    fn syntax_error_is_reported() {
        let err = compile("Testo\n#let x = (1, 2\n", &root()).unwrap_err();
        assert!(err.contains("line 2"), "{err}");
        assert!(err.contains("unclosed delimiter"), "{err}");
    }

    #[test]
    fn packages_are_refused() {
        let err = compile("#import \"@preview/foo:0.1.0\": *\n", &root()).unwrap_err();
        assert!(err.contains("packages are not supported"), "{err}");
    }

    #[test]
    fn files_outside_root_are_refused() {
        let dir = std::env::temp_dir().join("dante-pdf-test-root");
        fs::create_dir_all(&dir).unwrap();
        let err = compile("#image(\"../outside.png\")\n", &dir).unwrap_err();
        assert!(err.contains("line 1") && err.contains("escape"), "{err}");
    }

    #[test]
    fn compiles_tables_and_images_as_the_export_writes_them() {
        // A 1×1 PNG in a folder of the "project".
        const PNG: [u8; 70] = [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
            0x54, 0x78, 0xda, 0x63, 0xfc, 0xcf, 0xc0, 0x50, 0x0f, 0x00, 0x04, 0x85, 0x01, 0x80, 0x84, 0xa9, 0x8c, 0x21, 0x00, 0x00,
            0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ];
        let dir = std::env::temp_dir().join("dante-pdf-test-images");
        fs::create_dir_all(dir.join("Allegati")).unwrap();
        fs::write(dir.join("Allegati/casa blu.png"), PNG).unwrap();
        let source = r##"#set text(font: "Libertinus Serif")
#block(breakable: false, width: 100%)[#align(center, image("/Allegati/casa blu.png", width: 3.125in, alt: "Casa")) #set par(first-line-indent: 0pt, justify: false); #align(center, text(size: 0.9em, style: "italic")[#"La casa "#emph("blu")])]

#"Come ci sei finito? "#box(baseline: 50% - 0.25em, image("/Allegati/casa blu.png", width: 0.208in))#" vi chiederete."

#align(center, block(width: 100%, table(columns: 2, align: (left, center,), inset: 0.4em, table.header(strong[#"Fase"], strong[#"Documento"]), [#"0"], [#emph("L’idea")])))
"##;
        let pdf = compile(source, &dir).expect("compiles");
        assert!(pdf.starts_with(b"%PDF"));
    }
}
