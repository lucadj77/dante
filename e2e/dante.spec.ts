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
  await page.locator('[data-settings="appearance"]').click();
  await page.getByRole("radio", { name: "Seppia" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sepia");
  await page.locator('[data-settings="text"]').click();
  await page.getByRole("combobox", { name: /^Rientro/ }).selectOption("1.5");
  await page.getByLabel("Testo giustificato, come in un libro").check();
  await page.locator('nav button[data-section="manuscript"]').click();
  await page.getByRole("treeitem", { name: "La passeggiata" }).getByRole("button").first().click();
  const line = page.locator(".cm-line.md-para").first();
  await expect(line).toHaveCSS("text-indent", "27px");
  await expect(line).toHaveCSS("text-align", "justify");
  // The empty lines between paragraphs are not shown: the paragraph after one has the space above it.
  expect(await page.locator(".cm-line.md-after-gap").count()).toBeGreaterThan(0);
  expect(await page.locator(".cm-line.md-gap").count()).toBe(0);
});

test("finds a settings page by a word, and gives the novel a look of its own", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="settings"]').click();
  // The search leaves only the pages that hold the word, and shows the first.
  await page.getByRole("searchbox", { name: "Cerca nelle impostazioni" }).fill("interlinea");
  await expect(page.locator("[data-settings]")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Il testo nell'editor");
  await page.getByRole("searchbox", { name: "Cerca nelle impostazioni" }).fill("");
  // The novel's own look applies while it is open, and leaves the computer's as it was.
  await page.locator('[data-settings="look"]').click();
  await page.getByLabel("Usa un aspetto diverso per questo romanzo").check();
  await page.getByRole("radio", { name: /Notte/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "night");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("dante.app-settings")!).theme)).not.toBe("night");
  await page.locator('nav button[data-section="close"], nav button[title^="Chiudi progetto"]').first().click();
  await expect(page.locator("html")).not.toHaveAttribute("data-palette", "night");
  await page.getByText("Prova il progetto di esempio").click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "night");
  await page.locator('nav button[data-section="settings"]').click();
  await page.locator('[data-settings="look"]').click();
  await page.getByLabel("Usa un aspetto diverso per questo romanzo").uncheck();
  await expect(page.locator("html")).not.toHaveAttribute("data-palette", "night");
});

test("names the stage under each scene's dot, or the property chosen for it", async ({ page }) => {
  await openSample(page);
  await page.locator(".row .status").first().hover();
  await expect(page.getByRole("tooltip")).toHaveText("Stato: finita");
  await page.locator('nav button[data-section="settings"]').click();
  await page.locator('[data-settings="scenes"]').click();
  await page.getByLabel("Il pallino accanto a ogni scena mostra").selectOption("pov");
  await page.locator('nav button[data-section="manuscript"]').click();
  const dot = page.locator(".row", { hasText: "La passeggiata" }).locator(".status");
  await expect(dot).toHaveAttribute("data-hue", "0");
  await dot.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Pov: Don Abbondio");
});

test("goes from the statistics to the very passage", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="stats"]').click();
  const repetition = page.locator("ul.examples").first().locator("li").first();
  const excerpt = (await repetition.locator(".excerpt").innerText()).replace(/^«|»$/g, "");
  await repetition.locator("button.link").click();
  await expect.poll(() => page.evaluate(() => String(getSelection()).replace(/\s+/g, " "))).toBe(excerpt);
  await page.locator('nav button[data-section="stats"]').click();
  const sentence = page.locator("ul.examples").nth(1).locator("li").first();
  const start = (await sentence.locator(".excerpt").innerText()).slice(0, 60);
  await sentence.locator("button.link").click();
  await expect.poll(() => page.evaluate(() => String(getSelection()).replace(/\s+/g, " "))).toMatch(new RegExp(`^${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*[.!?…»”]$`));
});

test("opens the exported book with a cover made from a picture of the writer's", async ({ page }) => {
  await openSample(page);
  await page.locator('nav button[data-section="settings"]').click();
  await page.locator('[data-settings="cover"]').click();
  // A red square as the picture: the cover drawn from it is red where the texts are not.
  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 60;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 40, 60);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('.cover-picker input[type="file"]').setInputFiles({ name: "copertina.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.locator(".cover-picker")).toContainText("copertina.png");
  await page.locator('nav button[data-section="export"]').click();
  await page.getByRole("radio", { name: /Word/ }).check();
  await page.getByRole("checkbox", { name: "Apri il libro con la copertina" }).check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta DOCX" }).click();
  const file = await download;
  const bytes = new Uint8Array(await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks)));
  const zip = unzipSync(bytes);
  const media = Object.keys(zip).filter((name) => name.startsWith("word/media/") && name.endsWith(".png"));
  expect(media.length).toBeGreaterThan(0);
  // The corner of the cover is the picture's red.
  const corner = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [...context.getImageData(5, canvas.height - 5, 1, 1).data];
  }, Buffer.from(zip[media[0]]).toString("base64"));
  expect(corner.slice(0, 3)).toEqual([255, 0, 0]);
});

