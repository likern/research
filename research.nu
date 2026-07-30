# Nushell-only build and inspection layer for the YDMP research workspace.
# Script mode: `nu research.nu <command>`.
# Module mode: `use ./research.nu`, then `research <command>`.

const ROOT = path self .
const CONFIG_PATH = path self research.toml


def config [] {
  if not ($CONFIG_PATH | path exists) {
    error make { msg: $"Missing workspace config: ($CONFIG_PATH)" }
  }
  let value = (open $CONFIG_PATH)
  if $value.schema != 1 {
    error make { msg: $"Unsupported research.toml schema: ($value.schema)" }
  }
  $value
}


def pinned [kind: string] {
  let cfg = (config)
  let relative = if $kind == "nushell" {
    $cfg.toolchain.nushell_version_file
  } else if $kind == "typst" {
    $cfg.toolchain.typst_version_file
  } else {
    error make { msg: $"Unknown toolchain component: ($kind)" }
  }
  let file = ($ROOT | path join $relative)
  if not ($file | path exists) {
    error make { msg: $"Missing version file: ($file)" }
  }
  open --raw $file | str trim
}


def require-nushell [] {
  let required = (pinned nushell)
  if $env.NU_VERSION != $required {
    error make {
      msg: $"Unsupported Nushell: expected ($required), got ($env.NU_VERSION)"
      help: $"Current executable: ($nu.current-exe)"
    }
  }
}


def resolve-typst [] {
  let cfg = (config)
  let required = (pinned typst)
  let override = ($env | get -o RESEARCH_TYPST)
  if $override != null { return ($override | path expand) }

  let binary = if $nu.os-info.name == "windows" { "typst.exe" } else { "typst" }
  let local = ($ROOT | path join $cfg.toolchain.local_tools_root typst $required $binary)
  if ($local | path exists) { return $local }

  let matches = (which typst)
  if ($matches | is-empty) { null } else { $matches.0.path }
}


def typst-version [binary: path] {
  let result = (do { ^$binary --version } | complete)
  if $result.exit_code != 0 { return null }
  let parsed = ($result.stdout | parse --regex '(?i)typst\s+(?<version>[0-9]+\.[0-9]+\.[0-9]+)')
  if ($parsed | is-empty) { null } else { $parsed.0.version }
}


def status-table [] {
  let cfg = (config)
  let typst = (resolve-typst)
  let actual_typst = if $typst == null { null } else { typst-version $typst }
  let required_nu = (pinned nushell)
  let required_typst = (pinned typst)
  let papers_root = ($ROOT | path join $cfg.workspace.papers_root)
  let templates_root = ($ROOT | path join $cfg.workspace.templates_root)

  [
    {
      component: "nushell"
      required: $required_nu
      actual: $env.NU_VERSION
      status: (if $env.NU_VERSION == $required_nu { "ok" } else { "mismatch" })
      path: $nu.current-exe
    }
    {
      component: "typst"
      required: $required_typst
      actual: ($actual_typst | default "not-found")
      status: (if $typst == null { "missing" } else if $actual_typst == $required_typst { "ok" } else { "mismatch" })
      path: ($typst | default "—")
    }
    {
      component: "papers-root"
      required: "present"
      actual: (if ($papers_root | path exists) { "present" } else { "missing" })
      status: (if ($papers_root | path exists) { "ok" } else { "missing" })
      path: $papers_root
    }
    {
      component: "templates-root"
      required: "present"
      actual: (if ($templates_root | path exists) { "present" } else { "missing" })
      status: (if ($templates_root | path exists) { "ok" } else { "missing" })
      path: $templates_root
    }
  ]
}


def require-toolchain [] {
  require-nushell
  let rows = (status-table)
  let failures = ($rows | where status != "ok")
  if not ($failures | is-empty) {
    print $rows
    error make {
      msg: "The pinned research toolchain is unavailable"
      help: "Install the exact versions or set RESEARCH_TYPST."
    }
  }
  resolve-typst
}


def paper-manifests [] {
  let cfg = (config)
  glob ($ROOT | path join $cfg.workspace.papers_root "*" "paper.toml") | sort
}


