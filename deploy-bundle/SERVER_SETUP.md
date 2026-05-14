# Nucleus Server Setup

## Prerequisites (one-time)

1. Extract `node-v22.12.0-win-x64.zip` from `offline/` to `C:\node`
2. Add `C:\node` to system PATH
3. Run `surreal-v3.0.5-windows.exe` from `offline/` to install SurrealDB

## Starting the application

Run `start-server.bat` from this directory.

This starts SurrealDB, runs the database setup, and starts the API.

## Serving the web UI

The `web` folder contains the Flutter web build — static HTML/JS/CSS files.
Serve them with any web server. Simplest option:

```
npx serve web -l 3000
```

Or point IIS at the `web` folder.

## Verify

- SurrealDB: http://localhost:8000/health (blank response = OK)
- API: http://localhost:3001/api/v1/health (returns JSON)
- Web: http://localhost:3000 (Nucleus dashboard)

## Reset database

```
node database\reset.js
```

Note: setup and reset are plain-JavaScript ESM scripts — they run on Node 22
directly with no `tsx` or other TypeScript tooling required. They use a
path-relative import to find the `surrealdb` package inside `api\node_modules\`.