test("moves a scene to the Laboratory and copies it back into a chapter", async ({ page }) => {
  await openSample(page);
  const tree = page.getByRole("tree");
  const scene = tree.locator(".row.scene").nth(1);
  const title = (await scene.locator(".label").innerText()).trim();
  await scene.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Sposta in…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Laboratorio" }).click();
  await dialog.getByRole("option", { name: "Laboratorio" }).click();
  await dialog.getByRole("button", { name: "Sposta", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(tree.getByText(title, { exact: true })).toHaveCount(0);

  // In Notes, the scene is a note of the Laboratory: a copy goes back at the start of the first chapter.
  await page.locator('nav button[data-section="notes"]').click();
  const note = page.locator(".file-tree .row").filter({ hasText: title });
  await expect(note).toBeVisible();
  await note.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copia in…" }).click();
  await dialog.getByRole("tab", { name: "Manoscritto" }).click();
  await dialog.getByRole("searchbox").fill("bravi");
  await dialog.getByRole("option").nth(1).click();
  await dialog.getByRole("radio", { name: "Dentro, all'inizio" }).check();
  await dialog.getByRole("button", { name: "Copia", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(note).toBeVisible();
  await page.locator('nav button[data-section="manuscript"]').click();
  await expect(tree.getByText(title, { exact: true })).toHaveCount(1);
});

test("moves a scene several places with the keyboard, without clicking it again", async ({ page }) => {
  await openSample(page);
  // A chapter with at least three scenes: the first of them goes down twice.
  const chapter = page.locator('li[role="treeitem"]').filter({ has: page.locator(":scope > ul > li:nth-child(3) > .row.scene") }).first();
  const scenes = chapter.locator(":scope > ul > li > .row.scene .label");
  const first = await scenes.nth(0).innerText();
  await chapter.locator(":scope > ul > li > .row.scene").first().click();
  await page.keyboard.press("ControlOrMeta+Alt+ArrowDown");
  await expect(scenes.nth(1)).toHaveText(first);
  await page.keyboard.press("ControlOrMeta+Alt+ArrowDown");
  await expect(scenes.nth(2)).toHaveText(first);
  await page.keyboard.press("ControlOrMeta+Alt+ArrowUp");
  await expect(scenes.nth(1)).toHaveText(first);
});

test("closes a dialog with Esc straight after opening it, and keeps Tab inside", async ({ page }) => {
  await openSample(page);
  const trash = page.getByRole("button", { name: "Cestino", exact: true });
  await trash.click();
  const dialog = page.getByRole("dialog", { name: "Cestino" });
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trash).toBeFocused();
});

test("takes back a scene moved by mistake", async ({ page }) => {
  await openSample(page);
  const rows = page.getByRole("tree").getByRole("treeitem");
  const before = await rows.allInnerTexts();
  await page.getByRole("treeitem", { name: "La passeggiata" }).click();
  await page.keyboard.press("ControlOrMeta+Alt+ArrowDown");
  await expect.poll(() => rows.allInnerTexts()).not.toEqual(before);
  await expect(page.getByRole("status").filter({ hasText: "Spostamento fatto." })).toBeVisible();
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect.poll(() => rows.allInnerTexts()).toEqual(before);
  await expect(page.getByRole("status").filter({ hasText: "Spostamento fatto." })).toBeHidden();
});

test("sets a property on several scenes at once", async ({ page }) => {
  await openSample(page);
  await page.getByRole("treeitem", { name: "Il nome" }).click();
  await page.getByRole("treeitem", { name: "Lucia" }).click({ modifiers: ["ControlOrMeta"] });
  await page.getByRole("treeitem", { name: "Lucia" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Imposta una proprietà alle 2 scene…" }).click();
  const dialog = page.getByRole("dialog", { name: "Una proprietà per 2 scene" });
  await dialog.getByRole("combobox", { name: "Proprietà", exact: true }).selectOption("stato");
  await dialog.getByRole("combobox", { name: "stato", exact: true }).selectOption("rivista");
  await dialog.getByRole("button", { name: "Applica a 2 scene" }).click();
  await expect(dialog).toBeHidden();
  for (const scene of ["Il nome", "Lucia"]) {
    await page.getByRole("treeitem", { name: scene }).click();
    await expect(page.locator("aside.side").getByLabel("stato", { exact: true })).toHaveValue("rivista");
  }
});