def read-paper [manifest_path: path] {
  let manifest = (open $manifest_path)
  if $manifest.schema != 1 {
    error make { msg: $"Unsupported paper manifest schema: ($manifest_path)" }
  }
  let directory = ($manifest_path | path dirname)
  let metadata_name = ($manifest | get -o paper.metadata | default "prepare.json")
  let metadata_path = ($directory | path join $metadata_name)
  if not ($metadata_path | path exists) {
    error make { msg: $"Missing paper metadata: ($metadata_path)" }
  }
  let metadata = (open $metadata_path)
  let progress = ($directory | path join "study" "progress.yaml")
  let current_stage = if ($progress | path exists) {
    open $progress | get -o current_stage | default "active"
  } else { "prepared" }
  {
    paper_id: $metadata.paper_id
    title: $metadata.paper.canonical_title
    year: $metadata.paper.publication.year
    stage: $metadata.curriculum.stage.id
    status: $current_stage
    tags: ($manifest | get -o paper.tags | default [])
    path: $directory
    manifest: $manifest
  }
}


def papers [] {
  paper-manifests | each {|file| read-paper $file } | sort-by year title
}


def documents-for-paper [paper: record] {
  ($paper.manifest | get -o documents | default []) | each {|doc|
    let source = ($paper.path | path join $doc.source)
    {
      document_id: $"($paper.paper_id)/($doc.id)"
      owner: "paper"
      paper_id: $paper.paper_id
      paper_title: $paper.title
      name: $doc.id
      source: $source
      source_relative: ($source | path relative-to $ROOT)
      formats: ($doc | get -o formats | default ["pdf"])
      categories: ([$paper.stage] | append $paper.tags | append ($doc | get -o categories | default []) | uniq)
      inputs: ($doc | get -o inputs | default {})
      required: ($doc | get -o required | default true)
      exists: ($source | path exists)
    }
  }
}


def workspace-documents [] {
  ((config) | get -o documents | default []) | each {|doc|
    let source = ($ROOT | path join $doc.source)
    {
      document_id: $doc.id
      owner: "workspace"
      paper_id: null
      paper_title: null
      name: $doc.id
      source: $source
      source_relative: $doc.source
      formats: ($doc | get -o formats | default ["pdf"])
      categories: ($doc | get -o categories | default ["workspace"])
      inputs: ($doc | get -o inputs | default {})
      required: ($doc | get -o required | default true)
      exists: ($source | path exists)
    }
  }
}


def documents [] {
  let per_paper = (papers | each {|paper| documents-for-paper $paper } | flatten)
  $per_paper | append (workspace-documents) | sort-by document_id
}


def find-paper [paper_id: string] {
  let found = (papers | where paper_id == $paper_id)
  if ($found | is-empty) {
    error make { msg: $"Unknown paper: ($paper_id)" }
  }
  $found.0
}


def find-document [document_id: string] {
  let found = (documents | where document_id == $document_id)
  if ($found | is-empty) {
    error make { msg: $"Unknown document: ($document_id)" }
  }
  $found.0
}


def output-path [doc: record, format: string, root: path] {
  if $doc.owner == "paper" {
    $root | path join $format "papers" $doc.paper_id $"($doc.name).($format)"
  } else {
    $root | path join $format "workspace" $"($doc.name).($format)"
  }
}


def compile-one [doc: record, format: string, out_root: path, typst: path, variant] {
  let cfg = (config)
  if not $doc.exists {
    return { document_id: $doc.document_id, format: $format, status: "missing-source", output: null, stderr: $doc.source }
  }
  if not ($format in $doc.formats) {
    return { document_id: $doc.document_id, format: $format, status: "unsupported-format", output: null, stderr: ($doc.formats | str join ", ") }
  }
  if $format == "html" and not $cfg.typst.html_enabled {
    return { document_id: $doc.document_id, format: $format, status: "html-disabled", output: null, stderr: "HTML is disabled in research.toml" }
  }

  let output = (output-path $doc $format $out_root)
  mkdir ($output | path dirname)
  let selected_variant = if $variant == null { $cfg.typst.default_variant } else { $variant }
  let all_inputs = ({ variant: $selected_variant } | merge $doc.inputs)
  let input_args = ($all_inputs | transpose key value | each {|x| ["--input" $"($x.key)=($x.value)"] } | flatten)
  mut args = ["compile" "--root" $ROOT]
  if $format == "html" { $args = ($args | append ["--features" "html" "--format" "html"]) }
  $args = ($args | append $input_args | append [$doc.source $output])
  let result = (do { ^$typst ...$args } | complete)
  {
    document_id: $doc.document_id
    format: $format
    status: (if $result.exit_code == 0 { "ok" } else { "failed" })
    output: $output
    stderr: ($result.stderr | str trim)
  }
}


