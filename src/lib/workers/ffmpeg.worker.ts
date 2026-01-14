/**
 * FFmpeg Web Worker
 * Runs FFmpeg in a dedicated worker thread for non-blocking UI
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

interface WorkerMessage {
	type: 'load' | 'compress' | 'preview' | 'abort';
	id?: string;
	payload?: unknown;
}

interface LoadPayload {
	useMultiThread: boolean;
}

interface CompressPayload {
	id: string;
	fileData: ArrayBuffer;
	fileName: string;
	outputFormat: 'mp4' | 'webm';
	settings: {
		crf: number;
		targetBitrate: string;
		preset: string;
		resolution?: string;
		audioBitrate: string;
		audioCodec: string;
		stripMetadata: boolean;
		twoPass: boolean;
	};
	// Trim settings
	trimStart?: number;
	trimEnd?: number;
}

interface PreviewPayload {
	id: string;
	fileData: ArrayBuffer;
	fileName: string;
	outputFormat: 'mp4' | 'webm';
	settings: {
		crf: number;
		targetBitrate: string;
	};
	duration: number; // preview duration in seconds
}

// Post message with progress
function postProgress(id: string, progress: number, stage: string, eta?: number) {
	self.postMessage({
		type: 'progress',
		id,
		progress,
		stage,
		eta
	});
}

// Load FFmpeg
async function loadFFmpeg(payload: LoadPayload) {
	if (isLoaded && ffmpeg) {
		self.postMessage({ type: 'loaded', success: true });
		return;
	}

	try {
		ffmpeg = new FFmpeg();

		// Use multi-threaded core if SharedArrayBuffer is available
		const useMultiThread = payload.useMultiThread && typeof SharedArrayBuffer !== 'undefined';
		const coreType = useMultiThread ? 'core-mt' : 'core';
		const baseURL = `https://unpkg.com/@ffmpeg/${coreType}@0.12.6/dist/esm`;

		// Report loading progress
		let loadProgress = 0;
		const reportLoadProgress = () => {
			loadProgress += 20;
			self.postMessage({
				type: 'load-progress',
				progress: Math.min(loadProgress, 95)
			});
		};

		reportLoadProgress();

		const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
		reportLoadProgress();

		const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
		reportLoadProgress();

		const loadConfig: Parameters<FFmpeg['load']>[0] = {
			coreURL,
			wasmURL
		};

		// Multi-threaded core requires worker URL
		if (useMultiThread) {
			loadConfig.workerURL = await toBlobURL(
				`${baseURL}/ffmpeg-core.worker.js`,
				'text/javascript'
			);
		}

		reportLoadProgress();

		await ffmpeg.load(loadConfig);
		isLoaded = true;

		self.postMessage({
			type: 'loaded',
			success: true,
			multiThreaded: useMultiThread
		});
	} catch (error) {
		self.postMessage({
			type: 'loaded',
			success: false,
			error: error instanceof Error ? error.message : 'Failed to load FFmpeg'
		});
	}
}

// Compress video
async function compressVideo(payload: CompressPayload) {
	if (!ffmpeg || !isLoaded) {
		self.postMessage({
			type: 'error',
			id: payload.id,
			error: 'FFmpeg not loaded'
		});
		return;
	}

	const { id, fileData, fileName, outputFormat, settings, trimStart, trimEnd } = payload;
	const startTime = Date.now();

	try {
		postProgress(id, 5, 'Preparing...');

		// Input/output filenames
		const inputExt = fileName.split('.').pop() || 'mp4';
		const inputFilename = `input_${id}.${inputExt}`;
		const outputExt = outputFormat;
		const outputFilename = `output_${id}.${outputExt}`;

		// Write input file
		await ffmpeg.writeFile(inputFilename, new Uint8Array(fileData));
		postProgress(id, 15, 'Loading video...');

		// Set up progress tracking
		let lastProgress = 15;
		ffmpeg.on('progress', ({ progress, time }) => {
			const compressionProgress = 15 + Math.round(progress * 75);
			if (compressionProgress > lastProgress) {
				lastProgress = compressionProgress;

				// Estimate ETA
				const elapsed = Date.now() - startTime;
				const estimatedTotal = elapsed / progress;
				const eta = Math.round((estimatedTotal - elapsed) / 1000);

				postProgress(id, Math.min(90, compressionProgress), 'Compressing...', eta);
			}
		});

		// Build FFmpeg arguments (with trim support)
		const ffmpegArgs = buildFFmpegArgs(inputFilename, outputFilename, outputFormat, settings, trimStart, trimEnd);

		// Two-pass encoding for better quality at target bitrate
		if (settings.twoPass && outputFormat !== 'webm') {
			// First pass - analysis only
			postProgress(id, 20, 'First pass (analysis)...');
			const firstPassArgs: string[] = [];
			
			// Add trim parameters for first pass too
			if (trimStart !== undefined && trimStart > 0) {
				firstPassArgs.push('-ss', trimStart.toString());
			}
			
			firstPassArgs.push('-i', inputFilename);
			
			if (trimEnd !== undefined) {
				const duration = trimEnd - (trimStart || 0);
				firstPassArgs.push('-t', duration.toString());
			}
			
			firstPassArgs.push(
				'-c:v',
				'libx264',
				'-b:v',
				settings.targetBitrate,
				'-pass',
				'1',
				'-an',
				'-f',
				'null',
				'/dev/null'
			);
			await ffmpeg.exec(firstPassArgs);

			// Second pass - actual encoding
			postProgress(id, 50, 'Second pass (encoding)...');
			ffmpegArgs.push('-pass', '2');
		}

		// Run compression
		await ffmpeg.exec(ffmpegArgs);
		postProgress(id, 92, 'Finalizing...');

		// Read output file
		const outputData = await ffmpeg.readFile(outputFilename);

		// Clean up
		await ffmpeg.deleteFile(inputFilename);
		await ffmpeg.deleteFile(outputFilename);

		// Clean up two-pass log files if they exist
		try {
			await ffmpeg.deleteFile('ffmpeg2pass-0.log');
			await ffmpeg.deleteFile('ffmpeg2pass-0.log.mbtree');
		} catch {
			// Ignore if files don't exist
		}

		postProgress(id, 100, 'Complete');

		// Send result
		self.postMessage({
			type: 'complete',
			id,
			outputData: (outputData as Uint8Array).buffer,
			outputFormat: outputExt,
			duration: Date.now() - startTime
		});
	} catch (error) {
		self.postMessage({
			type: 'error',
			id,
			error: error instanceof Error ? error.message : 'Compression failed'
		});
	}
}

// Build FFmpeg arguments based on format and settings
function buildFFmpegArgs(
	input: string,
	output: string,
	format: 'mp4' | 'webm',
	settings: CompressPayload['settings'],
	trimStart?: number,
	trimEnd?: number
): string[] {
	const args: string[] = [];

	// Trim: seek before input (faster for large files)
	if (trimStart !== undefined && trimStart > 0) {
		args.push('-ss', trimStart.toString());
	}

	args.push('-i', input);

	// Trim: duration after input
	if (trimEnd !== undefined) {
		const duration = trimEnd - (trimStart || 0);
		args.push('-t', duration.toString());
	}

	// Video codec
	switch (format) {
		case 'webm':
			args.push('-c:v', 'libvpx-vp9');
			args.push('-crf', settings.crf.toString());
			args.push('-b:v', settings.targetBitrate);
			args.push('-deadline', 'good');
			args.push('-cpu-used', '2');
			break;

		case 'mp4':
		default:
			args.push('-c:v', 'libx264');
			args.push('-crf', settings.crf.toString());
			args.push('-preset', settings.preset);
			args.push('-movflags', '+faststart');
			break;
	}

	// Resolution scaling
	if (settings.resolution && settings.resolution !== 'original') {
		const scaleMap: Record<string, string> = {
			'2160p': '3840:-2',
			'1440p': '2560:-2',
			'1080p': '1920:-2',
			'720p': '1280:-2',
			'480p': '854:-2',
			'360p': '640:-2'
		};
		const scale = scaleMap[settings.resolution];
		if (scale) {
			args.push('-vf', `scale=${scale}`);
		}
	}

	// Audio codec
	if (settings.audioCodec === 'none') {
		args.push('-an');
	} else if (settings.audioCodec === 'copy') {
		args.push('-c:a', 'copy');
	} else {
		const audioCodec = format === 'webm' ? 'libopus' : settings.audioCodec || 'aac';
		args.push('-c:a', audioCodec);
		args.push('-b:a', settings.audioBitrate);
	}

	// Metadata stripping
	if (settings.stripMetadata) {
		args.push('-map_metadata', '-1');
		args.push('-fflags', '+bitexact');
	}

	// Overwrite output
	args.push('-y');
	args.push(output);

	return args;
}

// Generate compression preview (5-second sample)
async function generatePreview(payload: PreviewPayload) {
	if (!ffmpeg || !isLoaded) {
		self.postMessage({
			type: 'error',
			id: payload.id,
			error: 'FFmpeg not loaded'
		});
		return;
	}

	const { id, fileData, fileName, outputFormat, settings, duration } = payload;

	try {
		postProgress(id, 10, 'Generating preview...');

		const inputExt = fileName.split('.').pop() || 'mp4';
		const inputFilename = `preview_input_${id}.${inputExt}`;
		const outputFilename = `preview_output_${id}.${outputFormat}`;

		await ffmpeg.writeFile(inputFilename, new Uint8Array(fileData));

		// Extract a sample from the middle of the video
		const startTime = Math.max(0, Math.floor(duration / 2) - 2.5);

		const args = [
			'-ss',
			startTime.toString(),
			'-i',
			inputFilename,
			'-t',
			'5',
			'-c:v',
			outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
			'-crf',
			settings.crf.toString(),
			'-preset',
			'veryfast',
			'-an',
			'-y',
			outputFilename
		];

		await ffmpeg.exec(args);
		postProgress(id, 90, 'Finalizing preview...');

		const outputData = await ffmpeg.readFile(outputFilename);

		await ffmpeg.deleteFile(inputFilename);
		await ffmpeg.deleteFile(outputFilename);

		self.postMessage({
			type: 'preview-complete',
			id,
			outputData: (outputData as Uint8Array).buffer,
			outputFormat
		});
	} catch (error) {
		self.postMessage({
			type: 'error',
			id,
			error: error instanceof Error ? error.message : 'Preview generation failed'
		});
	}
}

// Handle messages from main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type, payload } = e.data;

	switch (type) {
		case 'load':
			await loadFFmpeg(payload as LoadPayload);
			break;

		case 'compress':
			await compressVideo(payload as CompressPayload);
			break;

		case 'preview':
			await generatePreview(payload as PreviewPayload);
			break;

		case 'abort':
			// FFmpeg.wasm doesn't support abortion, but we can prevent processing new items
			break;
	}
};
