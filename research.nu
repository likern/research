# Nushell-only build and inspection layer for the YDMP research workspace.
#
# Script mode:
#   nu research.nu doctor
#   nu research.nu list papers
#   nu research.nu build paper <paper-id>
#
# Interactive module mode with custom completions:
#   use ./research.nu
#   research build paper <TAB>

const ROOT = path self .
const CONFIG_PATH = path self research.toml


def read-version-file [relative_path: string]: nothing -> string {
  let path = ($ROOT | path join $relative_path)
  if not ($path | path exists) {
    error make {
      msg: $"Missing toolchain version file: ($relative_path)"
      help: $"Expected it at ($path)"
    }
  }
  open --raw $path | str trim
}


def workspace-config []: nothing -> record {
  if not ($CONFIG_PATH | path exists) {
    error make {
      msg: "Missing research.toml"
      help: $"Expected it at ($CONFIG_PATH)"
    }
  }

  let config = (open $CONFIG_PATH)
  if $config.schema != 1 {
    error make {
      msg: $"Unsupported research.toml schema: ($config.schema)"
      help: "This checkout supports schema 1."
    }
  }
  $config
}


def required-nushell-version []: nothing -> string {
  let config = (workspace-config)
  read-version-file $config.toolchain.nushell_version_file
}


def required-typst-version []: nothing -> string {
  let config = (workspace-config)
  read-version-file $config.toolchain.typst_version_file
}


def require-nushell []: nothing -> nothing {
  let required = (required-nushell-version)
  let actual = $env.NU_VERSION
  if $actual != $required {
    error make {
      msg: $"Unsupported Nushell version: expected ($required), got ($actual)"
      help: $"Run this project with Nushell ($required). Current executable: ($nu.current-exe)"
    }
  }
}


def resolve-typst []: nothing -> any {
  let config = (workspace-config)
  let required = (required-typst-version)
  let override_name = $config.toolchain.typst_override_env
  let override = ($env | get -o ($override_name | into cell-path))

  if $override != null {
    return ($override | path expand)
  }

  let executable_name = if $nu.os-info.name == "windows" { "typst.exe" } else { "typst" }
  let local = (
    $ROOT
    | path join $config.toolchain.local_tools_root "typst" $required $executable_name
  )
  if ($local | path exists) {
    return $local
  }

  let found = (which typst)
  if ($found | is-empty) {
    null
  } else {
    $found | first | get path
  }
}


def installed-typst-version [executable: path]: nothing -> any {
  let result = (do { ^$executable --version } | complete)
  if $result.exit_code != 0 {
    return null
  }

  let matches = (
    $result.stdout
    | parse --regex '(?i)typst\s+(?<version>[0-9]+\.[0-9]+\.[0-9]+)'
  )
  if ($matches | is-empty) { null } else { $matches.0.version }
}


def toolchain-status []: nothing -> table {
  let config = (workspace-config)
  let required_nu = (read-version-file $config.toolchain.nushell_version_file)
  let required_typst = (read-version-file $config.toolchain.typst_version_file)
  let typst = (resolve-typst)
  let actual_typst = if $typst == null { null } else { installed-typst-version $typst }

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
      status: (
        if $typst == null { "missing" }
        else if $actual_typst == $required_typst { "ok" }
        else { "mismatch" }
      )
      path: ($typst | default "—")
    }
    {
      component: "research.toml"
      required: "present"
      actual: (if ($CONFIG_PATH | path exists) { "present" } else { "missing" })
      status: (if ($CONFIG_PATH | path exists) { "ok" } else { "missing" })
      path: $CONFIG_PATH
    }
    {
      component: "papers-root"
      required: "present"
      actual: (if (($ROOT | path join $config.workspace.papers_root) | path exists) { "present" } else { "missing" })
      status: (if (($ROOT | path join $config.workspace.papers_root) | path exists) { "ok" } else { "missing" })
      path: ($ROOT | path join $config.workspace.papers_root)
    }
    {
      component: "templates-root"
      required: "present"
      actual: (if (($ROOT | path join $config.workspace.templates_root) | path exists) { "present" } else { "missing" })
      status: (if (($ROOT | path join $config.workspace.templates_root) | path exists) { "ok" } else { "missing" })
      path: ($ROOT | path join $config.workspace.templates_root)
    }
  ]
}


