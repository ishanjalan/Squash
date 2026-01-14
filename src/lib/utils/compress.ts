import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { videos, QUALITY_PRESETS, type VideoItem, type OutputFormat } from '$lib/stores/videos.svelte';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;

// Load FFmpeg WASM
async function loadFFmpeg(onProgress?: (progress: number) => void) {
	if (ffmpegLoaded && ffmpeg) return ffmpeg;
	if (ffmpegLoading) {
		// Wait for existing load to complete
		while (ffmpegLoading) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		return ffmpeg!;
	}

	ffmpegLoading = true;
	
	try {
		ffmpeg = new FFmpeg();
		
		ffmpeg.on('progress', ({ progress }) => {
			onProgress?.(Math.round(progress * 100));
		});

		// Load FFmpeg core from CDN
		const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
		
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
		});

		ffmpegLoaded = true;
		console.log('FFmpeg loaded successfully');
		return ffmpeg;
	} catch (error) {
		console.error('Failed to load FFmpeg:', error);
		throw error;
	} finally {
		ffmpegLoading = false;
	}
}

// Processing queue
let isProcessing = false;
const queue: string[] = [];

export async function processVideos(ids: string[]) {
	queue.push(...ids);
	if (!isProcessing) {
		processQueue();
	}
}

async function processQueue() {
	if (queue.length === 0) {
		isProcessing = false;
		return;
	}

	isProcessing = true;

	// Process videos sequentially (FFmpeg can only process one at a time)
	while (queue.length > 0) {
		const id = queue.shift()!;
		const item = videos.getItemById(id);
		if (item && item.status === 'pending') {
			await compressVideo(item);
		}
	}

	isProcessing = false;
}

async function compressVideo(item: VideoItem) {
	try {
		videos.updateItem(item.id, { status: 'processing', progress: 0 });

		// Load FFmpeg with progress callback
		const ff = await loadFFmpeg((progress) => {
			// Loading progress (0-20%)
			videos.updateItem(item.id, { progress: Math.min(20, progress / 5) });
		});

		videos.updateItem(item.id, { progress: 20 });

		const quality = videos.settings.quality;
		const preset = QUALITY_PRESETS[quality];
		const outputFormat = item.outputFormat;

		// Input/output filenames
		const inputExt = item.name.split('.').pop() || 'mp4';
		const inputFilename = `input.${inputExt}`;
		const outputFilename = `output.${outputFormat}`;

		// Write input file to FFmpeg virtual filesystem
		const fileData = await fetchFile(item.file);
		await ff.writeFile(inputFilename, fileData);

		videos.updateItem(item.id, { progress: 30 });

		// Set up progress tracking for compression
		ff.on('progress', ({ progress }) => {
			// Compression progress (30-90%)
			const compressionProgress = 30 + Math.round(progress * 60);
			videos.updateItem(item.id, { progress: Math.min(90, compressionProgress) });
		});

		// Build FFmpeg command based on output format
		let ffmpegArgs: string[];

		if (outputFormat === 'webm') {
			// WebM with VP9 codec
			ffmpegArgs = [
				'-i', inputFilename,
				'-c:v', 'libvpx-vp9',
				'-crf', preset.crf.toString(),
				'-b:v', preset.targetBitrate,
				'-c:a', 'libopus',
				'-b:a', '128k',
				'-y',
				outputFilename
			];
		} else {
			// MP4 with H.264 codec
			ffmpegArgs = [
				'-i', inputFilename,
				'-c:v', 'libx264',
				'-crf', preset.crf.toString(),
				'-preset', 'medium',
				'-c:a', 'aac',
				'-b:a', '128k',
				'-movflags', '+faststart',
				'-y',
				outputFilename
			];
		}

		// Run compression
		await ff.exec(ffmpegArgs);

		videos.updateItem(item.id, { progress: 90 });

		// Read output file
		const outputData = await ff.readFile(outputFilename);
		
		// Clean up virtual filesystem
		await ff.deleteFile(inputFilename);
		await ff.deleteFile(outputFilename);

		// Create blob from output
		const mimeType = outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
		const compressedBlob = new Blob([outputData], { type: mimeType });
		const compressedUrl = URL.createObjectURL(compressedBlob);

		videos.updateItem(item.id, {
			status: 'completed',
			progress: 100,
			compressedSize: compressedBlob.size,
			compressedUrl,
			compressedBlob
		});
	} catch (error) {
		console.error('Compression error:', error);
		videos.updateItem(item.id, {
			status: 'error',
			error: error instanceof Error ? error.message : 'Compression failed'
		});
	}
}

export function getOutputExtension(format: OutputFormat): string {
	return `.${format}`;
}

export function getOutputFilename(originalName: string, format: OutputFormat): string {
	const baseName = originalName.replace(/\.[^/.]+$/, '');
	return `${baseName}-compressed${getOutputExtension(format)}`;
}

// Re-process a single video with new settings
export async function reprocessVideo(id: string) {
	const item = videos.getItemById(id);
	if (!item) return;

	// Clean up old compressed URL
	if (item.compressedUrl) {
		URL.revokeObjectURL(item.compressedUrl);
	}

	// Reset status
	videos.updateItem(id, {
		status: 'pending',
		progress: 0,
		compressedSize: undefined,
		compressedUrl: undefined,
		compressedBlob: undefined
	});

	// Get fresh item reference
	const updatedItem = videos.getItemById(id);
	if (updatedItem) {
		await compressVideo(updatedItem);
	}
}

// Re-process all completed videos with current settings
export async function reprocessAllVideos() {
	const completedItems = videos.items.filter(i => i.status === 'completed');
	
	if (completedItems.length === 0) return;

	// Reset all completed items to pending
	for (const item of completedItems) {
		if (item.compressedUrl) {
			URL.revokeObjectURL(item.compressedUrl);
		}
		
		videos.updateItem(item.id, {
			outputFormat: videos.settings.outputFormat,
			status: 'pending',
			progress: 0,
			compressedSize: undefined,
			compressedUrl: undefined,
			compressedBlob: undefined
		});
	}

	// Process all items sequentially
	for (const item of completedItems) {
		const updatedItem = videos.getItemById(item.id);
		if (updatedItem && updatedItem.status === 'pending') {
			await compressVideo(updatedItem);
		}
	}
}
