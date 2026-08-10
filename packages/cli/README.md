# stemmory

The `stemmory` CLI — installs the Stemmory Conventions Kit skill and `AGENTS.md` fragment into a project, and lints feature docs against the shared schema. No Stemmory account required.

```bash
npx stemmory init      # install skill + AGENTS.md fragment + .stemmory/config.json
stemmory lint           # validate docs/features/*.md against schema v1
stemmory update         # refresh the installed skill + fragment in place
stemmory --help
```

See the [workspace README](../../README.md) for the full pitch — install the kit, accumulate clean feature docs and decisions, then connect Stemmory to see it as a live map.

Part of the [stemmory/cli](https://github.com/stemmory/cli) workspace, alongside [`@stemmory/schema`](https://www.npmjs.com/package/@stemmory/schema).

## License

MIT — see [LICENSE](LICENSE).
