# omnibus-telem

Telemetry monitoring application for launch control operations, built with
Electron, TypeScript and React.

**Status:** not started. This is still the unmodified
[vite-electron-builder](https://github.com/cawa-93/vite-electron-builder)
template (see `LICENSE` for its MIT notice). It has no renderer package yet,
so it does not build or have CI until one is created.

## Getting started

This app is a standalone npm project (its own `package-lock.json`), not part
of the monorepo's root npm workspace: the template's packages are all named
`@app/*`, which clash with the avionics testing app's.

```sh
cd areas/apps/omnibus-telem
npm run init      # create and integrate the renderer package (first time only)
npm start         # run in development mode
npm run compile   # build the desktop executable
```
