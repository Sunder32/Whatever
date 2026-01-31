# Sidecars Directory

This directory contains pre-compiled backend binaries for distribution with the Electron app.

## Structure

```
sidecars/
├── win/           # Windows binaries
│   └── backend.exe
├── mac/           # macOS binaries
│   └── backend
└── linux/         # Linux binaries
    └── backend
```

## Building Sidecars

### Go Backend

To build the Go backend for each platform:

```bash
# Windows (from project root)
cd backend
GOOS=windows GOARCH=amd64 go build -o ../sidecars/win/backend.exe ./cmd/server

# macOS
GOOS=darwin GOARCH=amd64 go build -o ../sidecars/mac/backend ./cmd/server

# Linux
GOOS=linux GOARCH=amd64 go build -o ../sidecars/linux/backend ./cmd/server
```

### Python Service (Optional)

For Python, you can use PyInstaller to create standalone executables:

```bash
cd python-service
pip install pyinstaller
pyinstaller --onefile app/main.py -n python-service
# Move the executable to the appropriate sidecars directory
```

## Usage in Electron

The sidecars are automatically bundled with the Electron app during build.
They are accessible at runtime via:

```typescript
import { app } from 'electron'
import * as path from 'path'

const sidecarPath = app.isPackaged
  ? path.join(process.resourcesPath, 'sidecars', 'backend')
  : path.join(__dirname, '..', 'sidecars', process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux', 'backend')
```
