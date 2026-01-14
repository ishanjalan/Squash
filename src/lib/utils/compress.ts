import {
	videos,
	QUALITY_PRESETS,
	type VideoItem,
	type OutputFormat,
	estimateCompressionTime,
	calculateBitrateForSize,
	getEffectiveDuration
} from '$lib/stores/videos.svelte';
import {
	isWebCodecsSupported,
	getWebCodecsCapabilities,
	encodeWithWebCodecs,
	isEncodingSupported,
	getRecommendedCodecs,
	type WebCodecsCapabilities,
	type WebCodecsVideoCodec,
	type WebCodecsAudioCodec
} from './webcodecs';

// Worker instance (for FFmpeg fallback)
let worker: Worker | null = null;
let workerReady = false;
let workerLoading = false;

// WebCodecs capabilities cache
let webCodecsCapabilities: WebCodecsCapabilities | null = null;

// Processing queue
let isProcessing = false;
const queue: string[] = [];

// Pending callbacks for worker responses
const pendingCallbacks = new Map<
	string,
	{
		resolve: (value: unknown) => void;
		reject: (reason: unknown) => void;
	}
>();

// Encoder type for tracking
export type EncoderType = 'webcodecs' | 'ffmpeg';

// Initialize and cache WebCodecs capabilities
export async function initWebCodecs(): Promise<WebCodecsCapabilities> {
	if (webCodecsCapabilities) return webCodecsCapabilities;
	
	webCodecsCapabilities = await getWebCodecsCapabilities();
	console.log('WebCodecs capabilities:', webCodecsCapabilities);
	return webCodecsCapabilities;
}

// Determine the best encoder for the given video and settings
export async function selectEncoder(
	video: VideoItem,
	outputFormat: OutputFormat
): Promise<{ encoder: EncoderType; reason: string }> {
	// AV1 output always uses FFmpeg (WebCodecs AV1 encoding is very slow)
	if (outputFormat === 'av1') {
		return { encoder: 'ffmpeg', reason: 'AV1 encoding optimized for FFmpeg' };
	}

	// Check WebCodecs support
	const capabilities = await initWebCodecs();

	if (!capabilities.supported) {
		return { encoder: 'ffmpeg', reason: 'WebCodecs not supported in this browser' };
	}

	// Map output format to WebCodecs codecs
	const webCodecsFormat = outputFormat === 'mp4' ? 'mp4' : 'webm';
	const { video: videoCodec, audio: audioCodec } = getRecommendedCodecs(webCodecsFormat);

	// Check if the specific codec is supported
	if (!capabilities.supportedVideoCodecs.includes(videoCodec)) {
		return { encoder: 'ffmpeg', reason: `${videoCodec.toUpperCase()} codec not supported` };
	}

	// Check resolution support
	const targetWidth = video.width || 1920;
	const targetHeight = video.height || 1080;

	if (
		targetWidth > capabilities.maxResolution.width ||
		targetHeight > capabilities.maxResolution.height
	) {
		return { encoder: 'ffmpeg', reason: 'Resolution exceeds WebCodecs limits' };
	}

	// Check if the full encoding configuration is supported
	const isSupported = await isEncodingSupported(
		videoCodec,
		audioCodec,
		targetWidth,
		targetHeight
	);

	if (!isSupported) {
		return { encoder: 'ffmpeg', reason: 'Encoding configuration not supported' };
	}

	// WebCodecs is supported!
	const accelNote = capabilities.hardwareAcceleration ? ' (GPU accelerated)' : '';
	return { encoder: 'webcodecs', reason: `Hardware encoding available${accelNote}` };
}

