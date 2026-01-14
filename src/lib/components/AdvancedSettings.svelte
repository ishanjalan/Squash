<script lang="ts">
	import {
		videos,
		QUALITY_PRESETS,
		RESOLUTION_OPTIONS,
		AUDIO_BITRATE_OPTIONS,
		SIZE_PRESETS,
		estimateFileSize,
		type OutputFormat,
		type Resolution,
		type AudioCodec
	} from '$lib/stores/videos.svelte';
	import { reprocessAllVideos } from '$lib/utils/compress';
	import {
		Settings2,
		RefreshCw,
		ChevronDown,
		ChevronUp,
		Film,
		Volume2,
		Maximize,
		Zap,
		Trash2,
		Info,
		Target,
		HardDrive
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	const formats: { value: OutputFormat; label: string; desc: string; badge?: string }[] = [
		{ value: 'mp4', label: 'MP4', desc: 'H.264 • Universal compatibility' },
		{ value: 'webm', label: 'WebM', desc: 'VP9 • Modern browsers' },
		{ value: 'av1', label: 'AV1', desc: 'Best compression • Slower', badge: 'NEW' }
	];

	const audioCodecs: { value: AudioCodec; label: string; desc: string }[] = [
		{ value: 'aac', label: 'AAC', desc: 'Standard' },
		{ value: 'opus', label: 'Opus', desc: 'Modern' },
		{ value: 'mp3', label: 'MP3', desc: 'Legacy' },
		{ value: 'copy', label: 'Copy', desc: 'No re-encode' },
		{ value: 'none', label: 'None', desc: 'Remove audio' }
	];

	const encodingPresets = [
		{ value: 'ultrafast', label: 'Ultra Fast', speed: 5 },
		{ value: 'veryfast', label: 'Very Fast', speed: 4 },
		{ value: 'fast', label: 'Fast', speed: 3 },
		{ value: 'medium', label: 'Medium', speed: 2 },
		{ value: 'slow', label: 'Slow', speed: 1 },
		{ value: 'veryslow', label: 'Very Slow', speed: 0 }
	] as const;

	const presets = Object.entries(QUALITY_PRESETS).map(([key, value]) => ({
		key: key as keyof typeof QUALITY_PRESETS,
		...value
	}));

	const sizePresets = Object.entries(SIZE_PRESETS).map(([key, value]) => ({
		key,
		...value
	}));

	let isExpanded = $state(false);
	let isReprocessing = $state(false);
	let targetSizeInput = $state('');
	
	const hasCompletedVideos = $derived(videos.items.some((i) => i.status === 'completed'));
	const hasTargetSize = $derived(videos.settings.targetSizeMB !== undefined);
	
	// Calculate total estimated size for all pending videos
	const totalEstimatedSize = $derived(() => {
		const pendingItems = videos.items.filter((i) => i.status === 'pending');
		if (pendingItems.length === 0) return 0;
		
		return pendingItems.reduce((acc, item) => acc + estimateFileSize(item, videos.settings), 0);
	});
	
	// Initialize target size input when it changes
	$effect(() => {
		if (videos.settings.targetSizeMB !== undefined) {
			targetSizeInput = videos.settings.targetSizeMB.toString();
		}
	});

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function handlePresetClick(key: keyof typeof QUALITY_PRESETS) {
		// Clear target size when selecting a quality preset
		videos.updateSettings({ quality: key, targetSizeMB: undefined });
		targetSizeInput = '';
	}

	function handleFormatChange(format: OutputFormat) {
		videos.updateSettings({ outputFormat: format });
	}

	function handleTargetSizeChange() {
		const value = parseFloat(targetSizeInput);
		if (!isNaN(value) && value > 0) {
			videos.updateSettings({ targetSizeMB: value });
		} else {
			videos.updateSettings({ targetSizeMB: undefined });
		}
	}

	function handleSizePresetClick(sizeMB: number) {
		videos.updateSettings({ targetSizeMB: sizeMB });
		targetSizeInput = sizeMB.toString();
	}

	function clearTargetSize() {
		videos.updateSettings({ targetSizeMB: undefined });
		targetSizeInput = '';
	}

	function handleResolutionChange(resolution: Resolution) {
		videos.updateSettings({ resolution });
	}

	function handleAudioCodecChange(codec: AudioCodec) {
		videos.updateSettings({ audioCodec: codec });
	}

	function handleAudioBitrateChange(bitrate: (typeof AUDIO_BITRATE_OPTIONS)[number]['value']) {
		videos.updateSettings({ audioBitrate: bitrate });
	}

	function handleEncodingPresetChange(preset: (typeof encodingPresets)[number]['value']) {
		videos.updateSettings({ preset });
	}

	async function handleRecompressAll() {
		isReprocessing = true;
		await reprocessAllVideos();
		isReprocessing = false;
	}
</script>

<div class="glass mb-6 sm:mb-8 rounded-2xl overflow-hidden">
	<!-- Main settings row -->
	<div class="p-4 sm:p-6">
		<div class="flex flex-wrap items-center gap-x-6 gap-y-4 lg:gap-x-8">
			<!-- Quality Presets -->
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-surface-400 uppercase tracking-wide">Quality</span>
				<div class="flex gap-1.5">
					{#each presets as preset}
						<button
							onclick={() => handlePresetClick(preset.key)}
							class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all {videos.settings
								.quality === preset.key && !hasTargetSize
								? 'bg-accent-start text-white shadow-md shadow-accent-start/30'
								: hasTargetSize
									? 'text-surface-500 hover:text-surface-400 hover:bg-surface-700/30'
									: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
							title="{preset.desc} (CRF {preset.crf})"
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Target Size -->
			<div class="flex items-center gap-2">
				<span class="text-sm text-surface-500">or</span>
				<div class="relative flex items-center">
					<Target class="absolute left-2.5 h-4 w-4 text-surface-500" />
					<input
						type="text"
						class="w-20 rounded-lg bg-surface-800 border border-surface-700 pl-8 pr-2 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:ring-1 focus:ring-accent-start focus:border-accent-start focus:outline-none {hasTargetSize
							? 'ring-1 ring-accent-start border-accent-start'
							: ''}"
						placeholder="Size"
						bind:value={targetSizeInput}
						onblur={handleTargetSizeChange}
						onkeydown={(e) => e.key === 'Enter' && handleTargetSizeChange()}
					/>
					<span class="ml-1.5 text-sm text-surface-500">MB</span>
				</div>
				{#if hasTargetSize}
					<button
						onclick={clearTargetSize}
						class="text-xs text-surface-500 hover:text-surface-300"
					>
						Clear
					</button>
				{/if}
			</div>

			<!-- Quick size presets -->
			<div class="flex gap-1">
				{#each sizePresets as preset}
					<button
						onclick={() => handleSizePresetClick(preset.sizeMB)}
						class="px-2 py-1 text-xs rounded-md transition-all {videos.settings.targetSizeMB === preset.sizeMB
							? 'bg-accent-start/20 text-accent-start ring-1 ring-accent-start/50'
							: 'text-surface-500 hover:text-surface-300 hover:bg-surface-700/50'}"
						title="{preset.label} ({preset.sizeMB} MB)"
					>
						{preset.icon}
					</button>
				{/each}
			</div>

			<!-- Divider -->
			<div class="hidden lg:block w-px h-6 bg-surface-700"></div>

			<!-- Output Format -->
			<div class="flex items-center gap-3">
				<Film class="h-4 w-4 text-surface-400" />
				<div class="flex gap-1.5">
					{#each formats as format}
						<button
							onclick={() => handleFormatChange(format.value)}
							class="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all {videos
								.settings.outputFormat === format.value
								? 'bg-accent-start text-white shadow-md shadow-accent-start/30'
								: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
							title={format.desc}
						>
							{format.label}
							{#if format.badge}
								<span
									class="absolute -top-1 -right-1 px-1 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded"
								>
									{format.badge}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Estimated Size -->
			{#if totalEstimatedSize() > 0}
				<div class="flex items-center gap-2 text-sm">
					<HardDrive class="h-4 w-4 text-surface-500" />
					<span class="text-surface-400">
						~{formatBytes(totalEstimatedSize())}
					</span>
				</div>
			{/if}

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Advanced toggle -->
			<button
				onclick={() => (isExpanded = !isExpanded)}
				class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-surface-400 hover:text-surface-200 transition-colors"
			>
				<Settings2 class="h-4 w-4" />
				Advanced
				{#if isExpanded}
					<ChevronUp class="h-4 w-4" />
				{:else}
					<ChevronDown class="h-4 w-4" />
				{/if}
			</button>

			<!-- Re-compress Button -->
			{#if hasCompletedVideos}
				<button
					onclick={handleRecompressAll}
					disabled={isReprocessing}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-accent-start text-white shadow-md shadow-accent-start/30 hover:shadow-lg hover:shadow-accent-start/40 transition-all disabled:opacity-50"
				>
					<RefreshCw class="h-4 w-4 {isReprocessing ? 'animate-spin' : ''}" />
					{isReprocessing ? 'Working...' : 'Re-compress'}
				</button>
			{/if}
		</div>
	</div>

	<!-- Advanced settings panel -->
	{#if isExpanded}
		<div
			class="border-t border-surface-700/50 bg-surface-900/50 p-4 sm:p-6"
			transition:slide={{ duration: 200 }}
		>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Resolution -->
				<div>
					<div class="flex items-center gap-2 mb-3">
						<Maximize class="h-4 w-4 text-surface-400" />
						<span class="text-sm font-medium text-surface-300">Resolution</span>
					</div>
					<div class="grid grid-cols-2 gap-1.5">
						{#each RESOLUTION_OPTIONS as option}
							<button
								onclick={() => handleResolutionChange(option.value)}
								class="px-3 py-2 text-sm rounded-lg transition-all text-left {videos.settings
									.resolution === option.value
									? 'bg-accent-start/20 text-accent-start ring-1 ring-accent-start/50'
									: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
							>
								<div class="font-medium">{option.label}</div>
								{#if option.pixels}
									<div class="text-xs opacity-70">{option.pixels}</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Audio -->
				<div>
					<div class="flex items-center gap-2 mb-3">
						<Volume2 class="h-4 w-4 text-surface-400" />
						<span class="text-sm font-medium text-surface-300">Audio Codec</span>
					</div>
					<div class="grid grid-cols-2 gap-1.5">
						{#each audioCodecs as codec}
							<button
								onclick={() => handleAudioCodecChange(codec.value)}
								class="px-3 py-2 text-sm rounded-lg transition-all text-left {videos.settings
									.audioCodec === codec.value
									? 'bg-accent-start/20 text-accent-start ring-1 ring-accent-start/50'
									: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
							>
								<div class="font-medium">{codec.label}</div>
								<div class="text-xs opacity-70">{codec.desc}</div>
							</button>
						{/each}
					</div>

					<!-- Audio Bitrate -->
					{#if videos.settings.audioCodec !== 'none' && videos.settings.audioCodec !== 'copy'}
						<div class="mt-3">
							<span class="text-xs text-surface-500 mb-2 block">Bitrate</span>
							<div class="flex gap-1">
								{#each AUDIO_BITRATE_OPTIONS as option}
									<button
										onclick={() => handleAudioBitrateChange(option.value)}
										class="flex-1 px-2 py-1.5 text-xs rounded transition-all {videos.settings
											.audioBitrate === option.value
											? 'bg-accent-start text-white'
											: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
										title={option.desc}
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Encoding Speed -->
				<div>
					<div class="flex items-center gap-2 mb-3">
						<Zap class="h-4 w-4 text-surface-400" />
						<span class="text-sm font-medium text-surface-300">Encoding Speed</span>
					</div>
					<div class="space-y-1.5">
						{#each encodingPresets as preset}
							<button
								onclick={() => handleEncodingPresetChange(preset.value)}
								class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all {videos
									.settings.preset === preset.value
									? 'bg-accent-start/20 text-accent-start ring-1 ring-accent-start/50'
									: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
							>
								<span class="font-medium">{preset.label}</span>
								<div class="flex gap-0.5">
									{#each Array(5) as _, i}
										<div
											class="w-1.5 h-3 rounded-sm {i < preset.speed
												? 'bg-green-500'
												: 'bg-surface-600'}"
										></div>
									{/each}
								</div>
							</button>
						{/each}
					</div>
					<p class="mt-2 text-xs text-surface-500">
						Slower = better quality at same file size
					</p>
				</div>

				<!-- Options -->
				<div>
					<div class="flex items-center gap-2 mb-3">
						<Settings2 class="h-4 w-4 text-surface-400" />
						<span class="text-sm font-medium text-surface-300">Options</span>
					</div>
					<div class="space-y-3">
						<!-- Strip Metadata -->
						<label class="flex items-center gap-3 cursor-pointer group">
							<input
								type="checkbox"
								checked={videos.settings.stripMetadata}
								onchange={(e) =>
									videos.updateSettings({ stripMetadata: e.currentTarget.checked })}
								class="w-5 h-5 rounded bg-surface-700 border-surface-600 text-accent-start focus:ring-accent-start focus:ring-offset-surface-900"
							/>
							<div>
								<div
									class="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors"
								>
									Strip Metadata
								</div>
								<div class="text-xs text-surface-500">Remove EXIF, GPS, camera info</div>
							</div>
						</label>

						<!-- Two-Pass Encoding -->
						<label class="flex items-center gap-3 cursor-pointer group">
							<input
								type="checkbox"
								checked={videos.settings.twoPass}
								onchange={(e) => videos.updateSettings({ twoPass: e.currentTarget.checked })}
								class="w-5 h-5 rounded bg-surface-700 border-surface-600 text-accent-start focus:ring-accent-start focus:ring-offset-surface-900"
								disabled={videos.settings.outputFormat === 'webm'}
							/>
							<div>
								<div
									class="text-sm font-medium text-surface-300 group-hover:text-surface-100 transition-colors {videos
										.settings.outputFormat === 'webm'
										? 'opacity-50'
										: ''}"
								>
									Two-Pass Encoding
								</div>
								<div class="text-xs text-surface-500">
									Better quality, ~2x slower
									{#if videos.settings.outputFormat === 'webm'}
										<span class="text-amber-500">(N/A for WebM)</span>
									{/if}
								</div>
							</div>
						</label>
					</div>

					<!-- Info box -->
					<div class="mt-4 p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
						<div class="flex items-start gap-2">
							<Info class="h-4 w-4 text-surface-400 flex-shrink-0 mt-0.5" />
							<p class="text-xs text-surface-500">
								{#if videos.settings.outputFormat === 'av1'}
									AV1 offers 30-50% better compression than H.264 but is significantly slower
									to encode.
								{:else if videos.settings.outputFormat === 'webm'}
									VP9 provides excellent compression for web delivery with wide browser support.
								{:else}
									H.264/MP4 is the most compatible format, playable on virtually all devices.
								{/if}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
