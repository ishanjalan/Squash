// Stores
export { videos, QUALITY_PRESETS, RESOLUTION_OPTIONS, AUDIO_BITRATE_OPTIONS } from './stores/videos.svelte';
export type {
	VideoItem,
	VideoFormat,
	OutputFormat,
	VideoStatus,
	Resolution,
	AudioCodec,
	CompressionSettings
} from './stores/videos.svelte';

// Utils
export {
	processVideos,
	reprocessVideo,
	reprocessAllVideos,
	generatePreview,
	getOutputExtension,
	getOutputFilename,
	getCapabilities,
	preloadFFmpeg
} from './utils/compress';
export { downloadVideo, downloadAllAsZip } from './utils/download';
export { createFocusTrap, trapFocus, releaseFocus, focusTrap } from './utils/focus-trap';
export {
	storeVideo,
	getVideoBlob,
	getCompressedBlob,
	updateCompressedBlob,
	deleteVideo,
	clearAllVideos,
	getStorageUsage,
	cleanupOldEntries,
	isLargeFile
} from './utils/storage';
