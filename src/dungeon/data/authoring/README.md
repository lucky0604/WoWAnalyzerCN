# Dungeon authoring drafts

This directory is the content-maintainer workspace, not the runtime registry.
Use the scaffold commands to create a draft and keep every generated document
in `dataStatus: "draft"` until facts, provenance, and second-person review are
complete.

```bash
pnpm dungeon:new dungeon --season midnight-s2 --slug example-dungeon
pnpm dungeon:add enemy --dungeon example-dungeon --name "TODO enemy"
pnpm dungeon:add ability --dungeon example-dungeon --name "TODO cast"
pnpm dungeon:add situation --dungeon example-dungeon
pnpm dungeon:add boss --dungeon example-dungeon
pnpm dungeon:add route-step --dungeon example-dungeon
# For a real learning wave, add `--type pull --spawn <stable-spawn-id>`.
pnpm dungeon:check --dungeon=example-dungeon
pnpm dungeon:preview --dungeon example-dungeon
```

The command writes `document.json` and `AUTHORING.md` under the slug directory.
It never edits generated coordinate snapshots or registers a public dungeon.
`dungeon:publish` only writes an explicit release manifest after the document
passes provenance and completeness gates; it does not mutate the runtime registry.

Before requesting second-person review, record `review.selfTest` with the
learning modes exercised and every Situation/Route covered by the author pass.
Also record `review.authoringEffort` with the full-dungeon minutes and one
positive-minute entry for every `routine` or `critical` Situation. This is
release evidence, not a runtime progress metric.
