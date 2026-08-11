// Semantic HTML adapter for Pinega dual-target publications.
//
// This adapter deliberately emits structure only. Pinega Strata CSS remains
// owned by the Web shell and the build pipeline extracts the single article.

#let publication-html(
  id: none,
  lang: "en",
  title: "Untitled publication",
  subtitle: none,
  authors: (),
  published-at: none,
  body,
) = {
  let title-id = "publication-title"
  let author-line = if authors.len() == 0 { "Pinega Labs" } else { authors.join(", ") }
  let labels = if lang == "ru" {
    (
      kicker: "Исследовательская публикация Pinega",
      authors: "Авторы",
      published: "Опубликовано",
      profile: "Профиль",
      profile-name: "Двухцелевая проверочная публикация",
    )
  } else {
    (
      kicker: "Pinega Research Publication",
      authors: "Authors",
      published: "Published",
      profile: "Profile",
      profile-name: "Dual-target validation specimen",
    )
  }

  html.elem(
    "article",
    attrs: (
      "class": "pinega-publication-article",
      "data-pinega-publication-id": id,
      "data-pinega-publication-profile": "dual-target",
      "data-pinega-publication-locale": lang,
      "aria-labelledby": title-id,
    ),
  )[
    #html.elem("header", attrs: ("class": "pinega-publication-masthead"))[
      #html.elem("p", attrs: ("class": "pinega-publication-kicker"))[#labels.kicker]
      #html.elem("h1", attrs: ("id": title-id))[#title]
      #if subtitle != none {
        html.elem("p", attrs: ("class": "pinega-publication-subtitle"))[#subtitle]
      }
      #html.elem("dl", attrs: ("class": "pinega-publication-metadata"))[
        #html.elem("div")[
          #html.elem("dt")[#labels.authors]
          #html.elem("dd")[#author-line]
        ]
        #if published-at != none {
          html.elem("div")[
            #html.elem("dt")[#labels.published]
            #html.elem("dd")[#html.elem("time", attrs: ("datetime": published-at))[#published-at]]
          ]
        }
        #html.elem("div")[
          #html.elem("dt")[#labels.profile]
          #html.elem("dd")[#labels.profile-name]
        ]
      ]
    ]
    #html.elem("div", attrs: ("class": "pinega-publication-body"))[#body]
  ]
}
