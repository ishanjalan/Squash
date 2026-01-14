<script lang="ts">
	import { videos, type VideoItem, type OutputFormat } from '$lib/stores/videos.svelte';
	import { downloadVideo } from '$lib/utils/download';
	import { reprocessVideo } from '$lib/utils/compress';
	import { Download, X, AlertCircle, Check, Loader2, ArrowRight, ChevronDown, RotateCcw, Play } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	let { item }: { item: VideoItem } = $props();

	let showFormatMenu = $state(false);
	let showPreview = $state(false);

	const savings = $derived(
		item.compressedSize ? Math.round((1 - item.compressedSize / item.originalSize) * 100) : 0
	);

	const isPositiveSavings = $derived(savings > 0);

	const availableFormats: { value: OutputFormat; label: string; color: string }[] = [
		{ value: 'mp4', label: 'MP4', color: 'from-orange-500 to-red-500' },
		{ value: 'webm', label: 'WebM', color: 'from-green-500 to-emerald-500' }
	];

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleRemove() {
		videos.removeItem(item.id);
	}

	function handleDownload() {
		downloadVideo(item);
	}

	async function handleFormatChange(format: OutputFormat) {
		showFormatMenu = false;
		if (format !== item.outputFormat) {
			videos.updateItem(item.id, { outputFormat: format });
			await reprocessVideo(item.id);
		}
	}

	async function handleRetry() {
		await reprocessVideo(item.id);
	}

	function getCurrentFormatColor() {
		const format = availableFormats.find(f => f.value === item.outputFormat);
		return format?.color || 'from-gray-500 to-gray-600';
	}
</script>

<div
	class="glass group relative rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20"
	in:scale={{ duration: 200, start: 0.95 }}
	out:fade={{ duration: 150 }}
>
	<!-- Remove button -->
	<button
		onclick={handleRemove}
		class="absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface-700 text-surface-400 opacity-0 shadow-lg transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
		aria-label="Remove video"
	>
		<X class="h-4 w-4" />
	</button>

	<!-- Thumbnail -->
	<div
		class="relative w-full aspect-video overflow-hidden rounded-t-2xl bg-surface-800"
	>
		<video
			src={item.compressedUrl || item.originalUrl}
			class="h-full w-full object-cover"
			muted
			preload="metadata"
		/>
		
		{#if item.status === 'processing'}
			<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
				<Loader2 class="h-10 w-10 text-white animate-spin mb-2" />
				<span class="text-white text-sm font-medium">{item.progress}%</span>
			</div>
		{:else}
			<!-- Play button overlay -->
			<button
				onclick={() => showPreview = true}
				class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<div class="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
					<Play class="h-6 w-6 text-surface-800 ml-1" fill="currentColor" />
				</div>
			</button>
		{/if}
		
		<!-- Savings badge overlay -->
		{#if item.status === 'completed'}
			<div class="absolute top-3 right-3">
				{#if isPositiveSavings}
					<span class="flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg">
						<Check class="h-4 w-4" />
						-{savings}%
					</span>
				{:else}
					<span class="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg">
						+{Math.abs(savings)}%
					</span>
				{/if}
			</div>
		{/if}

		<!-- Duration badge -->
		{#if item.duration}
			<div class="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
				{formatDuration(item.duration)}
			</div>
		{/if}

		<!-- Resolution badge -->
		{#if item.width && item.height}
			<div class="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
				{item.width}×{item.height}
			</div>
		{/if}
	</div>

	<!-- Info section -->
	<div class="p-4">
		<!-- Filename + Size -->
		<div class="flex items-center justify-between gap-3 mb-3">
			<p class="truncate text-sm font-medium text-surface-100" title={item.name}>
				{item.name}
			</p>
			{#if item.status === 'completed' && item.compressedSize}
				<span class="flex-shrink-0 text-sm font-mono text-accent-start font-semibold">
					{formatBytes(item.compressedSize)}
				</span>
			{/if}
		</div>

		<!-- Status / Progress -->
		{#if item.status === 'pending'}
			<p class="text-sm text-surface-500">Waiting...</p>
		{:else if item.status === 'processing'}
			<div class="h-2 w-full overflow-hidden rounded-full bg-surface-700">
				<div
					class="h-full rounded-full bg-gradient-to-r from-accent-start to-accent-end transition-all duration-300"
					style="width: {item.progress}%"
				></div>
			</div>
		{:else if item.status === 'error'}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2 text-sm text-red-500">
					<AlertCircle class="h-4 w-4" />
					<span>Failed</span>
				</div>
				<button
					onclick={handleRetry}
					class="flex items-center gap-1.5 rounded-lg bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/50"
				>
					<RotateCcw class="h-4 w-4" />
					Retry
				</button>
			</div>
		{:else if item.status === 'completed'}
			<!-- Format + Actions row -->
			<div class="flex items-center justify-between">
				<!-- Format selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium uppercase text-surface-400">
						{item.format}
					</span>
					<ArrowRight class="h-3.5 w-3.5 text-surface-400" />
					<!-- Format dropdown -->
					<div class="relative">
						<button
							onclick={() => showFormatMenu = !showFormatMenu}
							class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r {getCurrentFormatColor()} px-2.5 py-1 text-xs font-bold uppercase text-white transition-all hover:opacity-90"
						>
							{item.outputFormat}
							<ChevronDown class="h-3.5 w-3.5" />
						</button>
						
						{#if showFormatMenu}
							<button
								class="fixed inset-0 z-40 cursor-default"
								onclick={() => showFormatMenu = false}
								aria-label="Close menu"
							></button>
							<div
								class="absolute left-0 bottom-full z-50 mb-2 min-w-[120px] overflow-hidden rounded-xl bg-surface-800 shadow-xl ring-1 ring-white/10"
								in:scale={{ duration: 150, start: 0.95 }}
								out:fade={{ duration: 100 }}
							>
								{#each availableFormats as format}
									<button
										onclick={() => handleFormatChange(format.value)}
										class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-700 {item.outputFormat === format.value ? 'bg-surface-700/50' : ''}"
									>
										<span class="h-2.5 w-2.5 rounded-full bg-gradient-to-r {format.color}"></span>
										<span class="font-medium text-surface-300">{format.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Action buttons -->
				<div class="flex items-center gap-2">
					<button
						onclick={handleDownload}
						class="flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-accent-start to-accent-end px-3 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-md"
						aria-label="Download"
					>
						<Download class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Video Preview Modal -->
{#if showPreview}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
		onclick={() => showPreview = false}
		onkeydown={(e) => e.key === 'Escape' && (showPreview = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<button
			onclick={() => showPreview = false}
			class="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
			aria-label="Close preview"
		>
			<X class="h-6 w-6" />
		</button>
		<video
			src={item.compressedUrl || item.originalUrl}
			class="max-h-[85vh] max-w-[95vw] rounded-2xl shadow-2xl"
			controls
			autoplay
			onclick={(e) => e.stopPropagation()}
		/>
	</div>
{/if}
