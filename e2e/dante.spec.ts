import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

// What a writer does first with Dante, on the web version and the Italian sample project:
// open it, write, add a scene, export to Word, look at the board. The sample lives in memory, so every test
// starts from the same project.

async function openSample(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("dante.app-settings", JSON.stringify({ language: "it", userName: "Prova" }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Prova il progetto di esempio" }).click();
  await expect(page.getByRole("tree")).toBeVisible();
}

/** The number in the status bar for the scene with the cursor. */
async function sceneCount(page: Page): Promise<number> {
  const text = await page.locator(".status-bar .item").first().innerText();
  return Number(text.replace(/\D/g, ""));
}

test("opens the sample project on its first scene", async ({ page }) => {
  await openSample(page);
  await expect(page.getByText("I promessi sposi").first()).toBeVisible();
  expect(await page.getByRole("tree").getByRole("treeitem").count()).toBeGreaterThan(5);
  // The manuscript opens on the anonymous author's introduction.
  await expect(page.locator(".cm-content").first()).toContainText("L’historia si può veramente deffinire");
});

test("writes in a scene and counts what was written", async ({ page }) => {
  await openSample(page);
  const editor = page.locator(".cm-content").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+Home");
  await expect(page.locator(".status-bar")).toContainText("caratteri");
  const before = await sceneCount(page);
  await page.keyboard.type("Una frase nuova. ");
  await expect(editor).toContainText("Una frase nuova.");
  await expect.poll(() => sceneCount(page)).toBeGreaterThan(before);
  // The text is saved: it is still there after going to another section and back.
  await page.locator('nav button[data-section="stats"]').click();
  await expect(page.getByRole("heading", { name: "Obiettivi" })).toBeVisible();
  await expect(page.getByText(/Oggi hai scritto \d+ caratteri/)).toBeVisible();
  await page.locator('nav button[data-section="manuscript"]').click();
  await expect(page.locator(".cm-content").filter({ hasText: "Una frase nuova." })).toHaveCount(1);
});

test("adds a new scene from the tree", async ({ page }) => {
  await openSample(page);
  const items = page.getByRole("tree").getByRole("treeitem");
  const count = await items.count();
  await page.getByRole("button", { name: "Nuova scena", exact: true }).first().click();
  await expect(items).toHaveCount(count + 1);
  // A new scene starts from the template, empty, with a hint on how to begin.
  await expect(page.locator(".cm-content:focus")).toBeVisible();
  await page.keyboard.type("Prima riga della scena nuova.");
  await expect(page.locator(".cm-content").filter({ hasText: "Prima riga della scena nuova." })).toHaveCount(1);
});

test("exports the novel to Word", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="export"]').click();
  await page.getByRole("radio", { name: /Word/ }).check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta DOCX" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  const bytes = new Uint8Array(await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks)));
  const zip = unzipSync(bytes);
  const xml = strFromU8(zip["word/document.xml"]);
  expect(xml).toContain("Quel ramo del lago di Como");
  expect(xml).toContain("Capitolo");
});

test("shows the scenes on a board, with a card to change them", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="views"]').click();
  await expect(page.getByRole("heading", { name: "Bacheca" })).toBeVisible();
  await page.getByRole("button", { name: "⚙ Impostazioni" }).click();
  await expect(page.getByRole("region", { name: "Impostazioni" })).toBeVisible();
  await page.getByRole("button", { name: "Il nome", exact: true }).click();
  const card = page.getByRole("region", { name: "Il nome" });
  await expect(card.getByRole("button", { name: "Apri la nota" })).toBeVisible();
  await expect(card.getByRole("textbox").first()).toHaveValue(/Renzo intuisce un mistero/);
});

test("changes theme and page layout from the settings", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="settings"]').click();
  await page.getByRole("tab", { name: "Dante su questo computer" }).click();
  await page.locator("select:has(option[value=sepia])").selectOption("sepia");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sepia");
  await page.getByRole("combobox", { name: /^Rientro/ }).selectOption("1.5");
  await page.getByLabel("Testo giustificato, come in un libro").check();
  await page.locator('nav button[data-section="manuscript"]').click();
  await page.getByRole("treeitem", { name: "La passeggiata" }).getByRole("button").first().click();
  const line = page.locator(".cm-line.md-para").first();
  await expect(line).toHaveCSS("text-indent", "27px");
  await expect(line).toHaveCSS("text-align", "justify");
  expect(await page.locator(".cm-line.md-gap").count()).toBeGreaterThan(0);
});