// Initialize FFmpeg worker
async function initWorker(): Promise<Worker> {
	if (worker && workerReady) return worker;

	if (workerLoading) {
		// Wait for existing load
		while (workerLoading) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		if (worker && workerReady) return worker;
	}

	workerLoading = true;
	videos.setFFmpegLoading(true);

	return new Promise((resolve, reject) => {
		try {
			// Create worker
			worker = new Worker(new URL('../workers/ffmpeg.worker.ts', import.meta.url), {
				type: 'module'
			});

			// Handle worker messages
			worker.onmessage = (e) => {
				const { type, id, ...data } = e.data;

				switch (type) {
					case 'load-progress':
						console.log(`FFmpeg loading: ${data.progress}%`);
						break;

					case 'loaded':
						if (data.success) {
							workerReady = true;
							workerLoading = false;
							videos.setFFmpegLoaded(true, data.multiThreaded);
							console.log(
								`FFmpeg loaded (${data.multiThreaded ? 'multi-threaded' : 'single-threaded'})`
							);
							resolve(worker!);
						} else {
							workerLoading = false;
							videos.setFFmpegLoading(false);
							reject(new Error(data.error));
						}
						break;

					case 'progress':
						videos.updateItem(id, {
							progress: data.progress,
							progressStage: data.stage,
							eta: data.eta
						});
						break;

					case 'complete':
						{
							const callback = pendingCallbacks.get(id);
							if (callback) {
								callback.resolve(data);
								pendingCallbacks.delete(id);
							}
						}
						break;

					case 'preview-complete':
						{
							const previewCallback = pendingCallbacks.get(`preview_${id}`);
							if (previewCallback) {
								previewCallback.resolve(data);
								pendingCallbacks.delete(`preview_${id}`);
							}
						}
						break;

					case 'error':
						{
							const errorCallback = pendingCallbacks.get(id);
							if (errorCallback) {
								errorCallback.reject(new Error(data.error));
								pendingCallbacks.delete(id);
							}
							const previewErrorCallback = pendingCallbacks.get(`preview_${id}`);
							if (previewErrorCallback) {
								previewErrorCallback.reject(new Error(data.error));
								pendingCallbacks.delete(`preview_${id}`);
							}
						}
						break;
				}
			};

			worker.onerror = (error) => {
				workerLoading = false;
				videos.setFFmpegLoading(false);
				reject(error);
			};

			// Request FFmpeg load with multi-thread support detection
			const useMultiThread = typeof SharedArrayBuffer !== 'undefined';
			worker.postMessage({
				type: 'load',
				payload: { useMultiThread }
			});
		} catch (error) {
			workerLoading = false;
			videos.setFFmpegLoading(false);
			reject(error);
		}
	});
}

// Process videos
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

	// Initialize WebCodecs capabilities early
	await initWebCodecs();

	// Process videos sequentially
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
		videos.updateItem(item.id, {
			status: 'processing',
			progress: 0,
			progressStage: 'Analyzing...',
			eta: estimateCompressionTime(item, videos.settings)
		});

		// Determine which encoder to use
		const { encoder, reason } = await selectEncoder(item, item.outputFormat);
		
		console.log(`Using ${encoder} for ${item.name}: ${reason}`);
		videos.updateItem(item.id, {
			progressStage: `Using ${encoder === 'webcodecs' ? 'Hardware' : 'Software'} encoder...`
		});

		let compressedBlob: Blob;
		let compressionDuration: number;

		if (encoder === 'webcodecs') {
			// Use WebCodecs (hardware acceleration)
			const result = await compressWithWebCodecs(item);
			compressedBlob = result.blob;
			compressionDuration = result.duration;
		} else {
			// Use FFmpeg (software encoding)
			const result = await compressWithFFmpeg(item);
			compressedBlob = result.blob;
			compressionDuration = result.duration;
		}

		const compressedUrl = URL.createObjectURL(compressedBlob);

		videos.updateItem(item.id, {
			status: 'completed',
			progress: 100,
			progressStage: 'Complete',
			compressedSize: compressedBlob.size,
			compressedUrl,
			compressedBlob,
			compressionDuration,
			encoderUsed: encoder,
			eta: undefined
		});
	} catch (error) {
		console.error('Compression error:', error);
		videos.updateItem(item.id, {
			status: 'error',
			error: error instanceof Error ? error.message : 'Compression failed',
			progressStage: undefined,
			eta: undefined
		});
	}
}

