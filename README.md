# Diagram App

Professional diagramming tool for seamless collaboration. Visualize ideas, create flowcharts, and collaborate in real-time.

## 🚀 Features

- **Real-time Collaboration**: Work with your team on the same diagram instantly.
- **Modern UI**: Dark glassmorphism design with intuitive controls.
- **Cross-Platform**: Available for Windows, macOS, and Linux (and Web).
- **Secure**: Projects are private by default.
- **Offline Capable**: Works offline with local storage (Desktop version).

## 🛠 Build Instructions

### Prerequisites
- Node.js (Latest LTS recommended)
- Go (for backend)
- Docker (optional, for containerization)

### Installing Dependencies

```bash
npm install
cd landing && npm install
```

### Desktop App (Electron)

Build for Windows (Portable):
```bash
npm run electron:build:win
```
*Artifacts will be in `release-v5/`.*

### Landing Page

```bash
cd landing
npm run dev   # Development
npm run build # Production
```

## 🌍 Release & Deployment

1. **Create Tag**: `git tag v1.0.0` and `git push origin v1.0.0`.
2. **GitHub Releases**: Create a release for tag `v1.0.0` and upload the `.zip` from `release-v5/`.
   - The link is pre-configured to: `https://github.com/Sunder32/Whatever/releases/download/v1.0.0/Diagram-App-1.0.0-Windows-Portable.zip`.
3. **Landing Page**: Deploy `landing/dist` to Vercel/Netlify/GitHub Pages.

## 📄 License

See [LICENSE.md](LICENSE.md)
# Diagram-app
