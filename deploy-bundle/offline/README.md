# System Binaries Required

Before running the Nucleus application on the server, download the following
files on an internet-connected machine and place them in this folder. They will
then be transferred to the no-internet server alongside the rest of this
deployment bundle.

## 1. Node.js 22 LTS (Windows x64, portable zip)

- URL: https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip
- Save as: `node-v22.12.0-win-x64.zip`

## 2. SurrealDB 3.0.5 (Windows binary)

- URL: https://github.com/surrealdb/surrealdb/releases/download/v3.0.5/surreal-v3.0.5.windows-amd64.exe
- Save as: `surreal-v3.0.5-windows.exe`

## Verification

After downloading, the `offline/` folder should contain:

```
offline/
├── README.md                      (this file)
├── node-v22.12.0-win-x64.zip
└── surreal-v3.0.5-windows.exe
```

These files are not included in the git repository — they must be added
manually. See `../SERVER_SETUP.md` for installation instructions.