def build-many [selected: table, format, variant, out_root] {
  let cfg = (config)
  let typst = (require-toolchain)
  let root = if $out_root == null { $ROOT | path join $cfg.workspace.build_root } else { $out_root }
  let results = ($selected | each {|doc|
    let wanted = if $format == null { $doc.formats } else { [$format] }
    $wanted | each {|fmt| compile-one $doc $fmt $root $typst $variant }
  } | flatten)
  let failed = ($results | where status != "ok")
  if not ($failed | is-empty) {
    print $results
    error make { msg: $"Build failed for ($failed | length) artifact(s)" }
  }
  $results
}


def complete-paper [] {
  papers | each {|x| { value: $x.paper_id, description: $"($x.year) — ($x.title)" } }
}


def complete-document [] {
  documents | each {|x| { value: $x.document_id, description: $x.source_relative } }
}


def complete-category [] {
  documents | each {|x| $x.categories } | flatten | uniq | sort
}


def complete-paper-doc [] {
  documents | where owner == "paper" | get name | uniq | sort | prepend "all"
}


def complete-format [] { ["pdf" "html"] }
def complete-variant [] { (config).typst.variants }


# Show the command families when invoked without a subcommand.
export def main [] {
  ["doctor" "version" "list papers" "list documents" "list categories" "show paper" "build paper" "build document" "build category" "build all" "check" "watch" "clean"]
}


# Check pinned tool versions and required workspace directories.
export def doctor [] {
  let rows = (status-table)
  let failed = ($rows | where status != "ok")
  if not ($failed | is-empty) {
    print $rows
    error make { msg: $"Doctor found ($failed | length) problem(s)" }
  }
  $rows
}


# Show required and actual tool versions.
export def version [] {
  let typst = (resolve-typst)
  {
    nushell_required: (pinned nushell)
    nushell_actual: $env.NU_VERSION
    nushell_executable: $nu.current-exe
    typst_required: (pinned typst)
    typst_actual: (if $typst == null { null } else { typst-version $typst })
    typst_executable: $typst
  }
}


# List registered papers.
export def "list papers" [] {
  require-nushell
  papers | select paper_id title year stage status tags
}


# List all registered Typst entrypoints.
export def "list documents" [] {
  require-nushell
  documents | select document_id owner paper_id source_relative formats categories required exists
}


# List derived curriculum stages and document categories.
export def "list categories" [] {
  require-nushell
  documents
  | each {|doc| $doc.categories | each {|category| { category: $category, document_id: $doc.document_id, paper_id: $doc.paper_id } } }
  | flatten
  | group-by category
  | transpose category rows
  | each {|group| {
      category: $group.category
      document_count: ($group.rows | length)
      paper_count: ($group.rows.paper_id | compact | uniq | length)
    } }
  | sort-by category
}


# Show one paper and its build entrypoints.
export def "show paper" [paper_id: string@complete-paper] {
  require-nushell
  let paper = (find-paper $paper_id)
  $paper | reject manifest | merge { documents: (documents-for-paper $paper) }
}


# Build one or all documents belonging to a paper.
export def "build paper" [
  paper_id: string@complete-paper
  --document(-d): string@complete-paper-doc = "all"
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  require-nushell
  let available = (documents-for-paper (find-paper $paper_id))
  let selected = if $document == "all" { $available } else { $available | where name == $document }
  if ($selected | is-empty) { error make { msg: $"Paper has no document named ($document)" } }
  build-many $selected $format $variant null
}


# Build one globally identified document.
export def "build document" [
  document_id: string@complete-document
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  require-nushell
  build-many [(find-document $document_id)] $format $variant null
}


# Build all documents in a curriculum stage or category.
export def "build category" [
  category: string@complete-category
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  require-nushell
  let selected = (documents | where {|doc| $category in $doc.categories })
  if ($selected | is-empty) { error make { msg: $"Unknown or empty category: ($category)" } }
  build-many $selected $format $variant null
}


