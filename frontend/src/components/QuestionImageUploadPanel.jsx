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
import { Upload, Copy, CheckCheck, Trash2, Loader2, Plus } from "lucide-react";
import useUserStore from "../stores/userStore";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function QuestionImageUploadPanel({
  title = "Question Attachments",
  placeholder = "Click to upload",
  text,
  onTextChange,
  imageIds = [],
  onImageIdsChange,
}) {
  const { accessToken } = useUserStore();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const doUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/question-bank/images/upload`, {
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
      // Only embed tag when this panel is tied to question text
      if (onTextChange && typeof text === "string") {
        const sep = text && !text.endsWith(" ") ? " " : "";
        onTextChange(text + sep + data.embed_tag);
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>

      {/* Drop zone — hidden when images present, replaced by thumbnail list + add-more */}
      {imageIds.length === 0 && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer select-none transition-colors ${
            uploading
              ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10 cursor-not-allowed"
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
            {uploading ? "Uploading…" : placeholder}
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
                <img
                  src={`${API_URL}/api/question-bank/images/${id}`}
                  alt=""
                  className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-zinc-600 flex-shrink-0"
                  onError={(e) => { e.target.style.display = "none"; }}
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
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 px-3 cursor-pointer select-none transition-colors ${
              uploading
                ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10 cursor-not-allowed"
                : dragging
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            {uploading
              ? <Loader2 size={14} className="animate-spin text-blue-400" />
              : <Plus size={14} className="text-gray-400" />}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {uploading ? "Uploading…" : "Add another image"}
            </span>
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

