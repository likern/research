# Interactive notebooks

Recommended: **marimo + DuckDB**.

- reactive Python and SQL cells;
- notebook is a normal `.py` file;
- clean Git diffs;
- executable as a script;
- interactive UI widgets;
- custom persistent DuckDB connection.

Run:

```bash
uv sync
uv run marimo edit ydmp/notebooks/ydmp_prepare.py
```

DuckDB also works directly in Jupyter/JupyterLab. JupySQL adds `%sql` and
`%%sql` cells.
