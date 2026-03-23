import { useState } from "react";
import { Upload, FileText, RefreshCw, AlertTriangle, Lock, LockOpen, ShieldCheck, Globe } from "lucide-react";
import { useAddDocuments } from "@/hooks/dataroom";
import { useStoracha } from "@/hooks/useStoracha";
import { Button } from "@/components/ui/button";
import { DocumentRow } from "../DocumentRow";
import type { HexAddress } from "@/lib/contracts";

function getUploadButtonText(
	uploadProgress: string | null,
	isUploading: boolean,
	isAddingDoc: boolean,
	isConfirmingDoc: boolean,
	fileCount: number,
): string {
	if (uploadProgress) return uploadProgress;
	if (isUploading) return "Uploading...";
	if (isAddingDoc) return "Signing...";
	if (isConfirmingDoc) return "Confirming...";
	if (fileCount > 1) return `Upload (${fileCount})`;
	return "Upload";
}

interface IDocumentRowProps {
	dataRoomAddress: HexAddress;
	folderId: bigint;
	documentCount: number;
	isAdmin: boolean;
	roomKeyHex: string | null;
}

export function DocumentList({ dataRoomAddress, folderId, documentCount, isAdmin, roomKeyHex }: IDocumentRowProps) {
	const { addDocuments, isPending: isAddingDoc, isConfirming: isConfirmingDoc } = useAddDocuments(dataRoomAddress);
	const { uploadEncrypted, uploadPlain, isUploading, initialize, isReady: storachaReady } = useStoracha();

	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<string | null>(null);
	const [downloadEncrypted, setDownloadEncrypted] = useState<boolean>(false);
	const [encryptUpload, setEncryptUpload] = useState<boolean>(true);
	const [fileInputKey, setFileInputKey] = useState(0);

	const handleUpload = async () => {
		if (selectedFiles.length === 0) return;
		if (encryptUpload && !roomKeyHex) return;
		setUploadError(null);
		setUploadProgress(null);

		try {
			if (!storachaReady) {
				setUploadProgress("Connecting...");
				await initialize();
			}

			const cids: string[] = [];
			const names: string[] = [];
			const wrappedKeys: string[] = [];
			const total = selectedFiles.length;

			for (let i = 0; i < total; i++) {
				if (encryptUpload) {
					setUploadProgress(`Encrypting ${i + 1}/${total}...`);
					const { cid, encodedName, wrappedKeyHex } = await uploadEncrypted(selectedFiles[i], roomKeyHex!);
					cids.push(cid);
					names.push(encodedName);
					wrappedKeys.push(wrappedKeyHex);
				} else {
					setUploadProgress(`Uploading ${i + 1}/${total}...`);
					const { cid, encodedName } = await uploadPlain(selectedFiles[i]);
					cids.push(cid);
					names.push(encodedName);
					wrappedKeys.push("0x");
				}
			}

			setUploadProgress(null);
			await addDocuments(folderId, cids, names, wrappedKeys);
			setSelectedFiles([]);
			setFileInputKey((k) => k + 1);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Upload failed";
			setUploadError(msg);
			setUploadProgress(null);
			console.error("Upload error:", e);
		}
	};

	return (
		<div className="lg:col-span-2 border border-border rounded-lg p-5">
			<div className="flex items-center justify-between mb-4">
				<h2 className="font-semibold text-sm flex items-center gap-2">
					<FileText className="h-4 w-4 text-muted-foreground" />
					Documents
					<span className="text-muted-foreground font-normal">({documentCount})</span>
				</h2>
				{documentCount > 0 && (
					<span
						role="button"
						tabIndex={0}
						onClick={() => setDownloadEncrypted((v) => !v)}
						onKeyDown={(e) => {
							if (e.key === "Enter") setDownloadEncrypted((v) => !v);
						}}
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
						title={downloadEncrypted ? "Downloading encrypted blobs" : "Downloading decrypted files"}
					>
						{downloadEncrypted ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
						{downloadEncrypted ? "Encrypted" : "Decrypted"}
					</span>
				)}
			</div>

			{isAdmin && (
				<>
					<div className="flex gap-2 mb-2 items-center">
						<input
							key={fileInputKey}
							type="file"
							multiple
							onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])}
							className="flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:px-0 file:py-2 file:text-sm file:text-muted-foreground file:cursor-pointer hover:file:text-foreground"
						/>
						<span
							role="button"
							tabIndex={0}
							onClick={() => setEncryptUpload((v) => !v)}
							onKeyDown={(e) => {
								if (e.key === "Enter") setEncryptUpload((v) => !v);
							}}
							className={`inline-flex items-center gap-1 text-xs cursor-pointer transition-colors shrink-0 ${
								encryptUpload
									? "text-emerald-600 hover:text-emerald-700"
									: "text-blue-600 hover:text-blue-700"
							}`}
						>
							{encryptUpload ? (
								<ShieldCheck className="h-3.5 w-3.5" />
							) : (
								<Globe className="h-3.5 w-3.5" />
							)}
							{encryptUpload ? "Encrypted" : "Public"}
						</span>
						<Button
							variant="textLink"
							onClick={handleUpload}
							disabled={
								selectedFiles.length === 0 ||
								(encryptUpload && !roomKeyHex) ||
								!!uploadProgress ||
								isUploading ||
								isAddingDoc ||
								isConfirmingDoc
							}
						>
							{uploadProgress || isUploading || isAddingDoc || isConfirmingDoc ? (
								<RefreshCw className="h-4 w-4 animate-spin" />
							) : (
								<Upload className="h-4 w-4" />
							)}
							{getUploadButtonText(
								uploadProgress,
								isUploading,
								isAddingDoc,
								isConfirmingDoc,
								selectedFiles.length,
							)}
						</Button>
					</div>

					{selectedFiles.length > 0 && (
						<ul className="mb-3 text-xs text-muted-foreground space-y-0.5 pl-1">
							{selectedFiles.map((file, i) => (
								<li key={i} className="flex items-center gap-1.5">
									<FileText className="h-3 w-3 shrink-0" />
									<span className="truncate">{file.name}</span>
									<span className="shrink-0 opacity-50">({(file.size / 1024).toFixed(1)} KB)</span>
								</li>
							))}
						</ul>
					)}
				</>
			)}

			{uploadError && (
				<div className="mb-4 rounded px-3 py-2 text-xs bg-destructive/10 text-destructive">
					<AlertTriangle className="h-3 w-3 inline mr-1" />
					{uploadError}
				</div>
			)}

			{documentCount === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No documents yet.</p>}
			{documentCount > 0 && (
				<div className="mt-1">
					{Array.from({ length: documentCount }, (_, i) => (
						<DocumentRow
							key={i}
							dataRoomAddress={dataRoomAddress}
							roomId={folderId}
							docIndex={BigInt(i)}
							encrypted={downloadEncrypted}
							roomKeyHex={roomKeyHex}
						/>
					))}
				</div>
			)}
		</div>
	);
}
