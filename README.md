# OpenMeshTak Web

The participant and administration web application of OpenMeshTak. It is a client of the
OpenMeshTak Core API and contains no authorization or profile-resolution rules of its own.

## Requirements

- Node.js 24 or newer
- pnpm 10.12 or newer
- a running OpenMeshTak Core for local development

## Local development

Start Core with `PUBLIC_ORIGIN=http://localhost:5173`, then:

```sh
pnpm install
pnpm dev
```

Vite serves the app on `http://localhost:5173` and proxies `/api` to Core
(`http://127.0.0.1:3000`, override with `OPENMESHTAK_CORE_URL`), so the browser stays same-origin
like the production deployment.

## API contract

`openapi/openapi.json` is a committed copy of Core's contract and `src/generated/api` is generated
from it. After Core changes its API:

```sh
pnpm api:sync      # copy ../openmeshtak/openapi/openapi.json
pnpm api:generate  # regenerate the typed client
```

## Verification

```sh
pnpm check
```

## Releases

The Web app ships inside the OpenMeshTak image, where Core serves it on the same origin as the API. That image is built and released from the `openmeshtak` repository, which builds this repository at the same tag through the Docker build context `web`. Both repositories share one version, and the Web app warns when it talks to a Core of another major or minor version. To release, set the same `version` in `package.json` of both repositories, commit, push the tag `v<version>` here first and then to `openmeshtak`.

## License

OpenMeshTak Web is licensed under `AGPL-3.0-only`.
