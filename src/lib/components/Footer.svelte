<script lang="ts">
	import { Heart, Github, Shield, Zap, Image } from 'lucide-svelte';
</script>

<footer class="mt-auto border-t border-surface-800/50 py-6">
	<div class="mx-auto max-w-6xl px-6">
		<div class="flex flex-col items-center justify-between gap-4 lg:flex-row">
			<!-- Left: Privacy badge -->
			<div class="flex items-center gap-4 text-sm text-surface-500">
				<div class="flex items-center gap-1.5">
					<Shield class="h-4 w-4 text-green-500" />
					<span>100% Private</span>
				</div>
				<span class="text-surface-700">•</span>
				<span>Your videos never leave your device</span>
			</div>

			<!-- Center: Powered by -->
			<div class="flex items-center gap-2 text-xs text-surface-600">
				<Zap class="h-3.5 w-3.5" />
				<span>Powered by</span>
				<a
					href="https://mediabunny.dev"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-surface-400 transition-colors hover:text-accent-start"
				>
					Mediabunny
				</a>
				<span>+</span>
				<a
					href="https://github.com/ffmpegwasm/ffmpeg.wasm"
					target="_blank"
					rel="noopener noreferrer"
					class="font-medium text-surface-400 transition-colors hover:text-accent-start"
				>
					FFmpeg.wasm
				</a>
			</div>

			<!-- Right: Links -->
			<div class="flex items-center gap-3">
				<a
					href="https://ishanjalan.github.io/ImageOptimser/"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 px-3 py-1 text-sm font-medium text-pink-400 transition-all hover:from-pink-500/20 hover:to-purple-500/20"
				>
					<Image class="h-3.5 w-3.5" />
					<span>Squish</span>
				</a>
				<span class="text-surface-700">•</span>
				<a
					href="https://github.com/ishanjalan/Squash"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-1.5 text-sm text-surface-500 transition-colors hover:text-surface-100"
				>
					<Github class="h-4 w-4" />
					<span>Source</span>
				</a>
				<span class="text-surface-700">•</span>
				<p class="flex items-center gap-1.5 text-sm text-surface-500">
					<span>Made with</span>
					<Heart class="h-3.5 w-3.5 text-red-500 fill-red-500" />
					<span>by Ishan Jalan</span>
				</p>
			</div>
		</div>
	</div>
</footer>
