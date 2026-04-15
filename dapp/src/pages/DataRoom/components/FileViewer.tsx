import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { X, Download, Link2, Loader2, Lock, AlertTriangle, Check } from "lucide-react";
import { useDocument, useDecryptFolder } from "@/hooks/dataroom";
import { useStorage } from "@/hooks/useStorage";
import { saveBlob } from "@/lib/utils";
import { DecryptingState, RejectedState } from "./DecryptGate";
import { FileContent, getFileExt, getFileCategory, getFileIcon, getMimeType } from "./FileContent";
import { Button } from "@/components/ui/button";
import type { HexAddress } from "@/lib/contracts";

interface IFileViewerProps {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	folderId: bigint;
	docIndex: bigint;
	onClose?: () => void;
}

export function FileViewer({ dataRoomAddress, roomId, folderId, docIndex, onClose }: IFileViewerProps) {
	const navigate = useNavigate();
	const { isConnected } = useAccount();
	const {
		data: docData,
		isLoading: isDocLoading,
		error: docError,
	} = useDocument(dataRoomAddress, folderId, docIndex);
	const { downloadDecrypted, downloadPlain } = useStorage();
	const {
		roomKeyHex,
		status: decryptStatus,
		noAccess,
		decryptFailed,
		showPrompt,
		resetRoomKey,
		requestDecrypt,
	} = useDecryptFolder(dataRoomAddress, folderId);

	const [blob, setBlob] = useState<Blob | null>(null);
	const [textContent, setTextContent] = useState<string | null>(null);
	const [fetchError, setFetchError] = useState<string | null>(null);
	const [isFetching, setIsFetching] = useState(false);
	const [copied, setCopied] = useState(false);

	const isEncrypted = !!docData?.wrappedKey && docData.wrappedKey !== "0x";

	const displayName = useMemo(() => {
		if (!docData) return "";
		if (docData.name) {
			try {
				return atob(docData.name);
			} catch {
				return docData.name;
			}
		}
		return `${docData.cid.slice(0, 16)}...`;
	}, [docData]);

	const ext = getFileExt(displayName);
	const category = getFileCategory(ext);
	const FileIcon = getFileIcon(category);
	const folderUrl = `/room/${roomId.toString()}/folder/${folderId.toString()}`;
	const handleClose = useCallback(() => (onClose ? onClose() : navigate(folderUrl)), [onClose, navigate, folderUrl]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [handleClose]);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, []);

	// Fetch file content once docData + roomKeyHex (if encrypted) are available.
	// The cleanup function cancels in-flight fetches if deps change mid-flight.
	useEffect(() => {
		if (!docData || blob) return;
		if (isEncrypted && !roomKeyHex) return;

		let cancelled = false;
		setIsFetching(true);
		setFetchError(null);

		(async () => {
			try {
				let fileBlob =
					isEncrypted && roomKeyHex
						? await downloadDecrypted(docData.cid, roomKeyHex, docData.wrappedKey)
						: await downloadPlain(docData.cid);
				if (cancelled) return;

				// Ensure correct MIME type for known extensions (fixes SVG, etc.)
				const mime = getMimeType(ext);
				if (mime && fileBlob.type !== mime) {
					fileBlob = new Blob([fileBlob], { type: mime });
				}

				setBlob(fileBlob);
				if (category === "text") {
					const text = await fileBlob.text();
					if (!cancelled) setTextContent(text);
				}
			} catch (err) {
				if (!cancelled) setFetchError(err instanceof Error ? err.message : "Failed to fetch file");
			} finally {
				if (!cancelled) setIsFetching(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [docData, roomKeyHex, isEncrypted, category, ext, downloadDecrypted, downloadPlain]);

	const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
	useEffect(() => {
		return () => {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [blobUrl]);

	const handleDownload = () => {
		if (blob) saveBlob(blob, displayName);
	};
	const handleCopyLink = () => {
		navigator.clipboard.writeText(window.location.href);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Derive view state
	const needsDecrypt = isEncrypted && !roomKeyHex;
	const viewState = isDocLoading
		? "loading"
		: docError || !docData
		? "doc-error"
		: !isConnected
		? "no-wallet"
		: needsDecrypt && noAccess
		? "no-access"
		: needsDecrypt && decryptStatus === "rejected"
		? "decrypt-rejected"
		: needsDecrypt && decryptStatus === "decrypting"
		? "decrypting"
		: needsDecrypt && decryptFailed
		? "decrypt-failed"
		: needsDecrypt && showPrompt
		? "decrypt-prompt"
		: needsDecrypt
		? "loading"
		: isFetching
		? "loading"
		: fetchError
		? "fetch-error"
		: !blob
		? "loading"
		: ("ready" as const);

	let body: React.ReactNode;
	switch (viewState) {
		case "loading":
			body = (
				<div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
					<Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
					<p className="text-sm">{isFetching && isEncrypted ? "Decrypting..." : "Loading..."}</p>
				</div>
			);
			break;
		case "doc-error":
			body = (
				<StatusMessage
					icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
					title="Failed to load document"
				/>
			);
			break;
		case "no-wallet":
			body = (
				<StatusMessage
					icon={<Lock className="h-8 w-8 text-muted-foreground" />}
					title="Connect wallet to view this file"
				/>
			);
			break;
		case "no-access":
			body = (
				<StatusMessage
					icon={<Lock className="h-8 w-8 text-muted-foreground" />}
					title="You don't have access to this file"
					subtitle="Contact the data room admin for access."
				/>
			);
			break;
		case "decrypt-rejected":
			body = <RejectedState onRetry={resetRoomKey} />;
			break;
		case "decrypting":
			body = <DecryptingState />;
			break;
		case "decrypt-failed":
			body = (
				<StatusMessage icon={<AlertTriangle className="h-8 w-8 text-destructive" />} title="Decryption failed">
					<Button variant="outline" size="sm" onClick={resetRoomKey}>
						Retry
					</Button>
				</StatusMessage>
			);
			break;
		case "decrypt-prompt":
			body = (
				<div className="flex flex-col items-center justify-center py-24 text-center">
					<Lock className="h-10 w-10 text-muted-foreground mb-4" />
					<p className="text-sm font-medium mb-1">This file is encrypted</p>
					<p className="text-xs text-muted-foreground mb-5">
						Sign a message to decrypt and view this document.
					</p>
					<Button size="sm" onClick={requestDecrypt}>
						Decrypt
					</Button>
				</div>
			);
			break;
		case "fetch-error":
			body = (
				<StatusMessage
					icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
					title="Failed to load file"
					subtitle={fetchError ?? undefined}
				/>
			);
			break;
		case "ready":
			body = (
				<FileContent
					category={category}
					blobUrl={blobUrl!}
					displayName={displayName}
					textContent={textContent}
					ext={ext}
					blobSize={blob!.size}
					onDownload={handleDownload}
				/>
			);
			break;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/40" onClick={handleClose} />

			<div className="relative z-10 flex flex-col w-[90vw] max-w-5xl h-[85vh] rounded-xl border border-border bg-white shadow-xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
					<FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
					<span className="text-sm font-semibold truncate flex-1">{displayName || "Loading..."}</span>

					<div className="flex items-center gap-3 shrink-0">
						<span
							role="button"
							tabIndex={0}
							onClick={handleCopyLink}
							className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
						>
							{copied ? (
								<Check className="h-3.5 w-3.5 text-emerald-500" />
							) : (
								<Link2 className="h-3.5 w-3.5" />
							)}
							{copied ? "Copied" : "Copy link"}
						</span>
						{blob && (
							<span
								role="button"
								tabIndex={0}
								onClick={handleDownload}
								className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
							>
								<Download className="h-3.5 w-3.5" />
								Download
							</span>
						)}
						<span
							role="button"
							tabIndex={0}
							onClick={handleClose}
							className="ml-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
							title="Close (Esc)"
						>
							<X className="h-4 w-4" />
						</span>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-h-0 flex flex-col">{body}</div>
			</div>
		</div>
	);
}

function StatusMessage({
	icon,
	title,
	subtitle,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	subtitle?: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-24 text-center">
			<div className="mb-3">{icon}</div>
			<p className="text-sm font-medium mb-1">{title}</p>
			{subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
			{children}
		</div>
	);
}
