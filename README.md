# Squash

A blazing-fast, privacy-first video compressor that runs entirely in your browser. Compress and convert videos with FFmpeg — no uploads, no servers, no compromises.

## ✨ Features

### 🔒 100% Private
Your videos **never leave your device**. All compression happens locally using WebAssembly — no server uploads, no data collection, complete privacy.

### ⚡ FFmpeg-Powered
Powered by the industry-standard FFmpeg compiled to WebAssembly:
- **H.264** — Universal MP4 compatibility
- **VP9** — Modern WebM compression
- **AAC/Opus** — High-quality audio codecs

### 🎯 Smart Presets
- **Tiny** — Maximum compression for sharing
- **Web** — Balanced quality for websites
- **Social** — Optimized for social media
- **High** — Preserve quality for archives

### 🚀 Easy to Use
- Drag and drop videos
- Real-time progress tracking
- Download individually or as ZIP
- Beautiful dark UI

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Compression | [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) |
| Icons | [Lucide](https://lucide.dev/) |
| Language | TypeScript |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm, pnpm, or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ishanjalan/Squash.git
cd Squash

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## 📖 Usage

1. **Drop videos** — Drag and drop files onto the drop zone or click to browse
2. **Configure** — Choose quality preset and output format (MP4 or WebM)
3. **Wait** — FFmpeg compresses your video locally
4. **Download** — Get individual files or download all as ZIP

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + D` | Download all as ZIP |
| `Escape` | Clear all videos |

## 🔧 How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Your Video │ ──▶ │ FFmpeg WASM  │ ──▶ │ Compressed  │
│   (local)   │     │ (in browser) │     │   (local)   │
└─────────────┘     └──────────────┘     └─────────────┘
         ▲                                      │
         └──────────────────────────────────────┘
                    Never leaves your device
```

## 📊 Supported Formats

### Input
- MP4, WebM, MOV, AVI

### Output
- **MP4** (H.264 + AAC) — Maximum compatibility
- **WebM** (VP9 + Opus) — Modern, efficient

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) — The multimedia framework
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — FFmpeg for the browser
- [Squishan](https://github.com/ishanjalan/ImageOptimser) — Sister project for image optimization

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ishanjalan">Ishan Jalan</a>
</p>
