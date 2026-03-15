import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scissors,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "./ui/button";
import authFetch from "../utils/authFetch";

const API_BASE = import.meta.env.VITE_API_URL;

export default function BookCaptureModal({
  open,
  onClose,
  classLevel,
  subject,
  chapter,
  onCapture,
}) {
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState("");

  const [activeLesson, setActiveLesson] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);

  const [imageUrl, setImageUrl] = useState(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageError, setPageError] = useState("");

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const imageRef = useRef(null);
  const currentBlobUrlRef = useRef(null);

  const canLoadLessons = open && classLevel && subject;

  useEffect(() => {
    if (!open) {
      setLessons([]);
      setActiveLesson(null);
      setNumPages(null);
      setPageNumber(1);
      setScale(1.2);
      setImageUrl(null);
      setLessonsError("");
      setPageError("");
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [open]);

  useEffect(() => {
    if (!canLoadLessons) return;

    const fetchLessons = async () => {
      setLoadingLessons(true);
      setLessonsError("");
      try {
        const response = await authFetch(
          `${API_BASE}/api/books/student/lessons?class_level=${classLevel}&subject=${encodeURIComponent(subject)}`
        );
        if (!response.ok) {
          throw new Error("Unable to fetch chapter books");
        }

        const data = await response.json();
        const fetched = (data.lessons || []).map((lesson) => ({
          ...lesson,
          pdfUrl: lesson.pdfUrl?.startsWith("http") ? lesson.pdfUrl : `${API_BASE}${lesson.pdfUrl || ""}`,
        }));

        setLessons(fetched);

        const chapterNumber = Number(chapter);
        const preferred = fetched.find((l) => Number(l.chapter_number) === chapterNumber);
        setActiveLesson(preferred || fetched[0] || null);
      } catch (err) {
        setLessons([]);
        setActiveLesson(null);
        setLessonsError(err.message || "Unable to fetch lessons");
      } finally {
        setLoadingLessons(false);
      }
    };

    fetchLessons();
  }, [canLoadLessons, classLevel, subject, chapter]);

  useEffect(() => {
    if (!open || !activeLesson) return;

    const fetchInfo = async () => {
      try {
        let response;
        if (activeLesson.book_id) {
          response = await authFetch(`${API_BASE}/api/books/render/${activeLesson.book_id}/info`);
        } else {
          throw new Error("No book linked for this chapter");
        }

        if (!response.ok) throw new Error("Unable to load selected chapter");
        const info = await response.json();
        setNumPages(info.numPages || null);
        setPageNumber(1);
        setPageError("");
      } catch (err) {
        setNumPages(null);
        setPageNumber(1);
        setPageError(err.message || "Unable to load chapter details");
      }
    };

    fetchInfo();
  }, [open, activeLesson]);

  useEffect(() => {
    if (!open || !activeLesson?.book_id || !numPages) return;

    let objectUrl;
    let cancelled = false;

    const fetchPage = async () => {
      setIsLoadingPage(true);
      setPageError("");
      try {
        const backendScale = 1.5 * scale;
        const response = await authFetch(
          `${API_BASE}/api/books/render/${activeLesson.book_id}/page/${pageNumber}?scale=${backendScale}&t=${Date.now()}`
        );
        if (!response.ok) throw new Error("Unable to load page image");

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setImageUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          currentBlobUrlRef.current = objectUrl;
          return objectUrl;
        });
      } catch (err) {
        if (!cancelled) {
          setPageError(err.message || "Unable to load page");
          setImageUrl(null);
        }
      } finally {
        if (!cancelled) setIsLoadingPage(false);
      }
    };

    fetchPage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, activeLesson, pageNumber, scale, numPages]);

  useEffect(() => {
    return () => {
      if (currentBlobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
    };
  }, []);

  const selectionStyle = useMemo(() => {
    if (!selectionStart || !selectionEnd) return {};
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    return {
      left: minX,
      top: minY,
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y),
    };
  }, [selectionStart, selectionEnd]);

  const beginSelection = () => {
    setIsSelecting(true);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const cancelSelection = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const onMouseDown = (e) => {
    if (!isSelecting || !imageRef.current || isCapturing) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const onMouseMove = (e) => {
    if (!isSelecting || !selectionStart || !imageRef.current || isCapturing) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setSelectionEnd({ x, y });
  };

  const onMouseUp = async () => {
    if (!isSelecting || !selectionStart || !selectionEnd || !imageRef.current || isCapturing) return;

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width < 20 || height < 20) {
      cancelSelection();
      return;
    }

    setIsCapturing(true);
    try {
      const img = imageRef.current;
      const ratioX = img.naturalWidth / img.clientWidth;
      const ratioY = img.naturalHeight / img.clientHeight;

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(width * ratioX);
      canvas.height = Math.floor(height * ratioY);

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        minX * ratioX,
        minY * ratioY,
        width * ratioX,
        height * ratioY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to capture image");

      const file = new File([
        blob,
      ], `chapter-${activeLesson?.chapter_number || chapter || "capture"}-page-${pageNumber}-${Date.now()}.png`, {
        type: "image/png",
      });

      const ok = await onCapture?.(file);
      if (ok !== false) {
        onClose();
      }
    } catch {
      // Parent handles upload error state; keep modal open for retry.
    } finally {
      setIsCapturing(false);
      cancelSelection();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-2xl overflow-hidden flex">
        <aside className="w-80 border-r border-gray-200 dark:border-zinc-700 flex flex-col bg-gray-50 dark:bg-zinc-950">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Select Chapter Book</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Class {classLevel || "-"} • {subject || "-"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingLessons && (
              <div className="text-sm text-gray-500 flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading books...
              </div>
            )}
            {lessonsError && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded p-2">{lessonsError}</div>
            )}
            {!loadingLessons && !lessonsError && lessons.length === 0 && (
              <div className="text-xs text-gray-500 p-2">No books found for this class and subject.</div>
            )}
            {lessons.map((lesson) => {
              const selected = activeLesson?.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setActiveLesson(lesson)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selected
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700"
                      : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-blue-200"
                  }`}
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">Chapter {lesson.chapter_number || "-"}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{lesson.title}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-gray-200 dark:border-zinc-700 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[320px]">
                {activeLesson?.title || "No chapter selected"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setScale((v) => Math.max(0.6, v - 0.2))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs min-w-[52px] text-center">{Math.round(scale * 100)}%</span>
              <Button variant="outline" size="icon" onClick={() => setScale((v) => Math.min(2.8, v + 0.2))}>
                <ZoomIn className="h-4 w-4" />
              </Button>

              <div className="w-px h-6 bg-gray-200 dark:bg-zinc-700 mx-1" />

              <Button
                variant={isSelecting ? "default" : "outline"}
                onClick={isSelecting ? cancelSelection : beginSelection}
                disabled={!imageUrl || isLoadingPage || isCapturing}
                className="gap-2"
              >
                <Scissors className="h-4 w-4" />
                {isSelecting ? "Cancel" : "Capture"}
              </Button>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={!numPages || pageNumber <= 1 || isLoadingPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300 min-w-[110px] text-center">
              Page {pageNumber} / {numPages || "--"}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
              disabled={!numPages || pageNumber >= numPages || isLoadingPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {isSelecting && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              Draw a rectangle on the page to capture and attach it.
            </div>
          )}

          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-zinc-950 p-4 flex items-center justify-center relative">
            {isLoadingPage && (
              <div className="absolute inset-0 bg-white/70 dark:bg-black/50 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading page...
                </div>
              </div>
            )}

            {pageError && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
                {pageError}
              </div>
            )}

            {!pageError && imageUrl && (
              <div className="relative">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={`Chapter page ${pageNumber}`}
                  className={`rounded shadow-lg select-none ${isSelecting ? "cursor-crosshair" : ""}`}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  style={{
                    width: `${Math.round(scale * 100)}%`,
                    maxWidth: "none",
                    height: "auto",
                  }}
                  draggable={false}
                />

                {isSelecting && selectionStart && selectionEnd && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-400/20 pointer-events-none"
                    style={selectionStyle}
                  />
                )}
              </div>
            )}
          </div>

          {isCapturing && (
            <div className="border-t border-gray-200 dark:border-zinc-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing capture...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
