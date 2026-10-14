import { MemoryFs } from "./core/fs";

/** A small novel to try the app without a folder, for example in a browser. */
export function sampleProject(): MemoryFs {
  return new MemoryFs({
    "dante.yaml": "title: The Inheritance\nauthor: Sample Author\nlanguage: en\nstructure:\n  parts: true\n",
    "Codex/Characters/Marta Rinaldi.md":
      "---\ntype: character\nrole: protagonist\nage: 42\naliases: [Marta]\n---\nMarta returns home after twenty years. She grew up in [[Rinaldi House]] with her mother, [[Elena Rinaldi|Elena]].\n",
    "Codex/Characters/Elena Rinaldi.md":
      "---\ntype: character\nrole: mother\naliases: [Elena]\n---\nDied in the winter before the story begins. Her letter sets everything in motion.\n",
    "Codex/Places/Rinaldi House.md": "---\ntype: place\nregion: Liguria\n---\nA stone house above the harbour. See [[Harbours of Liguria]].\n",
    "Codex/Plotlines/The inheritance.md": "---\ntype: plotline\nstatus: open\n---\nWho gets the house, and why Elena wrote the letter.\n",
    "Templates/Character.md": "---\nrole:\nage:\naliases: []\n---\n## Who {{title}} is\n\n## What {{title}} wants\n",
    "Manuscript/000 Prologue/000 Prologue.md": "---\nkind: prologue\n---\n",
    "Manuscript/000 Prologue/010 The call.md":
      "---\nstatus: draft\npov: \"[[Marta Rinaldi|Marta]]\"\n---\nThe phone rang at three in the morning. *Nobody* calls at three in the morning with good news.\n",
    "Manuscript/010 Homecoming/010 Homecoming.md": "---\nkind: part\n---\n",
    "Manuscript/010 Homecoming/010 Return/010 Arrival.md":
      "---\nstatus: revised\npov: \"[[Marta Rinaldi|Marta]]\"\nplace: \"[[Rinaldi House]]\"\n---\nThe train arrived forty minutes late. Marta stepped down onto the platform and breathed the salt air she had tried to forget.\n\nNo one was waiting for her. She had expected that, and still it hurt.\n",
    "Manuscript/010 Homecoming/010 Return/020 The house.md":
      "---\nstatus: draft\n---\nThe key still turned in the lock. **Twenty years**, and the key still turned.\n",
    "Manuscript/010 Homecoming/020 Letter/010 Envelope.md":
      "---\nstatus: idea\n---\nThe envelope was on the kitchen table, addressed to her in her mother's hand.\n",
    "Manuscript/900 Epilogue/900 Epilogue.md": "---\nkind: epilogue\n---\n",
    "Manuscript/900 Epilogue/010 Harbour.md": "The boats came back at dawn.\n",
    "Research/Harbours of Liguria.md": "Notes on fishing harbours. The boats leave at four and come back at dawn.\n",
    "Research/Images/Harbour sketch.svg":
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220"><rect width="400" height="220" fill="#dfe9f2"/><rect y="150" width="400" height="70" fill="#4b7aa6"/><path d="M60 150 L120 150 L110 165 L70 165 Z" fill="#7a4b2a"/><line x1="90" y1="150" x2="90" y2="100" stroke="#333" stroke-width="3"/><path d="M92 102 L130 140 L92 140 Z" fill="#fff"/><circle cx="330" cy="50" r="24" fill="#f2c94c"/></svg>',
    "Research/Saved page.html":
      "<!doctype html><html><body style=\"font-family: Georgia; padding: 24px\"><h1>Fishing in Liguria</h1><p>A page saved from the web. Its scripts do not run in Dante.</p><script>document.body.innerHTML = 'scripts ran';</script></body></html>",
    "Research/Timeline.csv": "year,event\n1967,Elena buys the house\n1987,Marta leaves\n2007,Elena dies\n",
    "Laboratory/Outline.md":
      "## Part one\n\n1. [[Marta Rinaldi|Marta]] comes back for the funeral.\n2. She finds the letter in [[Rinaldi House]].\n3. [[The inheritance]] begins.\n\n- [ ] Decide who wrote the second letter\n- [x] Name the harbour town\n",
  });
}