def require-toolchain []: nothing -> path {
  require-nushell
  let rows = (toolchain-status)
  let failures = ($rows | where status != "ok")
  if not ($failures | is-empty) {
    print $rows
    error make {
      msg: "The project toolchain is not usable"
      help: "Install the exact pinned versions or set RESEARCH_TYPST to the supported Typst executable."
    }
  }
  resolve-typst
}


def paper-manifest-paths []: nothing -> list<string> {
  let config = (workspace-config)
  let pattern = ($ROOT | path join $config.workspace.papers_root "*" "paper.toml")
  glob $pattern | sort
}


def read-paper [manifest_path: path]: nothing -> record {
  let manifest = (open $manifest_path)
  if $manifest.schema != 1 {
    error make {
      msg: $"Unsupported paper manifest schema in ($manifest_path)"
      help: "This checkout supports paper.toml schema 1."
    }
  }

  let paper_dir = ($manifest_path | path dirname)
  let metadata_name = ($manifest | get -o paper.metadata | default "prepare.json")
  let metadata_path = ($paper_dir | path join $metadata_name)
  if not ($metadata_path | path exists) {
    error make {
      msg: $"Missing paper metadata: ($metadata_path)"
      help: $"Referenced by ($manifest_path)"
    }
  }

  let metadata = (open $metadata_path)
  let tags = ($manifest | get -o paper.tags | default [])
  let progress_path = ($paper_dir | path join "study" "progress.yaml")
  let status = if ($progress_path | path exists) {
    open $progress_path | get -o current_stage | default "active"
  } else {
    "prepared"
  }

  {
    paper_id: $metadata.paper_id
    title: $metadata.paper.canonical_title
    year: $metadata.paper.publication.year
    stage: $metadata.curriculum.stage.id
    status: $status
    tags: $tags
    path: $paper_dir
    manifest_path: $manifest_path
    metadata_path: $metadata_path
    manifest: $manifest
    metadata: $metadata
  }
}


def discover-papers []: nothing -> table {
  paper-manifest-paths | each {|path| read-paper $path } | sort-by year title
}


def paper-documents [paper: record]: nothing -> table {
  let documents = ($paper.manifest | get -o documents | default [])
  $documents | each {|document|
    let source = ($paper.path | path join $document.source)
    let required = ($document | get -o required | default true)
    let formats = ($document | get -o formats | default ["pdf"])
    let inputs = ($document | get -o inputs | default {})
    let categories = (
      [$paper.stage]
      | append $paper.tags
      | append ($document | get -o categories | default [])
      | uniq
    )

    {
      document_id: $"($paper.paper_id)/($document.id)"
      owner: "paper"
      paper_id: $paper.paper_id
      paper_title: $paper.title
      name: $document.id
      source: $source
      source_relative: ($source | path relative-to $ROOT)
      formats: $formats
      categories: $categories
      inputs: $inputs
      required: $required
      exists: ($source | path exists)
    }
  }
}


def workspace-documents []: nothing -> table {
  let config = (workspace-config)
  let documents = ($config | get -o documents | default [])
  $documents | each {|document|
    let source = ($ROOT | path join $document.source)
    {
      document_id: $document.id
      owner: "workspace"
      paper_id: null
      paper_title: null
      name: $document.id
      source: $source
      source_relative: $document.source
      formats: ($document | get -o formats | default ["pdf"])
      categories: ($document | get -o categories | default ["workspace"])
      inputs: ($document | get -o inputs | default {})
      required: ($document | get -o required | default true)
      exists: ($source | path exists)
    }
  }
}


def discover-documents []: nothing -> table {
  let paper_docs = (
    discover-papers
    | each {|paper| paper-documents $paper }
    | flatten
  )
  $paper_docs | append (workspace-documents) | sort-by document_id
}


