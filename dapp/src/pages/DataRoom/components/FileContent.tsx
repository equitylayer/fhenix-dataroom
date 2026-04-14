import { Download, FileText, FileImage, FileVideo, FileCode, File } from "lucide-react";
import { Button } from "@/components/ui/button";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"];
const PDF_EXTS = ["pdf"];
const TEXT_EXTS = [
	"txt",
	"md",
	"json",
	"csv",
	"xml",
	"yml",
	"yaml",
	"toml",
	"ini",
	"log",
	"env",
	"sh",
	"bat",
	"ts",
	"tsx",
	"js",
	"jsx",
	"css",
	"scss",
	"html",
	"htm",
	"sql",
	"py",
	"rs",
	"go",
	"sol",
	"c",
	"cpp",
	"h",
	"java",
	"rb",
	"php",
];
const VIDEO_EXTS = ["mp4", "webm", "ogg"];

const MIME_MAP: Record<string, string> = {
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	ico: "image/x-icon",
	pdf: "application/pdf",
	mp4: "video/mp4",
	webm: "video/webm",
	ogg: "video/ogg",
};

export function getMimeType(ext: string): string | null {
	return MIME_MAP[ext] ?? null;
}

export type FileCategory = "image" | "pdf" | "text" | "video" | "other";

export function getFileExt(name: string): string {
	const parts = name.split(".");
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function getFileCategory(ext: string): FileCategory {
	if (IMAGE_EXTS.includes(ext)) return "image";
	if (PDF_EXTS.includes(ext)) return "pdf";
	if (TEXT_EXTS.includes(ext)) return "text";
	if (VIDEO_EXTS.includes(ext)) return "video";
	return "other";
}

export function getFileIcon(category: string) {
	switch (category) {
		case "image":
			return FileImage;
		case "video":
			return FileVideo;
		case "text":
			return FileCode;
		case "pdf":
			return FileText;
		default:
			return File;
	}
}

interface FileContentProps {
	category: FileCategory;
	blobUrl: string;
	displayName: string;
	textContent: string | null;
	ext: string;
	blobSize: number;
	onDownload: () => void;
}

export function FileContent({
	category,
	blobUrl,
	displayName,
	textContent,
	ext,
	blobSize,
	onDownload,
}: FileContentProps) {
	switch (category) {
		case "image":
			return (
				<div className="flex items-center justify-center p-6 flex-1">
					<img src={blobUrl} alt={displayName} className="max-w-full max-h-full object-contain" />
				</div>
			);
		case "pdf":
			return <iframe src={blobUrl} title={displayName} className="w-full flex-1 border-0" />;
		case "text":
			return (
				<pre className="p-6 text-sm whitespace-pre-wrap break-words font-mono flex-1 overflow-auto">
					{textContent}
				</pre>
			);
		case "video":
			return (
				<div className="flex items-center justify-center p-6 flex-1">
					<video src={blobUrl} controls className="max-w-full max-h-full rounded" />
				</div>
			);
		default:
			return (
				<div className="flex flex-col items-center justify-center py-16 px-8 flex-1">
					<File size={64} className="text-muted-foreground/40 mb-4" />
					<p className="text-sm font-medium mb-1">{displayName}</p>
					<p className="text-xs text-muted-foreground mb-1">
						{ext ? `.${ext.toUpperCase()} file` : "Unknown file type"}
					</p>
					<p className="text-xs text-muted-foreground mb-1">{(blobSize / 1024).toFixed(1)} KB</p>
					<p className="text-xs text-muted-foreground mb-4">Preview is not available for this file type.</p>
					<Button onClick={onDownload}>
						<Download className="h-4 w-4" />
						Download
					</Button>
				</div>
			);
	}
}
