#import "template.typ": paper_notes, my_thought, evidence

#let variant = sys.inputs.at("variant", default: "candidate-c")

#show: paper_notes.with(
  title: "Формальный перевод с авторскими заметками",
  subtitle: "Демонстрация элемента my_thought и глобального переключателя",
  authors: ("Maurice P. Herlihy", "Jeannette M. Wing"),
  paper_id: "herlihy-wing-1990-linearizability",
  doi: "10.1145/78969.78972",
  stage: "ANNOTATE / READ-2",
  variant: variant,
)

= 1. Истории и операции

*Формальный перевод.* History $H$ представляет собой конечную
последовательность invocation- и response-событий. Operation считается
*pending*, если её invocation присутствует в $H$, но соответствующий response
отсутствует.

#my_thought(kind: "main-idea", variant: variant)[
  Авторы намеренно моделируют вызов и ответ как разные события. Благодаря этому
  перекрывающиеся операции не выглядят заранее атомарными: точку их логического
  выполнения ещё предстоит обосновать.
]

Для process $P$ запись $H|P$ обозначает process subhistory — подпоследовательность
всех событий $H$, относящихся к $P$. Аналогично, $H|x$ является projection
истории на object $x$.

#my_thought(kind: "formal-link", variant: variant)[
  Эта projection-нотация позже входит непосредственно в определение equivalence:
  две истории эквивалентны тогда, когда каждый process наблюдает одну и ту же
  собственную последовательность событий.

  Формально:
  $ H equiv S iff forall P: H|P = S|P. $
]

= 2. Определение linearizability

*Черновой формальный перевод.* History $H$ является linearizable, если её можно
расширить до некоторой history $H'$ добавлением response-событий к части pending
invocations так, что $complete(H')$ эквивалентна некоторой legal sequential
history $S$, а real-time precedence в $H$ сохраняется в $S$.

$ exists H', S: H subset.eq H' and complete(H') equiv S and <_H subset.eq <_S $

#my_thought(kind: "causal-chain", variant: variant)[
  Здесь есть три независимые обязанности:

  1. *Completion:* разобраться с незавершёнными вызовами;
  2. *Legality:* получить поведение, разрешённое sequential specification;
  3. *Real time:* не переставить местами операции, порядок которых уже наблюдаем.

  Если убрать второй пункт, можно получить последовательную, но недопустимую
  историю. Если убрать третий — условие станет похоже на sequential consistency.
]

#my_thought(kind: "default", variant: variant)[
  Я пока читаю existential quantifier как разрешение выбрать один из нескольких
  допустимых порядков перекрывающихся операций. Это не утверждение, что такой
  порядок физически существовал внутри implementation.
]

= 3. Свой пример

Пусть register первоначально хранит $0$. Operation $write(1)$ завершилась до
начала $read()$, а read вернула $0$. Такая история не может быть linearized:
real-time order требует поместить write раньше read, но sequential specification
тогда требует вернуть $1$.

#my_thought(kind: "example", variant: variant)[
  Для перекрывающихся operations ситуация иная. Если $write(1)$ и $read()$
  перекрываются, read может вернуть и $0$, и $1$, поскольку обе sequential
  интерпретации потенциально совместимы с real-time order.

  Небольшая таблица допустимых объяснений:

  #table(
    columns: (1fr, 1fr),
    inset: 0.35em,
    [*Return*], [*Candidate order*],
    [$0$], [$read; write$],
    [$1$], [$write; read$],
  )
]

= 4. Теорема о locality

*Формальный перевод.* History $H$ является linearizable тогда и только тогда,
когда для каждого object $x$ object subhistory $H|x$ является linearizable.

#my_thought(kind: "main-idea", variant: variant)[
  Практический смысл locality: proof можно декомпозировать по abstract objects,
  а затем собрать локальные linearizations в одну global history. Но это работает
  только после корректного выбора object boundaries.
]

#my_thought(kind: "uncertainty", variant: variant)[
  Мне пока не очевиден ключевой шаг обратного направления theorem: почему
  независимо выбранные per-object sequential histories всегда можно объединить,
  не создав cycle между process order и real-time edges?

  Нужно отдельно восстановить construction из proof и проверить, где именно
  используется well-formedness histories.
]

= 5. Смешанный сложный блок

Следующая заметка специально проверяет, что body является полноценным `content`,
а не строкой.

#my_thought(
  kind: "formal-link",
  title: "Моя рабочая реконструкция proof obligation",
  variant: variant,
)[
  Рассмотрим directed relation
  $ R = (union_x <_(S_x)) union (union_P <_(H|P)) union <_H. $

  Требуется показать, что $R$ acyclic, после чего взять topological extension.

  - object edges происходят из выбранных legal linearizations $S_x$;
  - process edges сохраняют equivalence;
  - real-time edges обеспечивают externally observed order.

  #evidence("HYPOTHESIS", variant: variant)[
    Возможно, минимальный cycle можно свести к противоречию с одной из локальных
    linearizations. Это нужно проверить по доказательству, а не принимать как
    установленный факт.
  ]
]

= 6. Управление выводом

По умолчанию заметки видны. Чистый строгий PDF без learner annotations:

```text
 typst compile thoughts-example.typ clean.pdf \
   --input variant=candidate-c \
   --input show-thoughts=false
```

Поскольку отключённый `my_thought` возвращает `none`, блоки удаляются полностью
и не оставляют пустого места в layout.