def find-paper [paper_id: string]: nothing -> record {
  let matches = (discover-papers | where paper_id == $paper_id)
  if ($matches | is-empty) {
    error make {
      msg: $"Unknown paper: ($paper_id)"
      help: "Run `nu research.nu list papers` to see valid paper IDs."
    }
  }
  $matches | first
}


def find-document [document_id: string]: nothing -> record {
  let matches = (discover-documents | where document_id == $document_id)
  if ($matches | is-empty) {
    error make {
      msg: $"Unknown document: ($document_id)"
      help: "Run `nu research.nu list documents` to see valid document IDs."
    }
  }
  $matches | first
}


def output-path [document: record, format: string, output_root: path]: nothing -> path {
  let extension = if $format == "html" { "html" } else { $format }
  if $document.owner == "paper" {
    $output_root
    | path join $format "papers" $document.paper_id $"($document.name).($extension)"
  } else {
    $output_root
    | path join $format "workspace" $"($document.name).($extension)"
  }
}


def compile-document [
  document: record
  format: string
  output_root: path
  typst: path
  variant: any = null
]: nothing -> record {
  let config = (workspace-config)
  if not ($document.exists) {
    return {
      document_id: $document.document_id
      format: $format
      output: null
      status: "missing-source"
      exit_code: 1
      stderr: $"Missing source: ($document.source)"
    }
  }

  if not ($format in $document.formats) {
    return {
      document_id: $document.document_id
      format: $format
      output: null
      status: "unsupported-format"
      exit_code: 1
      stderr: $"Declared formats: ($document.formats | str join ', ')"
    }
  }

  if $format == "html" and not $config.typst.html_enabled {
    return {
      document_id: $document.document_id
      format: $format
      output: null
      status: "html-disabled"
      exit_code: 1
      stderr: "HTML export is disabled in research.toml because it is still experimental for these templates."
    }
  }

  let output = (output-path $document $format $output_root)
  mkdir ($output | path dirname)

  let selected_variant = if $variant == null { $config.typst.default_variant } else { $variant }
  let base_inputs = { variant: $selected_variant }
  let inputs = ($base_inputs | merge $document.inputs)
  let input_args = (
    $inputs
    | transpose key value
    | each {|entry| ["--input" $"($entry.key)=($entry.value)"] }
    | flatten
  )

  mut args = ["compile" "--root" $ROOT]
  if $format == "html" {
    $args = ($args | append ["--features" "html" "--format" "html"])
  }
  $args = ($args | append $input_args | append [$document.source $output])

  let result = (do { ^$typst ...$args } | complete)
  {
    document_id: $document.document_id
    format: $format
    output: $output
    status: (if $result.exit_code == 0 { "ok" } else { "failed" })
    exit_code: $result.exit_code
    stderr: ($result.stderr | str trim)
  }
}


def build-documents [
  documents: table
  format: any = null
  variant: any = null
  output_root: any = null
]: nothing -> table {
  let config = (workspace-config)
  let typst = (require-toolchain)
  let root = if $output_root == null {
    $ROOT | path join $config.workspace.build_root
  } else {
    $output_root
  }

  let results = ($documents | each {|document|
    let formats = if $format == null { $document.formats } else { [$format] }
    $formats | each {|selected| compile-document $document $selected $root $typst $variant }
  } | flatten)

  let failures = ($results | where status != "ok")
  if not ($failures | is-empty) {
    print $results
    error make {
      msg: $"Build failed for ($failures | length) artifact(s)"
      help: "Inspect the stderr column for Typst diagnostics."
    }
  }
  $results
}


def complete-paper-id []: nothing -> list<any> {
  discover-papers | each {|paper| {
    value: $paper.paper_id
    description: $"($paper.year) — ($paper.title)"
  }}
}


def complete-document-id []: nothing -> list<any> {
  discover-documents | each {|document| {
    value: $document.document_id
    description: $document.source_relative
  }}
}


