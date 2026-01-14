<script lang="ts">
	import { videos, QUALITY_PRESETS, type OutputFormat } from '$lib/stores/videos.svelte';
	import { reprocessAllVideos } from '$lib/utils/compress';
	import { Settings2, RefreshCw } from 'lucide-svelte';

	const formats: { value: OutputFormat; label: string }[] = [
		{ value: 'mp4', label: 'MP4' },
		{ value: 'webm', label: 'WebM' }
	];

	const presets = Object.entries(QUALITY_PRESETS).map(([key, value]) => ({
		key: key as keyof typeof QUALITY_PRESETS,
		...value
	}));

	let isReprocessing = $state(false);
	const hasCompletedVideos = $derived(videos.items.some(i => i.status === 'completed'));

	function handlePresetClick(key: keyof typeof QUALITY_PRESETS) {
		videos.updateSettings({ quality: key });
	}

	function handleFormatChange(format: OutputFormat) {
		videos.updateSettings({ outputFormat: format });
	}

	async function handleRecompressAll() {
		isReprocessing = true;
		await reprocessAllVideos();
		isReprocessing = false;
	}

	const currentPreset = $derived(presets.find(p => p.key === videos.settings.quality));
</script>

<div class="glass mb-6 sm:mb-8 rounded-2xl p-4 sm:p-6">
	<div class="flex flex-wrap items-center gap-x-6 gap-y-4 lg:gap-x-8">
		<!-- Quality Presets -->
		<div class="flex items-center gap-3">
			<span class="text-sm font-medium text-surface-400 uppercase tracking-wide">Quality</span>
			<div class="flex gap-1.5">
				{#each presets as preset}
					<button
						onclick={() => handlePresetClick(preset.key)}
						class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all {videos.settings.quality === preset.key
							? 'bg-accent-start text-white shadow-md shadow-accent-start/30'
							: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
						title="{preset.desc} (CRF {preset.crf})"
					>
						{preset.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Divider -->
		<div class="hidden lg:block w-px h-6 bg-surface-700"></div>

		<!-- Output Format -->
		<div class="flex items-center gap-3">
			<Settings2 class="h-4 w-4 text-surface-400" />
			<div class="flex gap-1.5">
				{#each formats as format}
					<button
						onclick={() => handleFormatChange(format.value)}
						class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all {videos.settings.outputFormat === format.value
							? 'bg-accent-start text-white shadow-md shadow-accent-start/30'
							: 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'}"
					>
						{format.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Re-compress Button -->
		{#if hasCompletedVideos}
			<button
				onclick={handleRecompressAll}
				disabled={isReprocessing}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-accent-start text-white shadow-md shadow-accent-start/30 hover:shadow-lg hover:shadow-accent-start/40 transition-all disabled:opacity-50"
			>
				<RefreshCw class="h-4 w-4 {isReprocessing ? 'animate-spin' : ''}" />
				{isReprocessing ? 'Working...' : 'Re-compress All'}
			</button>
		{/if}
	</div>
</div>
