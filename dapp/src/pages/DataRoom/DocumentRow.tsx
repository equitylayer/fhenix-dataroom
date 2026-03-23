import { useState } from "react";
import { FileText, Download, Loader2, ShieldCheck, Globe, AlertTriangle } from "lucide-react";
import { useDocument } from "@/hooks/dataroom";
import { useStoracha } from "@/hooks/useStoracha";
import { saveBlob } from "@/lib/utils";
import type { HexAddress } from "@/lib/contracts";

interface IDocumentRowProps {
	dataRoomAddress: HexAddress;
	roomId: bigint;
	docIndex: bigint;
	encrypted: boolean;
	roomKeyHex: string | null;
}

export function DocumentRow({ dataRoomAddress, roomId, docIndex, encrypted, roomKeyHex }: IDocumentRowProps) {
	const { data, isLoading, error } = useDocument(dataRoomAddress, roomId, docIndex);
	const { downloadDecrypted, downloadPlain, downloadEncryptedBlob } = useStoracha();
	const [isDownloading, setIsDownloading] = useState(false);

	const isEncrypted = !!data?.wrappedKey && data.wrappedKey !== "0x";

	let displayName = data ? `${data.cid.slice(0, 16)}...` : "";
	if (data?.name) {
		try {
			displayName = atob(data.name);
		} catch {
			displayName = data.name;
		}
	}

	const downloadTitle =
		encrypted && isEncrypted ? "Download encrypted blob" : isEncrypted ? "Download & decrypt" : "Download";

	const handleClick = async () => {
		if (!data) return;
		setIsDownloading(true);
		try {
			if (encrypted && isEncrypted) {
				const blob = await downloadEncryptedBlob(data.cid);
				saveBlob(blob, `encrypted-${data.cid.slice(-8)}.bin`);
			} else if (isEncrypted) {
				if (!roomKeyHex) return;
				const blob = await downloadDecrypted(data.cid, roomKeyHex, data.wrappedKey);
				saveBlob(blob, displayName);
			} else {
				const blob = await downloadPlain(data.cid);
				saveBlob(blob, displayName);
			}
		} finally {
			setIsDownloading(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-3 py-3 border-b last:border-0 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				<span className="text-sm">Loading document...</span>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex items-center gap-3 py-2.5 border-b last:border-0 text-muted-foreground opacity-50">
				{!roomKeyHex ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
				<span className="text-sm italic">{!roomKeyHex ? "Encrypted document" : "Failed to load document"}</span>
			</div>
		);
	}

	return (
		<div className="group flex items-center justify-between py-2.5 border-b last:border-0 hover:bg-accent/30 -mx-2 px-2 rounded transition-colors">
			<div className="flex items-center gap-3 min-w-0">
				<FileText className="h-4 w-4 text-muted-foreground shrink-0" />
				<div className="min-w-0">
					<p className="text-sm truncate">{displayName}</p>
					<p className="text-xs text-muted-foreground flex items-center gap-1">
						{isEncrypted ? (
							<ShieldCheck className="h-3 w-3 text-emerald-600" />
						) : (
							<Globe className="h-3 w-3 text-blue-500" />
						)}
						{new Date(Number(data.createdAt) * 1000).toLocaleDateString()}
					</p>
				</div>
			</div>
			<span
				role="button"
				tabIndex={0}
				onClick={handleClick}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleClick();
				}}
				className="shrink-0 ml-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all cursor-pointer"
				title={downloadTitle}
			>
				{isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
			</span>
		</div>
	);
}