def complete-category []: nothing -> list<any> {
  discover-documents
  | each {|document| $document.categories }
  | flatten
  | uniq
  | sort
}


def complete-paper-document []: nothing -> list<string> {
  discover-documents
  | where owner == "paper"
  | get name
  | uniq
  | sort
  | prepend "all"
}


def complete-format []: nothing -> list<string> { ["pdf" "html"] }


def complete-variant []: nothing -> list<string> {
  (workspace-config).typst.variants
}


# Show the available research workspace commands.
export def main [] {
  [
    "research doctor"
    "research version"
    "research list papers"
    "research list documents"
    "research list categories"
    "research show paper <paper-id>"
    "research build paper <paper-id>"
    "research build document <document-id>"
    "research build category <category>"
    "research build all"
    "research check"
    "research watch <document-id>"
    "research clean"
  ]
}


# Check exact Nushell/Typst versions and required workspace paths.
export def doctor []: nothing -> table {
  let rows = (toolchain-status)
  let failures = ($rows | where status != "ok")
  if not ($failures | is-empty) {
    print $rows
    error make {
      msg: $"Doctor found ($failures | length) problem(s)"
      help: "Install the exact pinned versions before building documents."
    }
  }
  $rows
}


# Show project-required and currently running tool versions.
export def version []: nothing -> record {
  let typst = (resolve-typst)
  {
    schema: (workspace-config).schema
    nushell_required: (required-nushell-version)
    nushell_actual: $env.NU_VERSION
    nushell_executable: $nu.current-exe
    typst_required: (required-typst-version)
    typst_actual: (if $typst == null { null } else { installed-typst-version $typst })
    typst_executable: $typst
  }
}


# List papers registered through ydmp/papers/*/paper.toml.
export def "list papers" []: nothing -> table {
  require-nushell
  discover-papers | select paper_id title year stage status tags
}


# List all paper and workspace Typst entrypoints.
export def "list documents" []: nothing -> table {
  require-nushell
  discover-documents
  | select document_id owner paper_id source_relative formats categories required exists
}


# List curriculum stages and free-form document categories.
export def "list categories" []: nothing -> table {
  require-nushell
  discover-documents
  | each {|document|
      $document.categories | each {|category| {
        category: $category
        document_id: $document.document_id
        paper_id: $document.paper_id
      }}
    }
  | flatten
  | group-by category
  | transpose category rows
  | each {|group| {
      category: $group.category
      document_count: ($group.rows | length)
      paper_count: ($group.rows.paper_id | compact | uniq | length)
    }}
  | sort-by category
}


# Show one paper and its registered documents.
export def "show paper" [
  paper_id: string@complete-paper-id
]: nothing -> record {
  require-nushell
  let paper = (find-paper $paper_id)
  {
    paper_id: $paper.paper_id
    title: $paper.title
    year: $paper.year
    stage: $paper.stage
    status: $paper.status
    tags: $paper.tags
    path: $paper.path
    documents: (paper-documents $paper)
  }
}


# Build one or all documents belonging to a paper.
export def "build paper" [
  paper_id: string@complete-paper-id
  --document(-d): string@complete-paper-document = "all"
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
]: nothing -> table {
  require-nushell
  let paper = (find-paper $paper_id)
  let documents = (paper-documents $paper)
  let selected = if $document == "all" {
    $documents
  } else {
    $documents | where name == $document
  }
  if ($selected | is-empty) {
    error make {
      msg: $"Paper ($paper_id) has no document named ($document)"
      help: "Run `nu research.nu show paper <paper-id>` to inspect its documents."
    }
  }
  build-documents $selected $format $variant
}


# Build one globally identified paper or workspace document.
export def "build document" [
  document_id: string@complete-document-id
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
]: nothing -> table {
  require-nushell
  build-documents [(find-document $document_id)] $format $variant
}


