// Made by Dante from the manuscript of "Test". Edit the novel, not this file.
#set document(title: "Test", author: ())
#set page(width: 14.8cm, height: 21cm, margin: (top: 3cm, bottom: 2cm, left: 1.5cm, right: 2cm), header: none, footer: none)
#set text(font: ("Times New Roman", "Libertinus Serif", "New Computer Modern"), size: 11pt, lang: "it", hyphenate: true, top-edge: "ascender", bottom-edge: "descender")
#set par(justify: true, leading: 0.36em, spacing: 0.36em, first-line-indent: 1.27cm)
#set smartquote(enabled: false)
#show heading: it => {
  set par(first-line-indent: 0pt, justify: false)
  if it.level == 1 { set align(center); set par(leading: 0.36em); set text(size: 16.5pt, weight: "bold", style: "normal"); block(above: 3.96pt, below: 19.96pt, it.body) } else if it.level == 2 { set align(right); set par(leading: 0em); set text(font: ("Georgia", "Libertinus Serif", "New Computer Modern"), size: 20pt, weight: "bold", style: "italic"); block(above: 33.96pt, below: 21.96pt, upper(it.body)) } else if it.level == 3 { set align(left); set par(leading: 0.36em); set text(size: 11pt, weight: "bold", style: "italic"); block(above: 19.96pt, below: 11.96pt, it.body) } else {
    set align(center)
    let sizes = (1.5em, 1.3em, 1em, 1em, 1em, 1em)
    set text(size: sizes.at(calc.min(it.level, 6) - 1), weight: if it.level <= 2 or true and it.level == 2 { "bold" } else { "regular" }, style: if it.level > 2 and true { "italic" } else { "normal" })
    block(above: 1.36em, below: 1.36em, it.body)
  }
}
#let separator(body) = align(center, block(above: 0.96em, below: 0.96em, body))


#set page(header: align(center, text(size: 0.85em, style: "italic", "Test")), footer: align(center, text(size: 0.85em, context counter(page).display())))
#counter(page).update(1)
#v(6.3cm)
#heading(level: 1)[#"Parte I: Il ritorno"]
#pagebreak(weak: true)
#v(3cm)
#heading(level: 2)[#"Capitolo 1: La lettera"]
#heading(level: 3)[#"1. Alla stazione"]
#"Il treno arrivò."

#separator[#"#"]
#heading(level: 3)[#"2. Il treno delle sei"]
#"Nessuno scese."

#separator[#"#"]
#heading(level: 3)[#"3. Il ritorno"]