# Build every registered document.
export def "build all" [
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  require-nushell
  build-many (documents) $format $variant null
}


# Compile every registered document in temporary storage.
export def check [--keep] {
  require-nushell
  let missing = (documents | where exists == false)
  if not ($missing | is-empty) {
    print $missing
    error make { msg: $"Missing ($missing | length) registered source(s)" }
  }
  let build_root = ($ROOT | path join (config).workspace.build_root "check")
  let temp_root = if $keep { $build_root } else { $nu.temp-dir | path join $"likern-research-((random uuid))" }
  if ($temp_root | path exists) { rm --recursive --force $temp_root }
  mkdir $temp_root
  try {
    let result = (build-many (documents) null null $temp_root)
    if not $keep { rm --recursive --force $temp_root }
    $result
  } catch {|err|
    if not $keep and ($temp_root | path exists) { rm --recursive --force $temp_root }
    error make { msg: ($err.msg | default "Research check failed") }
  }
}


# Rebuild one document whenever its dependencies change.
export def watch [
  document_id: string@complete-document
  --format(-f): string@complete-format = "pdf"
  --variant(-v): string@complete-variant
] {
  require-nushell
  let cfg = (config)
  let typst = (require-toolchain)
  let doc = (find-document $document_id)
  if not ($format in $doc.formats) { error make { msg: $"Unsupported format ($format)" } }
  if $format == "html" and not $cfg.typst.html_enabled { error make { msg: "HTML is disabled" } }
  let output = (output-path $doc $format ($ROOT | path join $cfg.workspace.build_root))
  mkdir ($output | path dirname)
  let selected_variant = if $variant == null { $cfg.typst.default_variant } else { $variant }
  let all_inputs = ({ variant: $selected_variant } | merge $doc.inputs)
  let input_args = ($all_inputs | transpose key value | each {|x| ["--input" $"($x.key)=($x.value)"] } | flatten)
  mut args = ["watch" "--root" $ROOT]
  if $format == "html" { $args = ($args | append ["--features" "html" "--format" "html"]) }
  $args = ($args | append $input_args | append [$doc.source $output])
  ^$typst ...$args
}


# Remove generated local build artifacts only.
export def clean [] {
  require-nushell
  let dir = ($ROOT | path join (config).workspace.build_root)
  if ($dir | path exists) { rm --recursive --force $dir }
}


# Script-mode subcommands. Module users receive the same commands under the
# `research` module namespace and get custom completions.
def "main doctor" [] { doctor }
def "main version" [] { version }
def "main list papers" [] { list papers }
def "main list documents" [] { list documents }
def "main list categories" [] { list categories }
def "main show paper" [paper_id: string@complete-paper] { show paper $paper_id }

def "main build paper" [
  paper_id: string@complete-paper
  --document(-d): string@complete-paper-doc = "all"
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  if $format == null and $variant == null { build paper $paper_id --document $document }
  else if $variant == null { build paper $paper_id --document $document --format $format }
  else if $format == null { build paper $paper_id --document $document --variant $variant }
  else { build paper $paper_id --document $document --format $format --variant $variant }
}

def "main build document" [
  document_id: string@complete-document
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  if $format == null and $variant == null { build document $document_id }
  else if $variant == null { build document $document_id --format $format }
  else if $format == null { build document $document_id --variant $variant }
  else { build document $document_id --format $format --variant $variant }
}

def "main build category" [
  category: string@complete-category
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
] {
  if $format == null and $variant == null { build category $category }
  else if $variant == null { build category $category --format $format }
  else if $format == null { build category $category --variant $variant }
  else { build category $category --format $format --variant $variant }
}

def "main build all" [--format(-f): string@complete-format --variant(-v): string@complete-variant] {
  if $format == null and $variant == null { build all }
  else if $variant == null { build all --format $format }
  else if $format == null { build all --variant $variant }
  else { build all --format $format --variant $variant }
}

def "main check" [--keep] { if $keep { check --keep } else { check } }

def "main watch" [document_id: string@complete-document --format(-f): string@complete-format = "pdf" --variant(-v): string@complete-variant] {
  if $variant == null { watch $document_id --format $format }
  else { watch $document_id --format $format --variant $variant }
}

def "main clean" [] { clean }
