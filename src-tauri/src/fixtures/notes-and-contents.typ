// Made by Dante from the manuscript of "Test". Edit the novel, not this file.
#set document(title: "Test", author: ())
#set page(width: 21cm, height: 29.7cm, margin: 2.54cm, header: none, footer: none)
#set text(font: ("Times New Roman", "Libertinus Serif", "New Computer Modern"), size: 12pt, lang: "it", hyphenate: false, top-edge: "ascender", bottom-edge: "descender")
#set par(justify: false, leading: 1.2em, spacing: 1.2em, first-line-indent: 1.27cm)
#set smartquote(enabled: false)
#show heading: it => {
  set align(center)
  set par(first-line-indent: 0pt, justify: false)
  let sizes = (1em, 1em, 1em, 1em, 1em, 1em)
  set text(size: sizes.at(calc.min(it.level, 6) - 1), weight: if it.level <= 1 or false and it.level == 2 { "bold" } else { "regular" }, style: if it.level > 1 and false { "italic" } else { "normal" })
  block(above: 2.2em, below: 2.2em, it.body)
}
#let separator(body) = align(center, block(above: 1.8em, below: 1.8em, body))

#grid(columns: (1fr, 1fr), "", align(right, "10 parole"))
#v(7.6cm)
#align(center)[#"TEST"]
#align(center)[#v(1em)#""]
#pagebreak()
#v(5cm)
#outline(title: [#"Indice"], depth: 1)

#set page(header: align(right, " / TEST / " + context counter(page).display()), footer: none)
#v(5cm)
#heading(level: 1)[#"Capitolo 1: Uno"]
#"Arrivò a Bari"#footnote[#"Allora "#emph("Barium")#"."]#" di sera."#footnote[#"Seconda nota."]

#pagebreak(weak: true)
#v(5cm)
#heading(level: 1)[#"Capitolo 2: Due"]
#"Altro."

