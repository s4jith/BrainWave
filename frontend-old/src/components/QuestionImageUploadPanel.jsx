/**
 * QuestionImageUploadPanel
 *
 * Card-style image upload panel with a large dashed-border drop zone.
 * Supports both "Question Attachments" and "Answer Attachments" contexts.
 *
 * Props:
 *   title           {string}   - Card header label
 *   placeholder     {string}   - Text shown inside the upload zone
 *   text            {string}   - Optional: question text, for auto-inserting [img:id] tags
 *   onTextChange    {fn}       - Optional: called with new text after tag auto-insertion
 *   imageIds        {string[]} - Array of attached image IDs
 *   onImageIdsChange {fn}      - Called with updated array
 */

import { useState, useRef } from "react";
import { Upload, Copy, CheckCheck, Trash2, Loader2, Plus, Scissors } from "lucide-react";
import useUserStore from "../stores/userStore";
import authFetch from "../utils/authFetch";
import AuthImage from "./AuthImage";

const API_URL = import.meta.env.VITE_API_URL;

export default function QuestionImageUploadPanel({
  title = "Question Attachments",
  placeholder = "Click to upload",
  text,
  onTextChange,
  imageIds = [],
  onImageIdsChange,
  onCaptureRequest,
  captureDisabled = false,
}) {
  const { accessToken } = useUserStore();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pendingEmbedTag, setPendingEmbedTag] = useState("");
  const fileInputRef = useRef(null);

  const hasPendingPlacement = Boolean(onTextChange && pendingEmbedTag);

  const applyEmbedPlacement = (baseText, embedTag, placement) => {
    const currentText = typeof baseText === "string" ? baseText : "";
    switch (placement) {
      case "below": {
        const trimmed = currentText.trimEnd();
        return trimmed ? `${trimmed}\n${embedTag}` : embedTag;
      }
      case "top": {
        const trimmed = currentText.trimStart();
        return trimmed ? `${embedTag}\n${trimmed}` : embedTag;
      }
      case "end": {
        const sep = currentText && !currentText.endsWith(" ") ? " " : "";
        return `${currentText}${sep}${embedTag}`;
      }
      case "none":
      default:
        return currentText;
    }
  };

  const handlePlacementChoice = (placement) => {
    if (onTextChange && pendingEmbedTag) {
      const nextText = applyEmbedPlacement(text, pendingEmbedTag, placement);
      onTextChange(nextText);
    }
    setPendingEmbedTag("");
  };

  const doUpload = async (file) => {
    if (!file) return false;
    if (hasPendingPlacement) {
      setUploadError("Choose where to place the previous image before uploading another.");
      return false;
    }
    setUploading(true);
    setUploadError("");
    let success = false;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`${API_URL}/api/question-bank/images/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      onImageIdsChange([...imageIds, data.image_id]);
      // Ask placement only when this panel is tied to question text.
      if (onTextChange && typeof text === "string") {
        setPendingEmbedTag(data.embed_tag || `[img:${data.image_id}]`);
      }
      success = true;
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    return success;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doUpload(f);
  };

  const handleCopy = (id) => {
    navigator.clipboard.writeText(`[img:${id}]`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRemove = (id) => {
    onImageIdsChange(imageIds.filter((i) => i !== id));
    if (onTextChange && typeof text === "string") {
      onTextChange(text.replace(new RegExp(`\\[img:${id}\\]`, "g"), "").trim());
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-4 space-y-3">
      {/* Card title */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {typeof onCaptureRequest === "function" && (
          <button
            type="button"
            disabled={uploading || captureDisabled || hasPendingPlacement}
            onClick={() => onCaptureRequest(doUpload)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scissors size={12} /> Capture
          </button>
        )}
      </div>

      {/* Drop zone — hidden when images present, replaced by thumbnail list + add-more */}
      {imageIds.length === 0 && (
        <div
          onClick={() => !uploading && !hasPendingPlacement && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer select-none transition-colors ${
            uploading
              ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10 cursor-not-allowed"
              : hasPendingPlacement
              ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 cursor-not-allowed"
              : dragging
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
          }`}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin text-blue-400" />
          ) : (
            <Upload size={24} className="text-gray-400 dark:text-gray-500" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {uploading ? "Uploading…" : hasPendingPlacement ? "Choose placement for uploaded image" : placeholder}
          </span>
          {!uploading && (
            <span className="text-xs text-gray-300 dark:text-gray-600">
              JPEG · PNG · GIF · WebP &nbsp;·&nbsp; max 5 MB
            </span>
          )}
        </div>
      )}

      {/* Uploaded thumbnails */}
      {imageIds.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {imageIds.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-2"
              >
                <AuthImage
                  src={`${API_URL}/api/question-bank/images/${id}`}
                  alt=""
                  className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-zinc-600 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{id.slice(0, 12)}…</p>
                  {onTextChange && (
                    <code className="text-xs text-blue-600 dark:text-blue-400">[img:{id.slice(0, 8)}…]</code>
                  )}
                </div>
                {onTextChange && (
                  <button
                    type="button"
                    title="Copy embed tag"
                    onClick={() => handleCopy(id)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition flex-shrink-0"
                  >
                    {copiedId === id
                      ? <CheckCheck size={13} className="text-green-500" />
                      : <Copy size={13} />}
                  </button>
                )}
                <button
                  type="button"
                  title="Remove"
                  onClick={() => handleRemove(id)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add-more button (smaller zone) */}
          <div
            onClick={() => !uploading && !hasPendingPlacement && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 px-3 cursor-pointer select-none transition-colors ${
              uploading
                ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10 cursor-not-allowed"
                : hasPendingPlacement
                ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 cursor-not-allowed"
                : dragging
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            {uploading
              ? <Loader2 size={14} className="animate-spin text-blue-400" />
              : <Plus size={14} className="text-gray-400" />}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {uploading ? "Uploading…" : hasPendingPlacement ? "Choose placement first" : "Add another image"}
            </span>
          </div>
        </div>
      )}

      {hasPendingPlacement && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Where should this image be placed in question text?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePlacementChoice("below")}
              className="px-2.5 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            >
              Below text
            </button>
            <button
              type="button"
              onClick={() => handlePlacementChoice("end")}
              className="px-2.5 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            >
              End of line
            </button>
            <button
              type="button"
              onClick={() => handlePlacementChoice("top")}
              className="px-2.5 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            >
              Top of text
            </button>
            <button
              type="button"
              onClick={() => handlePlacementChoice("none")}
              className="px-2.5 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Keep as attachment only
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); }}
      />

      {uploadError && (
        <p className="text-xs text-red-500">{uploadError}</p>
      )}
    </div>
  );
}

