import { MemoryFs } from "./core/fs";

/** A small novel to try the app without a folder, for example in a browser. */
export function sampleProject(): MemoryFs {
  return new MemoryFs({
    "dante.yaml": "title: The Inheritance\nauthor: Sample Author\nlanguage: en\nstructure:\n  parts: true\n",
    "Codex/Characters/Marta Rinaldi.md": "---\ntype: character\nrole: protagonist\n---\nMarta returns home after twenty years.\n",
    "Codex/Places/Rinaldi House.md": "---\ntype: place\n---\nA stone house above the harbour.\n",
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
    "Research/Harbours of Liguria.md": "Notes on fishing harbours.\n",
  });
}