// Compress using WebCodecs (hardware acceleration)
async function compressWithWebCodecs(
	item: VideoItem
): Promise<{ blob: Blob; duration: number }> {
	const startTime = Date.now();
	const quality = videos.settings.quality;
	const outputFormat = item.outputFormat === 'av1' ? 'mp4' : item.outputFormat;

	// Map quality to bitrate (fallback for numeric bitrate)
	const bitrateMap: Record<string, number> = {
		tiny: 500_000,
		web: 1_500_000,
		social: 3_000_000,
		high: 6_000_000,
		lossless: 20_000_000
	};

	// Calculate bitrate - either from target size or quality preset
	let targetBitrate = bitrateMap[quality] || 2_000_000;
	if (videos.settings.targetSizeMB) {
		targetBitrate = calculateBitrateForSize(item, videos.settings.targetSizeMB, videos.settings);
	}

	// Get resolution settings
	const resolutionMap: Record<string, { width: number; height: number }> = {
		original: { width: item.width || 1920, height: item.height || 1080 },
		'2160p': { width: 3840, height: 2160 },
		'1440p': { width: 2560, height: 1440 },
		'1080p': { width: 1920, height: 1080 },
		'720p': { width: 1280, height: 720 },
		'480p': { width: 854, height: 480 },
		'360p': { width: 640, height: 360 }
	};

	const resolution = resolutionMap[videos.settings.resolution] || resolutionMap['original'];
	const { video: videoCodec, audio: audioCodec } = getRecommendedCodecs(outputFormat as 'mp4' | 'webm');

	// Audio bitrate mapping
	const audioBitrateMap: Record<string, number> = {
		'64k': 64000,
		'128k': 128000,
		'192k': 192000,
		'256k': 256000,
		'320k': 320000
	};

	const blob = await encodeWithWebCodecs(
		item.file,
		{
			videoCodec,
			audioCodec,
			width: resolution.width,
			height: resolution.height,
			bitrate: targetBitrate,
			framerate: 30,
			audioBitrate: audioBitrateMap[videos.settings.audioBitrate] || 128000,
			sampleRate: 48000,
			channels: 2,
			// Trim settings
			trimStart: item.trimStart,
			trimEnd: item.trimEnd
		},
		outputFormat as 'mp4' | 'webm',
		quality,                           // Pass quality preset name
		videos.settings.stripMetadata,     // Pass metadata stripping setting
		(progress) => {
			videos.updateItem(item.id, {
				progress: progress.progress,
				progressStage: `${progress.stage} (${progress.framesProcessed}/${progress.totalFrames} frames)`,
				eta: progress.fps > 0 
					? Math.round((progress.totalFrames - progress.framesProcessed) / progress.fps)
					: undefined
			});
		}
	);

	return {
		blob,
		duration: Date.now() - startTime
	};
}

// Compress using FFmpeg (software encoding)
async function compressWithFFmpeg(
	item: VideoItem
): Promise<{ blob: Blob; duration: number }> {
	// Ensure FFmpeg worker is ready
	await initWorker();

	if (!worker || !workerReady) {
		throw new Error('FFmpeg not ready');
	}

	const startTime = Date.now();
	const quality = videos.settings.quality;
	const preset = QUALITY_PRESETS[quality];
	const outputFormat = item.outputFormat;

	// Calculate target bitrate - either from target size or quality preset
	let targetBitrate: string = preset.targetBitrate;
	if (videos.settings.targetSizeMB) {
		const calculatedBitrate = calculateBitrateForSize(item, videos.settings.targetSizeMB, videos.settings);
		targetBitrate = `${Math.round(calculatedBitrate / 1000)}k`;
	}

	// Read file as ArrayBuffer
	const fileData = await item.file.arrayBuffer();

	// Create promise for completion
	const result = await new Promise<{
		outputData: ArrayBuffer;
		outputFormat: string;
		duration: number;
	}>((resolve, reject) => {
		pendingCallbacks.set(item.id, { resolve: resolve as (v: unknown) => void, reject });

		// Send compression request to worker
		worker!.postMessage({
			type: 'compress',
			payload: {
				id: item.id,
				fileData,
				fileName: item.name,
				outputFormat,
				settings: {
					crf: videos.settings.targetSizeMB ? 23 : preset.crf, // Use moderate CRF with target size
					targetBitrate,
					preset: videos.settings.preset,
					resolution: videos.settings.resolution,
					audioBitrate: videos.settings.audioBitrate,
					audioCodec: videos.settings.audioCodec,
					stripMetadata: videos.settings.stripMetadata,
					twoPass: videos.settings.twoPass || !!videos.settings.targetSizeMB // Use two-pass for target size
				},
				// Trim settings
				trimStart: item.trimStart,
				trimEnd: item.trimEnd
			}
		});
	});

	// Create blob from output
	const mimeType =
		result.outputFormat === 'webm'
			? 'video/webm'
			: 'video/mp4';
	const blob = new Blob([result.outputData], { type: mimeType });

	return {
		blob,
		duration: Date.now() - startTime
	};
}

