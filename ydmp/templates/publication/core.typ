// Pinega dual-target publication entrypoint.

#import "html.typ": publication-html
#import "paged.typ": publication-paged
#import "components.typ": *

#let publication(
  id: none,
  lang: "en",
  title: "Untitled publication",
  subtitle: none,
  authors: (),
  published-at: none,
  body,
) = context {
  set heading(numbering: "1.1")
  if target() == "html" {
    set text(lang: lang)
    publication-html(
      id: id,
      lang: lang,
      title: title,
      subtitle: subtitle,
      authors: authors,
      published-at: published-at,
      body,
    )
  } else {
    publication-paged(
      id: id,
      lang: lang,
      title: title,
      subtitle: subtitle,
      authors: authors,
      published-at: published-at,
      body,
    )
  }
}
