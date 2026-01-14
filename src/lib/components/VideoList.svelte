<script lang="ts">
	import { videos } from '$lib/stores/videos.svelte';
	import VideoCard from './VideoCard.svelte';
</script>

<div class="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
	{#each videos.items as item (item.id)}
		<VideoCard {item} />
	{/each}
</div>