// Generate compression preview
export async function generatePreview(id: string): Promise<string | null> {
	const item = videos.getItemById(id);
	if (!item) return null;

	// Always use FFmpeg for previews (more reliable)
	await initWorker();
	
	if (!worker || !workerReady) return null;

	try {
		const fileData = await item.file.arrayBuffer();
		const preset = QUALITY_PRESETS[videos.settings.quality];

		const result = await new Promise<{
			outputData: ArrayBuffer;
			outputFormat: string;
		}>((resolve, reject) => {
			pendingCallbacks.set(`preview_${id}`, { resolve: resolve as (v: unknown) => void, reject });

			worker!.postMessage({
				type: 'preview',
				payload: {
					id,
					fileData,
					fileName: item.name,
					outputFormat: item.outputFormat === 'av1' ? 'mp4' : item.outputFormat,
					settings: {
						crf: preset.crf,
						targetBitrate: preset.targetBitrate
					},
					duration: item.duration || 60
				}
			});
		});

		const mimeType = result.outputFormat === 'webm' ? 'video/webm' : 'video/mp4';
		const previewBlob = new Blob([result.outputData], { type: mimeType });
		const previewUrl = URL.createObjectURL(previewBlob);

		videos.updateItem(id, { previewUrl });
		return previewUrl;
	} catch (error) {
		console.error('Preview generation failed:', error);
		return null;
	}
}

export function getOutputExtension(format: OutputFormat): string {
	return format === 'av1' ? '.mp4' : `.${format}`;
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
	if (item.previewUrl) {
		URL.revokeObjectURL(item.previewUrl);
	}

	// Reset status
	videos.updateItem(id, {
		status: 'pending',
		progress: 0,
		progressStage: undefined,
		compressedSize: undefined,
		compressedUrl: undefined,
		compressedBlob: undefined,
		previewUrl: undefined,
		eta: undefined
	});

	// Get fresh item reference
	const updatedItem = videos.getItemById(id);
	if (updatedItem) {
		await compressVideo(updatedItem);
	}
}

// Re-process all completed videos with current settings
export async function reprocessAllVideos() {
	const completedItems = videos.items.filter((i) => i.status === 'completed');

	if (completedItems.length === 0) return;

	// Reset all completed items to pending
	for (const item of completedItems) {
		if (item.compressedUrl) {
			URL.revokeObjectURL(item.compressedUrl);
		}
		if (item.previewUrl) {
			URL.revokeObjectURL(item.previewUrl);
		}

		videos.updateItem(item.id, {
			outputFormat: videos.settings.outputFormat,
			status: 'pending',
			progress: 0,
			progressStage: undefined,
			compressedSize: undefined,
			compressedUrl: undefined,
			compressedBlob: undefined,
			previewUrl: undefined,
			eta: undefined
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

// Check all capabilities
export async function getCapabilities(): Promise<{
	sharedArrayBuffer: boolean;
	hardwareConcurrency: number;
	deviceMemory: number;
	webCodecs: WebCodecsCapabilities;
	ffmpegLoaded: boolean;
	ffmpegMultiThreaded: boolean;
}> {
	const webCodecs = await initWebCodecs();
	
	return {
		sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
		hardwareConcurrency: navigator.hardwareConcurrency || 4,
		deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory || 4,
		webCodecs,
		ffmpegLoaded: videos.ffmpegLoaded,
		ffmpegMultiThreaded: videos.isMultiThreaded
	};
}

// Pre-load both encoders
export async function preloadFFmpeg(): Promise<boolean> {
	try {
		// Initialize WebCodecs capabilities
		await initWebCodecs();
		
		// Initialize FFmpeg worker
		await initWorker();
		return true;
	} catch {
		return false;
	}
}
