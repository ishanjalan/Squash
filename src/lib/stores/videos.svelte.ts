export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'avi';
export type OutputFormat = 'mp4' | 'webm';
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface VideoItem {
	id: string;
	file: File;
	name: string;
	originalSize: number;
	compressedSize?: number;
	originalUrl: string;
	compressedUrl?: string;
	compressedBlob?: Blob;
	format: VideoFormat;
	outputFormat: OutputFormat;
	status: VideoStatus;
	progress: number;
	error?: string;
	width?: number;
	height?: number;
	duration?: number; // in seconds
}

export interface CompressionSettings {
	quality: 'tiny' | 'web' | 'social' | 'high';
	outputFormat: OutputFormat;
}

// Quality presets - CRF values (lower = better quality, larger file)
export const QUALITY_PRESETS = {
	tiny: { crf: 35, label: 'Tiny', desc: 'Max compression', targetBitrate: '500k' },
	web: { crf: 28, label: 'Web', desc: 'Balanced', targetBitrate: '1000k' },
	social: { crf: 23, label: 'Social', desc: 'Social media', targetBitrate: '2000k' },
	high: { crf: 18, label: 'High', desc: 'High quality', targetBitrate: '4000k' }
};

const SETTINGS_KEY = 'squash-settings';

function loadSettings(): CompressionSettings {
	if (typeof localStorage === 'undefined') {
		return getDefaultSettings();
	}
	try {
		const saved = localStorage.getItem(SETTINGS_KEY);
		if (saved) {
			return { ...getDefaultSettings(), ...JSON.parse(saved) };
		}
	} catch (e) {
		console.warn('Failed to load settings from localStorage:', e);
	}
	return getDefaultSettings();
}

function saveSettings(settings: CompressionSettings) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch (e) {
		console.warn('Failed to save settings to localStorage:', e);
	}
}

function getDefaultSettings(): CompressionSettings {
	return {
		quality: 'web',
		outputFormat: 'mp4'
	};
}

// Extract video metadata
async function getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		video.preload = 'metadata';
		const url = URL.createObjectURL(file);
		
		video.onloadedmetadata = () => {
			URL.revokeObjectURL(url);
			resolve({
				width: video.videoWidth,
				height: video.videoHeight,
				duration: video.duration
			});
		};
		
		video.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load video metadata'));
		};
		
		video.src = url;
	});
}

function createVideosStore() {
	let items = $state<VideoItem[]>([]);
	let settings = $state<CompressionSettings>(loadSettings());

	function getFormatFromMime(mimeType: string): VideoFormat {
		const map: Record<string, VideoFormat> = {
			'video/mp4': 'mp4',
			'video/webm': 'webm',
			'video/quicktime': 'mov',
			'video/x-msvideo': 'avi',
			'video/avi': 'avi'
		};
		return map[mimeType] || 'mp4';
	}

	function generateId(): string {
		return `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	return {
		get items() {
			return items;
		},
		get settings() {
			return settings;
		},

		async addFiles(files: FileList | File[]) {
			const validTypes = [
				'video/mp4',
				'video/webm',
				'video/quicktime',
				'video/x-msvideo',
				'video/avi'
			];

			const newItems: VideoItem[] = [];

			for (const file of files) {
				if (!validTypes.includes(file.type)) continue;

				const format = getFormatFromMime(file.type);

				// Get video metadata
				let width: number | undefined;
				let height: number | undefined;
				let duration: number | undefined;
				
				try {
					const metadata = await getVideoMetadata(file);
					width = metadata.width;
					height = metadata.height;
					duration = metadata.duration;
				} catch (e) {
					console.warn('Failed to get metadata for', file.name);
				}

				newItems.push({
					id: generateId(),
					file,
					name: file.name,
					originalSize: file.size,
					originalUrl: URL.createObjectURL(file),
					format,
					outputFormat: settings.outputFormat,
					status: 'pending',
					progress: 0,
					width,
					height,
					duration
				});
			}

			items = [...items, ...newItems];
			return newItems;
		},

		updateItem(id: string, updates: Partial<VideoItem>) {
			items = items.map((item) => (item.id === id ? { ...item, ...updates } : item));
		},

		removeItem(id: string) {
			const item = items.find((i) => i.id === id);
			if (item) {
				URL.revokeObjectURL(item.originalUrl);
				if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
			}
			items = items.filter((i) => i.id !== id);
		},

		clearAll() {
			items.forEach((item) => {
				URL.revokeObjectURL(item.originalUrl);
				if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
			});
			items = [];
		},

		updateSettings(newSettings: Partial<CompressionSettings>) {
			settings = { ...settings, ...newSettings };
			saveSettings(settings);

			// Update output format for pending items
			if (newSettings.outputFormat !== undefined) {
				items = items.map((item) => {
					if (item.status === 'pending') {
						return {
							...item,
							outputFormat: newSettings.outputFormat!
						};
					}
					return item;
				});
			}
		},

		getItemById(id: string) {
			return items.find((i) => i.id === id);
		}
	};
}

export const videos = createVideosStore();
