<script lang="ts">
	import { videos, type VideoItem, type OutputFormat, suggestOptimalSettings, estimateFileSize, getEffectiveDuration, QUALITY_PRESETS } from '$lib/stores/videos.svelte';
	import { downloadVideo } from '$lib/utils/download';
	import { reprocessVideo, generatePreview, getOutputFilename } from '$lib/utils/compress';
	import {
		Download,
		X,
		AlertCircle,
		Check,
		Loader2,
		ArrowRight,
		ChevronDown,
		RotateCcw,
		Play,
		SplitSquareHorizontal,
		Lightbulb,
		Clock,
		Eye,
		Gpu,
		Server,
		Scissors,
		GripVertical
	} from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import VideoComparison from './VideoComparison.svelte';

	let { item }: { item: VideoItem } = $props();

	let showFormatMenu = $state(false);
	let showPreview = $state(false);
	let showComparison = $state(false);
	let showSuggestion = $state(false);
	let isGeneratingPreview = $state(false);
	let showTrimUI = $state(false);
	let trimStartInput = $state('');
	let trimEndInput = $state('');

	const savings = $derived(
		item.compressedSize ? Math.round((1 - item.compressedSize / item.originalSize) * 100) : 0
	);

	const isPositiveSavings = $derived(savings > 0);
	const suggestion = $derived(suggestOptimalSettings(item));
	
	// Estimated file size for pending items
	const estimatedSize = $derived(
		item.status === 'pending' ? estimateFileSize(item, videos.settings) : 0
	);
	
	// Effective duration (considering trim)
	const effectiveDuration = $derived(getEffectiveDuration(item));
	
	// Whether item has custom trim settings
	const hasTrim = $derived(item.trimStart !== undefined || item.trimEnd !== undefined);
	
	// Initialize trim inputs when showing UI
	$effect(() => {
		if (showTrimUI && item.duration) {
			trimStartInput = formatTimeInput(item.trimStart || 0);
			trimEndInput = formatTimeInput(item.trimEnd ?? item.duration);
		}
	});

	const availableFormats: { value: OutputFormat; label: string; color: string }[] = [
		{ value: 'mp4', label: 'MP4', color: 'from-orange-500 to-red-500' },
		{ value: 'webm', label: 'WebM', color: 'from-green-500 to-emerald-500' },
		{ value: 'av1', label: 'AV1', color: 'from-purple-500 to-pink-500' }
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

	function formatETA(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	}

	function formatTimeInput(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function parseTimeInput(timeStr: string): number | null {
		// Handle MM:SS format
		const parts = timeStr.split(':');
		if (parts.length === 2) {
			const mins = parseInt(parts[0], 10);
			const secs = parseInt(parts[1], 10);
			if (!isNaN(mins) && !isNaN(secs)) {
				return mins * 60 + secs;
			}
		}
		// Handle raw seconds
		const secs = parseFloat(timeStr);
		if (!isNaN(secs)) return secs;
		return null;
	}

	function handleTrimUpdate() {
		const start = parseTimeInput(trimStartInput);
		const end = parseTimeInput(trimEndInput);
		const maxDuration = item.duration || 0;

		const newStart = start !== null ? Math.max(0, Math.min(start, maxDuration)) : undefined;
		const newEnd = end !== null ? Math.max(0, Math.min(end, maxDuration)) : undefined;

		// Validate: start must be before end
		if (newStart !== undefined && newEnd !== undefined && newStart >= newEnd) {
			return; // Invalid range
		}

		videos.updateItem(item.id, {
			trimStart: newStart,
			trimEnd: newEnd
		});
	}

	function clearTrim() {
		videos.updateItem(item.id, {
			trimStart: undefined,
			trimEnd: undefined
		});
		showTrimUI = false;
	}

	// Drag-out to save functionality
	function handleDragStart(e: DragEvent) {
		if (!item.compressedBlob || !item.compressedUrl) return;

		// Set the download URL for native drag-out-to-save
		const filename = getOutputFilename(item.name, item.outputFormat);
		const mimeType = item.outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
		
		// Chrome/Edge support DownloadURL
		e.dataTransfer?.setData('DownloadURL', `${mimeType}:${filename}:${item.compressedUrl}`);
		
		// Also set text/plain as fallback
		e.dataTransfer?.setData('text/plain', item.compressedUrl);
		
		// Set drag image
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'copy';
		}
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
		const format = availableFormats.find((f) => f.value === item.outputFormat);
		return format?.color || 'from-gray-500 to-gray-600';
	}

	async function handleGeneratePreview() {
		if (isGeneratingPreview) return;
		isGeneratingPreview = true;
		const previewUrl = await generatePreview(item.id);
		isGeneratingPreview = false;
		if (previewUrl) {
			showPreview = true;
		}
	}

	function applySuggestion() {
		videos.updateSettings({
			quality: suggestion.preset,
			outputFormat: suggestion.format,
			resolution: suggestion.resolution
		});
		videos.updateItem(item.id, { outputFormat: suggestion.format });
		showSuggestion = false;
	}
</script>

<div
	class="glass group relative rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20"
	in:scale={{ duration: 200, start: 0.95 }}
	out:fade={{ duration: 150 }}
	draggable={item.status === 'completed' && !!item.compressedBlob}
	ondragstart={handleDragStart}
	role={item.status === 'completed' && item.compressedBlob ? 'listitem' : undefined}
>
	<!-- Remove button -->
	<button
		onclick={handleRemove}
		class="absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface-700 text-surface-400 opacity-0 shadow-lg transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
		aria-label="Remove video"
	>
		<X class="h-4 w-4" />
	</button>

	<!-- Suggestion button (for pending items) -->
	{#if item.status === 'pending' && item.bitrate}
		<button
			onclick={() => (showSuggestion = !showSuggestion)}
			class="absolute -top-2 left-4 z-10 flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-all hover:bg-amber-600 group-hover:opacity-100"
			aria-label="Smart suggestion"
		>
			<Lightbulb class="h-3.5 w-3.5" />
			Suggestion
		</button>
	{/if}

	<!-- Suggestion popup -->
	{#if showSuggestion}
		<div
			class="absolute top-8 left-4 z-20 w-64 rounded-xl bg-surface-800 p-4 shadow-xl ring-1 ring-white/10"
			in:scale={{ duration: 150, start: 0.95 }}
			out:fade={{ duration: 100 }}
		>
			<div class="flex items-start gap-2 mb-3">
				<Lightbulb class="h-5 w-5 text-amber-500 flex-shrink-0" />
				<div>
					<p class="text-sm font-medium text-surface-200">Recommended Settings</p>
					<p class="text-xs text-surface-400 mt-1">{suggestion.note}</p>
				</div>
			</div>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-surface-400">Quality:</span>
					<span class="font-medium text-surface-200">{suggestion.preset}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-surface-400">Format:</span>
					<span class="font-medium text-surface-200">{suggestion.format.toUpperCase()}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-surface-400">Resolution:</span>
					<span class="font-medium text-surface-200">{suggestion.resolution}</span>
				</div>
			</div>
			<button
				onclick={applySuggestion}
				class="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
			>
				Apply Settings
			</button>
		</div>
	{/if}

	<!-- Thumbnail -->
	<div class="relative w-full aspect-video overflow-hidden rounded-t-2xl bg-surface-800">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={item.compressedUrl || item.originalUrl}
			class="h-full w-full object-cover"
			muted
			preload="metadata"
		></video>

		{#if item.status === 'processing'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
			>
				<Loader2 class="h-10 w-10 text-white animate-spin mb-2" />
				<span class="text-white text-sm font-medium">{item.progress}%</span>
				{#if item.progressStage}
					<span class="text-white/70 text-xs mt-1">{item.progressStage}</span>
				{/if}
				{#if item.eta && item.eta > 0}
					<div class="flex items-center gap-1.5 text-white/60 text-xs mt-2">
						<Clock class="h-3 w-3" />
						<span>~{formatETA(item.eta)} remaining</span>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Play button overlay -->
			<button
				onclick={() => (showPreview = true)}
				class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<div
					class="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg"
				>
					<Play class="h-6 w-6 text-surface-800 ml-1" fill="currentColor" />
				</div>
			</button>
		{/if}

		<!-- Savings badge overlay -->
		{#if item.status === 'completed'}
			<div class="absolute top-3 right-3">
				{#if isPositiveSavings}
					<span
						class="flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg"
					>
						<Check class="h-4 w-4" />
						-{savings}%
					</span>
				{:else}
					<span
						class="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg"
					>
						+{Math.abs(savings)}%
					</span>
				{/if}
			</div>
		{/if}

		<!-- Duration badge -->
		{#if item.duration}
			<div
				class="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white {hasTrim ? 'ring-1 ring-purple-500/50' : ''}"
			>
				{#if hasTrim}
					<span class="text-purple-300">{formatDuration(effectiveDuration)}</span>
					<span class="text-surface-400 mx-1">/</span>
					<span class="text-surface-400">{formatDuration(item.duration)}</span>
				{:else}
					{formatDuration(item.duration)}
				{/if}
			</div>
		{/if}

		<!-- Drag indicator for completed items -->
		{#if item.status === 'completed' && item.compressedBlob}
			<div
				class="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
				title="Drag to save file"
			>
				<GripVertical class="h-3 w-3" />
				<span>Drag to save</span>
			</div>
		{/if}

		<!-- Resolution badge -->
		{#if item.width && item.height}
			<div
				class="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white"
			>
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
			<div class="space-y-2">
				<!-- Estimated size and trim toggle -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if estimatedSize > 0}
							<span class="text-sm text-surface-400">
								~{formatBytes(estimatedSize)}
							</span>
						{:else}
							<span class="text-sm text-surface-500">Waiting...</span>
						{/if}
						{#if hasTrim}
							<span class="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
								Trimmed
							</span>
						{/if}
					</div>
					{#if item.duration}
						<button
							onclick={() => (showTrimUI = !showTrimUI)}
							class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all {showTrimUI || hasTrim
								? 'bg-purple-500/20 text-purple-400'
								: 'text-surface-400 hover:bg-surface-700 hover:text-surface-200'}"
							title="Trim video"
						>
							<Scissors class="h-3.5 w-3.5" />
							Trim
						</button>
					{/if}
				</div>

				<!-- Trim UI -->
				{#if showTrimUI && item.duration}
					<div
						class="rounded-lg bg-surface-800/50 p-3 space-y-2"
						transition:fade={{ duration: 100 }}
					>
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<label for="trim-start-{item.id}" class="text-xs text-surface-500 block mb-1">Start</label>
								<input
									id="trim-start-{item.id}"
									type="text"
									class="w-full rounded bg-surface-700 px-2 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:ring-1 focus:ring-accent-start focus:outline-none"
									placeholder="0:00"
									bind:value={trimStartInput}
									onblur={handleTrimUpdate}
									onkeydown={(e) => e.key === 'Enter' && handleTrimUpdate()}
								/>
							</div>
							<div class="flex-1">
								<label for="trim-end-{item.id}" class="text-xs text-surface-500 block mb-1">End</label>
								<input
									id="trim-end-{item.id}"
									type="text"
									class="w-full rounded bg-surface-700 px-2 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:ring-1 focus:ring-accent-start focus:outline-none"
									placeholder={formatTimeInput(item.duration)}
									bind:value={trimEndInput}
									onblur={handleTrimUpdate}
									onkeydown={(e) => e.key === 'Enter' && handleTrimUpdate()}
								/>
							</div>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="text-surface-500">
								Duration: {formatDuration(effectiveDuration)}
							</span>
							{#if hasTrim}
								<button
									onclick={clearTrim}
									class="text-red-400 hover:text-red-300"
								>
									Clear trim
								</button>
							{/if}
						</div>
					</div>
				{/if}
			</div>
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
							onclick={() => (showFormatMenu = !showFormatMenu)}
							class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r {getCurrentFormatColor()} px-2.5 py-1 text-xs font-bold uppercase text-white transition-all hover:opacity-90"
						>
							{item.outputFormat === 'av1' ? 'AV1' : item.outputFormat}
							<ChevronDown class="h-3.5 w-3.5" />
						</button>

						{#if showFormatMenu}
							<button
								class="fixed inset-0 z-40 cursor-default"
								onclick={() => (showFormatMenu = false)}
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
										class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-700 {item.outputFormat ===
										format.value
											? 'bg-surface-700/50'
											: ''}"
									>
										<span class="h-2.5 w-2.5 rounded-full bg-gradient-to-r {format.color}"
										></span>
										<span class="font-medium text-surface-300">{format.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Action buttons -->
				<div class="flex items-center gap-2">
					<!-- Compare button -->
					{#if item.compressedUrl}
						<button
							onclick={() => (showComparison = true)}
							class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700 text-surface-400 transition-all hover:bg-surface-600 hover:text-surface-200"
							aria-label="Compare original and compressed"
							title="Compare"
						>
							<SplitSquareHorizontal class="h-4 w-4" />
						</button>
					{/if}

					<!-- Download button -->
					<button
						onclick={handleDownload}
						class="flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-accent-start to-accent-end px-3 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-md"
						aria-label="Download"
					>
						<Download class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Compression stats -->
			{#if item.compressionDuration}
				<div class="mt-2 flex items-center gap-2 text-xs text-surface-500">
					{#if item.encoderUsed === 'webcodecs'}
						<span class="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-purple-400">
							<Gpu class="h-3 w-3" />
							GPU
						</span>
					{:else if item.encoderUsed === 'ffmpeg'}
						<span class="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-400">
							<Server class="h-3 w-3" />
							Software
						</span>
					{/if}
					<span>{(item.compressionDuration / 1000).toFixed(1)}s</span>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Video Preview Modal -->
{#if showPreview}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
		onclick={() => (showPreview = false)}
		onkeydown={(e) => e.key === 'Escape' && (showPreview = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<button
			onclick={() => (showPreview = false)}
			class="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
			aria-label="Close preview"
		>
			<X class="h-6 w-6" />
		</button>
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			src={item.compressedUrl || item.originalUrl}
			class="max-h-[85vh] max-w-[95vw] rounded-2xl shadow-2xl"
			controls
			autoplay
			onclick={(e) => e.stopPropagation()}
		></video>
	</div>
{/if}

<!-- Video Comparison Modal -->
{#if showComparison && item.compressedUrl && item.compressedSize}
	<VideoComparison
		originalUrl={item.originalUrl}
		compressedUrl={item.compressedUrl}
		originalSize={item.originalSize}
		compressedSize={item.compressedSize}
		onclose={() => (showComparison = false)}
	/>
{/if}
