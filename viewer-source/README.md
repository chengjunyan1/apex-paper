# Workflow database

Adapted from [`xcadet/apex/apex-viewer`](https://github.com/xcadet/apex/tree/main/apex-viewer), under its Apache 2.0 license (see `LICENSE`). The production app is served at `https://junyan.ch/apex-paper/explorer/`.

The viewer loads metadata for all 28,568 designs once, then fetches each workflow's `graph.py` and `prompt.py` only when opened. No backend, execution service, API token, or inference API is used in the browser.

```sh
npm ci --prefix viewer
DESIGNS_JSONL=/absolute/path/to/all_workflows.jsonl npm run export --prefix viewer
npm run lint --prefix viewer
npm run build --prefix viewer
```

Obtain `all_workflows.jsonl` by extracting `all_workflows.zip` from the linked code repository. The export is generated into `viewer/public/data/`; it is deliberately excluded from the paper's source archive. Copy `viewer/dist/` into `website/explorer/` after building. The Vite base path is `/apex-paper/explorer/`.

Local adaptations: shared paper/database navigation and visual style; mobile filter panel; keyboard-accessible table; dialog focus management; retryable code fetches; corrected React state updates; repaired dependency lockfile.
