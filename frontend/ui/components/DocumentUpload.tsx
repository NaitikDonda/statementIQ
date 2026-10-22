import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, LoaderCircle, RotateCcw, X } from "lucide-react";
import { ApiError, uploadDocument } from "../services/api";

interface DocumentUploadProps {
  onUploaded: () => void;
}

export default function DocumentUpload({ onUploaded }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    setError("");
    setSuccess("");
    setProgress(0);
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      setError("Please choose a PDF file.");
      return;
    }
    setFile(selected);
  };

  const startUpload = async () => {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setError("");
    setSuccess("");
    try {
      const document = await uploadDocument(file, setProgress);
      setSuccess(`${document.filename} is indexed and ready to search.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : "The document could not be processed. Please try again.",
      );
    } finally {
      setBusy(false);
      onUploaded();
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`drop-zone flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-line bg-panel hover:border-accent/50 hover:bg-elevated/60"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <FileUp size={20} />
        </span>
        <span className="text-sm font-medium text-ink">
          Drop your financial statement here
        </span>
        <span className="mt-1.5 text-xs text-muted">
          or <span className="text-accent">browse files</span> · PDF only · up to 100 MB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
      </button>

      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3">
          <FileUp size={17} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{file.name}</p>
            <p className="mt-1 text-[10px] text-muted">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            {busy && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          {busy ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted">
              <LoaderCircle size={13} className="animate-spin text-accent" />
              {progress >= 100 ? "Indexing" : `${progress}%`}
            </span>
          ) : (
            <>
              <button
                className="button-primary h-8 shrink-0 px-3 text-[11px]"
                onClick={startUpload}
              >
                {error ? <RotateCcw size={13} /> : null}
                {error ? "Retry" : "Upload"}
              </button>
              <button
                className="icon-button h-7 w-7 shrink-0"
                aria-label="Remove selected file"
                onClick={() => {
                  setFile(null);
                  setError("");
                }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs leading-5 text-rose-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="flex items-start gap-2 text-xs leading-5 text-accent">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          {success}
        </p>
      )}
    </div>
  );
}
