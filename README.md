# Squash

A blazing-fast, privacy-first video compressor that runs entirely in your browser. GPU-accelerated compression via WebCodecs with FFmpeg.wasm fallback — no uploads, no servers, no compromises.

**The companion to [Squish](https://github.com/ishanjalan/ImageOptimser) for video optimization.**

![Squash Screenshot](static/og-image.svg)

## ✨ Features

### 🚀 GPU-Accelerated Encoding
Squash uses a **hybrid encoding architecture** for maximum performance:
- **[Mediabunny](https://mediabunny.dev/)** — Hardware-accelerated encoding via WebCodecs API (10-100x faster)
- **FFmpeg.wasm** — Reliable software fallback for universal support
- **Automatic Selection** — Chooses the fastest encoder for your video and browser

### 🔒 100% Private
Your videos **never leave your device**. All compression happens locally using WebAssembly and WebCodecs — no server uploads, no data collection, complete privacy.

### 🎬 Professional Codecs
- **H.264/AVC** — Universal MP4 compatibility
- **VP9** — Modern WebM compression  
- **AV1** — Next-gen compression (30-50% better than H.264)
- **AAC/Opus** — High-quality audio codecs

### 🎯 Smart Presets & Advanced Controls
- **Quality Presets** — Tiny, Web, Social, High, Lossless
- **Resolution Scaling** — 4K, 1440p, 1080p, 720p, 480p, 360p
- **Audio Controls** — Codec selection, bitrate, or remove audio entirely
- **Encoding Speed** — Ultra-fast to Very Slow (quality/speed tradeoff)
- **Two-Pass Encoding** — Better quality at target bitrate
- **Metadata Stripping** — Remove EXIF, GPS, camera info for privacy
- **Smart Suggestions** — Optimal settings based on your source video

### ⚡ Professional Features
- **Batch Processing** — Compress multiple videos at once
- **Drag-to-Reorder Queue** — Prioritize your compression queue
- **Before/After Comparison** — Side-by-side slider comparison
- **Compression Preview** — 5-second preview before full compression
- **Progress Estimation** — Real-time ETA with progress stages
- **Performance Monitor** — System stats, WebCodecs detection, encoder usage
- **Download as ZIP** — Get all compressed videos in one click

### 🎨 Beautiful Experience
- Dark theme optimized for focus
- Responsive design for all screen sizes
- Smooth animations and transitions
- Glassmorphism UI elements

### 📱 PWA Support
- Install as a desktop/mobile app
- Offline-capable with Service Worker
- Share Target API support
- File Handler API support

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) | Modern reactive UI |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first CSS |
| Primary Encoder | [Mediabunny](https://mediabunny.dev/) | WebCodecs wrapper for GPU encoding |
| Fallback Encoder | [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Software encoding via WASM |
| Storage | IndexedDB via [idb](https://github.com/jakearchibald/idb) | Large file handling |
| Icons | [Lucide](https://lucide.dev/) | Beautiful icon set |
| Language | TypeScript | Type safety |

## 🔧 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Squash Video Compressor                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 1: Mediabunny (Primary - Fast Path)              │    │
│  │  ├── WebCodecs API under the hood                       │    │
│  │  ├── Hardware-accelerated (GPU) encoding                │    │
│  │  ├── H.264, VP9, AAC, Opus codecs                       │    │
│  │  └── 10-100x faster than software encoding              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ▼ fallback                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 2: FFmpeg.wasm (Fallback - Reliable)             │    │
│  │  ├── Software encoding (CPU via WebAssembly)            │    │
│  │  ├── AV1 encoding (faster than WebCodecs AV1)          │    │
│  │  ├── Two-pass encoding, advanced filters                │    │
│  │  └── Universal browser support                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Layer 3: Browser APIs                                   │    │
│  │  └── Web Workers, IndexedDB, Service Worker             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                    ↑                           ↓
              Your Video                  Compressed Video
               (local)                       (local)
                                               
              🔒 Never leaves your device 🔒
```

### Encoder Selection Logic

| Scenario | Encoder Used | Reason |
|----------|--------------|--------|
| MP4/WebM with WebCodecs support | **Mediabunny** | GPU acceleration available |
| AV1 output | **FFmpeg.wasm** | WebCodecs AV1 is slower |
| No WebCodecs support | **FFmpeg.wasm** | Universal fallback |
| Two-pass encoding | **FFmpeg.wasm** | Not supported in WebCodecs |

### Performance Comparison

| Operation | Mediabunny (GPU) | FFmpeg.wasm (CPU) | Speedup |
|-----------|------------------|-------------------|---------|
| 1080p H.264 encode | ~800 frames/s | ~12 frames/s | **67x** |
| Metadata extraction | ~860 ops/s | ~2 ops/s | **430x** |
| Memory usage | Streaming | Full file in memory | **Lower** |

*Benchmarks from [Mediabunny](https://mediabunny.dev/) on Ryzen 7600X + RTX 4070*

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm, pnpm, or yarn
- Modern browser (Chrome 94+, Edge 94+, Firefox 100+, Safari 16.4+)

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

### Enable Multi-threaded FFmpeg (Optional)

For maximum FFmpeg performance, configure your server to send these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

This enables `SharedArrayBuffer` for multi-threaded WebAssembly.

## 📖 Usage

1. **Drop videos** — Drag and drop files onto the drop zone, click to browse, or paste from clipboard
2. **Configure** — Choose quality preset, output format, resolution, and advanced options
3. **Wait** — Squash compresses your video locally with real-time progress
4. **Compare** — Use the before/after slider to compare quality
5. **Download** — Get individual files or download all as ZIP

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + D` | Download all as ZIP |
| `Cmd/Ctrl + V` | Paste video from clipboard |
| `Escape` | Clear all videos / Close modal |
| `?` | Show keyboard shortcuts |
| `1` - `5` | Quick quality preset selection |
| `M` | Switch to MP4 format |
| `W` | Switch to WebM format |
| `A` | Switch to AV1 format |
| `P` | Toggle performance monitor |

## 📊 Supported Formats

### Input
- MP4, WebM, MOV, AVI, MKV

### Output
| Format | Codecs | Best For | Encoder |
|--------|--------|----------|---------|
| **MP4** | H.264 + AAC | Universal playback | Mediabunny (GPU) |
| **WebM** | VP9 + Opus | Web delivery | Mediabunny (GPU) |
| **AV1** | AV1 + AAC | Maximum compression | FFmpeg.wasm |

## 📈 Compression Comparison

| Format | Best For | Typical Savings | Speed |
|--------|----------|-----------------|-------|
| MP4 (H.264) | Universal playback | 40-60% | ⚡ Fast (GPU) |
| WebM (VP9) | Web delivery | 50-70% | ⚡ Fast (GPU) |
| AV1 | Maximum compression | 60-80% | 🐢 Slow (CPU) |

## 🌟 Squash vs Squish

| Feature | Squish (Images) | Squash (Videos) |
|---------|-----------------|-----------------|
| 100% Client-side | ✅ | ✅ |
| GPU Acceleration | ❌ | ✅ (WebCodecs) |
| Batch Processing | ✅ | ✅ |
| Worker Pool | ✅ | ✅ |
| Quality Presets | 5 | 5 |
| Format Options | 5 (JPEG, PNG, WebP, AVIF, SVG) | 3 (MP4, WebM, AV1) |
| Before/After Comparison | ✅ | ✅ |
| ZIP Download | ✅ | ✅ |
| Smart Suggestions | ❌ | ✅ |
| Drag-to-Reorder | ❌ | ✅ |
| PWA Support | ✅ | ✅ |
| Performance Monitor | ❌ | ✅ |

## 🔮 Roadmap

With Mediabunny integration, these features are now possible:

- [ ] **Video Trimming** — Cut videos to specific timestamps
- [ ] **Video Cropping** — Remove unwanted areas
- [ ] **Video Rotation** — Fix orientation issues
- [ ] **Frame Extraction** — Export thumbnails at any timestamp
- [ ] **Audio Extraction** — Extract audio track to MP3/AAC
- [ ] **GIF/WebP Creation** — Convert clips to animated images
- [ ] **Video Concatenation** — Join multiple videos
- [ ] **Real-time Preview** — Live preview while adjusting settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature-amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Mediabunny](https://mediabunny.dev/) — Complete media toolkit for the web
- [FFmpeg](https://ffmpeg.org/) — The multimedia framework
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) — FFmpeg for the browser
- [Squish](https://github.com/ishanjalan/ImageOptimser) — Sister project for image optimization
- [Google Squoosh](https://squoosh.app/) — Inspiration for browser-based media processing

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ishanjalan">Ishan Jalan</a>
</p>