# Build all documents tagged with a curriculum stage or category.
export def "build category" [
  category: string@complete-category
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
]: nothing -> table {
  require-nushell
  let selected = (discover-documents | where {|document| $category in $document.categories })
  if ($selected | is-empty) {
    error make {
      msg: $"Unknown or empty category: ($category)"
      help: "Run `nu research.nu list categories` to see valid categories."
    }
  }
  build-documents $selected $format $variant
}


# Build every registered paper and workspace document.
export def "build all" [
  --format(-f): string@complete-format
  --variant(-v): string@complete-variant
]: nothing -> table {
  require-nushell
  build-documents (discover-documents) $format $variant
}


# Compile all registered documents into a temporary directory.
export def check [
  --keep
]: nothing -> table {
  require-nushell
  let missing = (discover-documents | where exists == false)
  if not ($missing | is-empty) {
    print $missing
    error make {
      msg: $"($missing | length) registered document source(s) are missing"
      help: "Fix paper.toml or research.toml before compiling."
    }
  }

  let config = (workspace-config)
  let temp_root = if $keep {
    $ROOT | path join $config.workspace.build_root "check"
  } else {
    $nu.temp-dir | path join $"likern-research-check-((random uuid))"
  }

  if ($temp_root | path exists) { rm --recursive --force $temp_root }
  mkdir $temp_root

  let results = (try {
    build-documents (discover-documents) null null $temp_root
  } catch {|error|
    if not $keep and ($temp_root | path exists) {
      rm --recursive --force $temp_root
    }
    error make $error
  })

  if not $keep and ($temp_root | path exists) {
    rm --recursive --force $temp_root
  }
  $results
}


# Watch one registered document and rebuild it after changes.
export def watch [
  document_id: string@complete-document-id
  --format(-f): string@complete-format = "pdf"
  --variant(-v): string@complete-variant
]: nothing -> nothing {
  require-nushell
  let config = (workspace-config)
  let typst = (require-toolchain)
  let document = (find-document $document_id)
  if not ($format in $document.formats) {
    error make { msg: $"Document ($document_id) does not declare format ($format)" }
  }
  if $format == "html" and not $config.typst.html_enabled {
    error make { msg: "HTML export is disabled in research.toml" }
  }

  let output_root = ($ROOT | path join $config.workspace.build_root)
  let output = (output-path $document $format $output_root)
  mkdir ($output | path dirname)
  let selected_variant = if $variant == null { $config.typst.default_variant } else { $variant }
  let inputs = ({ variant: $selected_variant } | merge $document.inputs)
  let input_args = (
    $inputs
    | transpose key value
    | each {|entry| ["--input" $"($entry.key)=($entry.value)"] }
    | flatten
  )

  mut args = ["watch" "--root" $ROOT]
  if $format == "html" {
    $args = ($args | append ["--features" "html" "--format" "html"])
  }
  $args = ($args | append $input_args | append [$document.source $output])
  ^$typst ...$args
}


# Remove only generated build artifacts.
export def clean []: nothing -> nothing {
  require-nushell
  let build_root = ($ROOT | path join (workspace-config).workspace.build_root)
  if ($build_root | path exists) {
    rm --recursive --force $build_root
  }
}


# Script-mode wrappers. Interactive users should `use ./research.nu` and call
# the corresponding `research ...` commands to receive custom completions.
def "main doctor" [] { doctor }
def "main version" [] { version }
def "main list papers" [] { list papers }
def "main list documents" [] { list documents }
def "main list categories" [] { list categories }
def "main show paper" [paper_id: string@complete-paper-id] { show paper $paper_id }
def --wrapped "main build paper" [paper_id: string@complete-paper-id ...rest] {
  build paper $paper_id ...$rest
}
def --wrapped "main build document" [document_id: string@complete-document-id ...rest] {
  build document $document_id ...$rest
}
def --wrapped "main build category" [category: string@complete-category ...rest] {
  build category $category ...$rest
}
def --wrapped "main build all" [...rest] { build all ...$rest }
def --wrapped "main check" [...rest] { check ...$rest }
def --wrapped "main watch" [document_id: string@complete-document-id ...rest] {
  watch $document_id ...$rest
}
def "main clean" [] { clean }
