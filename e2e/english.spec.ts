import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

// The same first steps with the interface in English and the English sample project. It
// also runs on WebKit, the engine of Safari and of the Mac app.

async function openSample(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("dante.app-settings", JSON.stringify({ language: "en", userName: "Test" }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Try the sample project" }).click();
  await expect(page.getByRole("tree")).toBeVisible();
}

/** Words of the interface in Italian that an English screen must not show. */
const ITALIAN = /\b(Impostazioni|Manoscritto|Capitolo|Scena|Nuova|Nuovo|Elimina|Esporta|Proprietà|Collegamenti|Commenti|Statistiche|parole|caratteri|Aggiungi|Cerca|Chiudi)\b/;

test("shows every section in English", async ({ page }) => {
  await openSample(page);
  await expect(page.getByText("Pride and Prejudice").first()).toBeVisible();
  for (const id of ["manuscript", "codex", "notes", "views", "stats", "export", "settings"]) {
    await page.locator(`nav button[data-section="${id}"]`).click();
    await expect(page.locator(`nav button[data-section="${id}"]`)).toHaveAttribute("aria-pressed", "true");
    const text = await page.locator("body").innerText();
    expect(text.match(ITALIAN)?.[0] ?? "", `Italian in the section ${id}`).toBe("");
  }
});

test("writes in a scene and counts the words", async ({ page }) => {
  await openSample(page);
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.type("A new sentence. ");
  await expect(editor).toContainText("A new sentence.");
  await expect(page.locator(".status-bar")).toContainText(/words|characters/);
});

test("finds a settings page by a word", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="settings"]').click();
  await page.getByPlaceholder("Search the settings").fill("font");
  await expect(page.locator('[data-settings="text"]')).toBeVisible();
  await expect(page.locator('[data-settings="cover"]')).toBeHidden();
  await page.locator('[data-settings="text"]').click();
  await expect(page.getByRole("heading", { name: "The text in the editor" })).toBeVisible();
});

test("exports the novel to Word", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="export"]').click();
  await page.getByRole("radio", { name: /Word/ }).check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export DOCX" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  const bytes = new Uint8Array(await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks)));
  const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
  expect(xml).toContain("Chapter");
});

test("closes the Trash with Esc", async ({ page }) => {
  await openSample(page);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Trash" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("opens the guide at the chapter on exporting from the typography panel", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="export"]').click();
  await page.getByRole("button", { name: "Open the guide on this subject" }).click();
  const heading = page.getByRole("dialog").getByRole("heading", { name: /Exporting to Word, PDF and EPUB/ });
  await expect(heading).toBeInViewport();
});
