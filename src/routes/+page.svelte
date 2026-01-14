<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import VideoList from '$lib/components/VideoList.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import { videos } from '$lib/stores/videos.svelte';
	import { Download, Trash2, Film, Zap, Shield, Gauge, ArrowDown } from 'lucide-svelte';
	import { downloadAllAsZip } from '$lib/utils/download';
	import { fade, fly } from 'svelte/transition';

	let showClearConfirm = $state(false);

	const hasVideos = $derived(videos.items.length > 0);
	const completedCount = $derived(videos.items.filter((i) => i.status === 'completed').length);
	const totalSaved = $derived(
		videos.items
			.filter((i) => i.status === 'completed' && i.compressedSize)
			.reduce((acc, i) => acc + (i.originalSize - (i.compressedSize || 0)), 0)
	);
	const savingsPercent = $derived(
		videos.items.length > 0
			? Math.round(
					(totalSaved /
						videos.items
							.filter((i) => i.status === 'completed')
							.reduce((acc, i) => acc + i.originalSize, 0)) *
						100
				) || 0
			: 0
	);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async function handleDownloadAll() {
		const completedVideos = videos.items.filter((i) => i.status === 'completed' && i.compressedBlob);
		if (completedVideos.length > 0) {
			await downloadAllAsZip(completedVideos);
		}
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
			e.preventDefault();
			handleDownloadAll();
		}
		if (e.key === 'Escape' && hasVideos) {
			showClearConfirm = true;
		}
	}

	const features = [
		{
			icon: Zap,
			title: 'Lightning Fast',
			description: 'FFmpeg-powered compression in your browser'
		},
		{
			icon: Shield,
			title: '100% Private',
			description: 'Videos never leave your device'
		},
		{
			icon: Gauge,
			title: 'Pro Codecs',
			description: 'H.264, VP9, and more'
		}
	];
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex min-h-screen flex-col">
	<Header />

	<!-- Background decoration -->
	<div class="fixed inset-0 -z-10 overflow-hidden">
		<div
			class="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-accent-start/10 to-accent-end/10 blur-3xl"
		></div>
		<div
			class="absolute -bottom-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-accent-end/10 to-accent-start/10 blur-3xl"
		></div>
	</div>

	<main class="flex-1 px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-8 sm:pb-12">
		<div class="mx-auto max-w-7xl">
			<!-- Hero Section -->
			{#if !hasVideos}
				<div class="mb-8 sm:mb-12 text-center" in:fade={{ duration: 300 }}>
					<div class="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-start/10 px-4 py-1.5 text-sm font-medium text-accent-start">
						<Film class="h-4 w-4" />
						Free & Open Source
					</div>
					<h1 class="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
						<span class="gradient-text">Compress</span> your videos
						<br class="hidden sm:block" />
						<span class="text-surface-400">in your browser</span>
					</h1>
					<p class="mx-auto max-w-2xl text-base sm:text-lg text-surface-500 leading-relaxed">
						Compress MP4, WebM, MOV, and AVI with powerful FFmpeg codecs.
						<span class="font-medium text-surface-300">100% private</span>
						— everything runs locally.
					</p>

					<!-- Feature Cards -->
					<div class="mt-10 sm:mt-12 grid gap-4 sm:gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
						{#each features as feature, i}
							<div
								class="glass group flex items-center gap-4 rounded-2xl p-5 sm:p-6 text-left transition-all hover:scale-[1.02]"
								in:fly={{ y: 20, delay: 100 * i, duration: 300 }}
							>
								<div
									class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-start/20 to-accent-end/20 text-accent-start"
								>
									<feature.icon class="h-6 w-6" />
								</div>
								<div>
									<h3 class="text-base font-semibold text-surface-100">
										{feature.title}
									</h3>
									<p class="text-sm text-surface-500 mt-0.5">{feature.description}</p>
								</div>
							</div>
						{/each}
					</div>

					<!-- Scroll hint -->
					<div class="mt-10 flex items-center justify-center gap-2 text-surface-400">
						<span class="text-sm uppercase tracking-wider">Drop videos below</span>
						<ArrowDown class="h-4 w-4 animate-bounce" />
					</div>
				</div>
			{/if}

			<!-- Stats bar when there are videos -->
			{#if hasVideos}
				<div
					class="glass mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-4 sm:gap-6 rounded-2xl p-4 sm:p-6"
					in:fade={{ duration: 200 }}
				>
					<div class="flex flex-wrap items-center gap-4 sm:gap-8">
						<div class="flex items-center gap-3">
							<Film class="h-6 w-6 text-accent-start" />
							<span class="text-base text-surface-500">
								<span class="font-semibold text-surface-100 text-lg"
									>{completedCount}</span
								>
								of {videos.items.length} compressed
							</span>
						</div>
						{#if totalSaved > 0}
							<div class="flex items-center gap-4">
								<div class="text-base text-surface-500">
									Saved:
									<span class="font-mono font-semibold text-accent-start text-lg"
										>{formatBytes(totalSaved)}</span
									>
								</div>
								<span
									class="rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-500"
								>
									-{savingsPercent}%
								</span>
							</div>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if completedCount > 0}
							<button
								onclick={handleDownloadAll}
								class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-start to-accent-end px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent-start/30 transition-all hover:shadow-xl hover:shadow-accent-start/40 hover:scale-105"
							>
								<Download class="h-5 w-5" />
								<span class="hidden sm:inline">Download All</span>
								<span class="sm:hidden">ZIP</span>
							</button>
						{/if}
						<button
							onclick={() => showClearConfirm = true}
							class="flex items-center gap-2 rounded-xl bg-surface-800 px-5 py-2.5 text-sm font-medium text-surface-400 transition-all hover:bg-red-900/20 hover:text-red-400"
							title="Press Escape to clear"
						>
							<Trash2 class="h-5 w-5" />
							<span class="hidden sm:inline">Clear All</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- Settings Panel -->
			{#if hasVideos}
				<Settings />
			{/if}

			<!-- Drop Zone -->
			<DropZone />

			<!-- Video List -->
			{#if hasVideos}
				<VideoList />
			{/if}
		</div>
	</main>

	<Footer />
</div>

<!-- Clear All Confirmation Modal -->
<ConfirmModal
	open={showClearConfirm}
	title="Clear all videos?"
	message="This will remove all {videos.items.length} videos from the list. This action cannot be undone."
	confirmText="Clear All"
	onconfirm={() => {
		videos.clearAll();
		showClearConfirm = false;
	}}
	oncancel={() => showClearConfirm = false}
/>
