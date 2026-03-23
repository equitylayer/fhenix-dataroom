import { KeyRound, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DecryptPrompt = ({ onDecrypt }: { onDecrypt: () => void }) => (
	<div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
		<div className="flex items-center gap-3">
			<KeyRound className="h-5 w-5 text-primary" />
			<div>
				<p className="text-sm font-medium">Folder is Encrypted</p>
				<p className="text-xs text-muted-foreground">
					Sign a message to upload documents or decrypt private documents.
				</p>
			</div>
		</div>
		<Button size="sm" onClick={onDecrypt}>
			<KeyRound className="h-3.5 w-3.5" />
			Decrypt
		</Button>
	</div>
);

export const DecryptingState = () => (
	<div className="flex flex-col items-center justify-center py-16 text-center">
		<Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
		<h3 className="text-lg font-semibold mb-2">Decrypting Folder</h3>
		<p className="text-sm text-muted-foreground">Please sign the message to decrypt folder...</p>
	</div>
);

export const RejectedState = ({ onRetry }: { onRetry: () => void }) => (
	<div className="flex flex-col items-center justify-center py-16 text-center">
		<AlertTriangle className="h-10 w-10 text-destructive mb-4" />
		<h3 className="text-lg font-semibold mb-2">Signature Rejected</h3>
		<p className="text-sm text-muted-foreground max-w-xs mb-4">
			Signature request was rejected. Please try again to access this folder.
		</p>
		<Button variant="outline" onClick={onRetry}>
			<RefreshCw className="h-4 w-4" />
			Retry
		</Button>
	</div>
);
