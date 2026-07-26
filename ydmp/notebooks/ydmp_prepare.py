import marimo

app = marimo.App(width="medium")

@app.cell
def _():
    import json
    from pathlib import Path
    import duckdb
    import marimo as mo
    from jsonschema import Draft202012Validator
    return Draft202012Validator, Path, duckdb, json, mo

@app.cell
def _(Path, duckdb, mo):
    repo_root = Path(__file__).resolve().parents[2]
    db_path = repo_root / "ydmp.duckdb"
    con = duckdb.connect(str(db_path))
    con.execute((repo_root / "ydmp/duckdb/schema.sql").read_text())
    mo.md(f"# YDMP explorer\n\nDuckDB: `{db_path}`")
    return con, repo_root

@app.cell
def _(mo, repo_root):
    path = mo.ui.text(
        value=str(repo_root / "ydmp/papers"),
        label="prepare.json path",
        full_width=True,
    )
    path
    return (path,)

@app.cell
def _(Draft202012Validator, Path, json, mo, path, repo_root):
    p = Path(path.value)
    if not p.is_file():
        packet = None
        view = mo.callout("Specify a concrete prepare.json file.", kind="warn")
    else:
        packet = json.loads(p.read_text())
        schema = json.loads(
            (repo_root / "ydmp/schemas/preparation-packet.schema.json").read_text()
        )
        errors = list(Draft202012Validator(schema).iter_errors(packet))
        view = mo.callout(
            "Schema valid." if not errors else "\n".join(e.message for e in errors),
            kind="success" if not errors else "danger",
        )
    view
    return (packet,)

@app.cell
def _(con, mo):
    mo.ui.table(con.sql("SELECT * FROM curriculum_progress").df())
    return

if __name__ == "__main__":
    app.run()
