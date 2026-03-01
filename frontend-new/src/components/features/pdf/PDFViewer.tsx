// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  History,
  Eye,
  EyeOff,
  HelpCircle,
  BookOpen,
  GitBranch,
  Sparkles,
  X,
  Scissors,
  BookMarked,
  StickyNote,
  Loader2,
  AlertCircle,
} from "lucide-react";
import useAnnotationStore from '@/stores/annotationStore';
import AIPanel from "../annotations/AIPanel";
import NotesPanel from "../annotations/NotesPanel";
import HistoryPanel from "../annotations/HistoryPanel";
import HighlightOverlay from "../annotations/HighlightOverlay";
import NoteTaker from "./NoteTaker";

export default function PDFViewer({ pdfUrl, currentLesson }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [showHistory, setShowHistory] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState("next");
  const [pagesCompleted, setPagesCompleted] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showNotes, setShowNotes] = useState(false);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  const setSelectedText = useAnnotationStore((state) => state.setSelectedText);
  const activePanel = useAnnotationStore((state) => state.activePanel);
  const setActivePanel = useAnnotationStore((state) => state.setActivePanel);

  const bookId = currentLesson?.book_id;

  const isCloudinaryUrl = pdfUrl?.startsWith('http');

  const getFilePath = useCallback(() => {
    if (!pdfUrl || isCloudinaryUrl) return null;
    const match = pdfUrl.match(/\/api\/books\/pdf\/(.+)$/);
    return match ? match[1] : null;
  }, [pdfUrl, isCloudinaryUrl]);

  useEffect(() => {
    const fetchPdfInfo = async () => {
      try {
        let response;

        if (bookId) {

          response = await fetch(`${API_BASE}/api/books/render/${bookId}/info`);
        } else {

          const filePath = getFilePath();
          if (!filePath) return;
          response = await fetch(`${API_BASE}/api/books/pdf-info/${filePath}`);
        }

        if (!response.ok) {
          throw new Error("Failed to get PDF info");
        }

        const info = await response.json();
        setNumPages(info.numPages);
        setPageNumber(1);
        setLoadError(null);
      } catch (error) {
        console.error("Error fetching PDF info:", error);
        setLoadError("Failed to load PDF information");
      }
    };

    if (pdfUrl || bookId) {
      fetchPdfInfo();
    }
  }, [pdfUrl, bookId, getFilePath, API_BASE]);

  useEffect(() => {
    const loadPage = async () => {
      if (!numPages) return;

      setIsLoading(true);
      const backendScale = 1.5 * scale;

      let url;
      if (bookId) {

        url = `${API_BASE}/api/books/render/${bookId}/page/${pageNumber}?scale=${backendScale}`;
      } else {

        const filePath = getFilePath();
        if (!filePath) return;
        url = `${API_BASE}/api/books/pdf-page/${filePath}?page=${pageNumber}&scale=${backendScale}`;
      }

      setImageUrl(url);
    };

    loadPage();
  }, [pageNumber, scale, numPages, bookId, getFilePath, API_BASE]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault();
          goToNextPage();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goToPrevPage();
          break;
        case "d":
        case "D":
          e.preventDefault();
          startSelectionMode();
          break;
        case "Escape":
          cancelSelection();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [pageNumber, numPages, isTransitioning, isSelecting]);

  const goToPrevPage = () => {
    if (pageNumber <= 1 || isTransitioning) return;
    setDirection("prev");
    setIsTransitioning(true);
    setTimeout(() => {
      setPageNumber((prev) => Math.max(prev - 1, 1));
      setTimeout(() => setIsTransitioning(false), 150);
    }, 200);
  };

  const goToNextPage = () => {
    if (pageNumber >= numPages || isTransitioning) return;
    setDirection("next");
    setIsTransitioning(true);
    setTimeout(() => {
      setPageNumber((prev) => {
        const nextPage = Math.min(prev + 1, numPages);
        if (nextPage > pagesCompleted) {
          setPagesCompleted(nextPage);
        }
        return nextPage;
      });
      setTimeout(() => setIsTransitioning(false), 150);
    }, 200);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const startSelectionMode = () => {
    setIsSelecting(true);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedArea(null);
    setShowActionPopup(false);
  };

  const cancelSelection = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedArea(null);
    setShowActionPopup(false);
  };

  const handleMouseDown = (e) => {
    if (!isSelecting) return;

    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionStart) return;

    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setSelectionEnd({ x, y });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width > 20 && height > 20) {
      setSelectedArea({ x: minX, y: minY, width, height });
      setShowActionPopup(true);
      setIsSelecting(false);
    }
  };

  const getSelectionStyle = () => {
    if (!selectionStart || !selectionEnd) return {};

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return {
      left: minX,
      top: minY,
      width,
      height,
    };
  };

  const fetchAdminChapterSummary = async () => {
    if (!currentLesson) return;
    setSummaryLoading(true);
    setShowSummaryModal(true);
    setSummaryData(null);
    try {
      const subject = currentLesson.subject || currentLesson.book_subject || "";
      const classLevel = currentLesson.classLevel || currentLesson.class_level || currentLesson.book_class || 0;
      const chapterNumber = currentLesson.chapter_number || currentLesson.chapterNumber || currentLesson.number || 1;
      const res = await fetch(
        `${API_BASE}/api/curriculum/chapter-summary-by-book?subject_name=${encodeURIComponent(subject)}&class_level=${classLevel}&chapter_number=${chapterNumber}`
      );
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      setSummaryData(data);
    } catch (err) {
      console.error("Failed to fetch chapter summary:", err);
      setSummaryData({ summary: "", has_summary: false, error: true });
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAction = async (action) => {
    if (!selectedArea || !imageRef.current) return;

    setIsProcessing(true);

    try {

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const img = imageRef.current;
      const displayedWidth = img.clientWidth;
      const displayedHeight = img.clientHeight;

      const ratioX = img.naturalWidth / displayedWidth;
      const ratioY = img.naturalHeight / displayedHeight;

      canvas.width = selectedArea.width * ratioX;
      canvas.height = selectedArea.height * ratioY;

      ctx.drawImage(
        img,
        selectedArea.x * ratioX,
        selectedArea.y * ratioY,
        selectedArea.width * ratioX,
        selectedArea.height * ratioY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const imageData = canvas.toDataURL("image/png");

      setSelectedText({
        text: `[Screenshot from page ${pageNumber}]`,
        imageData: imageData,
        action: action,
        pageNumber: pageNumber,
        lessonId: currentLesson?.id,
        position: { x: 0, y: 0 },
      });

      setActivePanel("ai");
      setShowActionPopup(false);
      setSelectedArea(null);

    } catch (error) {
      console.error("Error processing selection:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClosePanel = () => {
    setActivePanel(null);
    setSelectedText(null);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setLoadError(null);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setLoadError("Failed to load page. Please try again.");
  };

  return (
    <div className="flex flex-col h-full relative">
      { }
      <AIPanel
        open={activePanel === "ai"}
        onClose={handleClosePanel}
        currentLesson={currentLesson}
        pageNumber={pageNumber}
      />
      <NotesPanel
        open={activePanel === "note"}
        onClose={handleClosePanel}
        currentLesson={currentLesson}
        pageNumber={pageNumber}
      />
      <HistoryPanel
        open={showHistory || activePanel === "history"}
        onClose={() => {
          setShowHistory(false);
          setActivePanel(null);
        }}
        currentLesson={currentLesson}
      />

      { }
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            Page {pageNumber} of {numPages || "--"}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowAnnotations(!showAnnotations)}
            title={showAnnotations ? "Hide annotations" : "Show annotations"}
          >
            {showAnnotations ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(true)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAdminChapterSummary}
            disabled={!currentLesson || isLoading}
            className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50"
            title="View chapter summary"
          >
            <BookMarked className="h-4 w-4 mr-2" />
            Summary
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
            disabled={!currentLesson || isLoading}
            className={`mr-4 ${showNotes ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50'}`}
            title={showNotes ? "Hide notes panel" : "Take notes for this page"}
          >
            <StickyNote className="h-4 w-4 mr-2" />
            {showNotes ? "Hide Notes" : "Notes"}
          </Button>

          <Button variant="outline" size="icon" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection Mode Indicator */}
      {isSelecting && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Scissors className="h-4 w-4" />
          <span className="text-sm font-medium">Draw a box around your doubt</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-orange-700"
            onClick={cancelSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gradient-to-b from-muted/20 to-muted/40 p-6 relative"
      >
        <div className="flex justify-center relative book-container">
          {currentLesson ? (
            <div
              className={`relative transition-all duration-300 ease-out ${isTransitioning
                ? direction === "next"
                  ? "page-turn-next"
                  : "page-turn-prev"
                : "page-turn-idle"
                }`}
            >
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20 min-h-[600px] min-w-[400px] backdrop-blur-sm transition-all duration-300">
                  <div className="flex flex-col items-center gap-6">
                    {/* Modern Animated Book Loader */}
                    <div className="relative w-20 h-20">
                      {/* Outer Ring */}
                      <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>

                      {/* Inner Book Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-orange-600 animate-pulse" />
                      </div>
                    </div>

                    <div className="text-center space-y-1">
                      <p className="text-lg font-semibold text-gray-800 animate-pulse">
                        Loading Page {pageNumber}...
                      </p>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Preparing your content
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {loadError && !isLoading && (
                <div className="flex flex-col items-center justify-center h-[600px] w-[400px] gap-4 bg-muted/50 rounded-lg">
                  <div className="text-destructive font-medium">{loadError}</div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLoadError(null);
                      setIsLoading(true);
                      const backendScale = 1.5 * scale;
                      let url;
                      if (bookId) {
                        url = `${API_BASE}/api/books/render/${bookId}/page/${pageNumber}?scale=${backendScale}&t=${Date.now()}`;
                      } else {
                        const filePath = getFilePath();
                        if (filePath) {
                          url = `${API_BASE}/api/books/pdf-page/${filePath}?page=${pageNumber}&scale=${backendScale}&t=${Date.now()}`;
                        }
                      }
                      if (url) setImageUrl(url);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Rendered PDF Page Image */}
              {imageUrl && !loadError && (
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={`Page ${pageNumber}`}
                    crossOrigin="anonymous"
                    className={`pdf-page-shadow rounded-lg max-w-full ${isSelecting ? "cursor-crosshair" : ""
                      }`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{
                      display: isLoading ? "none" : "block",
                      maxHeight: "calc(100vh - 200px)",
                      userSelect: "none",
                    }}
                    draggable={false}
                  />

                  {/* Selection Rectangle */}
                  {isSelecting && selectionStart && selectionEnd && (
                    <div
                      className="absolute border-2 border-blue-500 bg-orange-500/20 pointer-events-none"
                      style={getSelectionStyle()}
                    />
                  )}

                  {/* Selected Area Highlight */}
                  {selectedArea && showActionPopup && (
                    <div
                      className="absolute border-2 border-blue-500 bg-orange-500/10"
                      style={{
                        left: selectedArea.x,
                        top: selectedArea.y,
                        width: selectedArea.width,
                        height: selectedArea.height,
                      }}
                    />
                  )}
                </div>
              )}

              {/* Highlight Overlay */}
              {showAnnotations && !isLoading && !loadError && (
                <HighlightOverlay
                  pageNumber={pageNumber}
                  scale={scale}
                  currentLesson={currentLesson}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[600px]">
              <div className="text-center p-8">
                <div className="text-lg font-medium text-muted-foreground mb-2">
                  No lesson selected
                </div>
                <div className="text-sm text-muted-foreground">
                  Select a lesson from the sidebar to view its content
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Popup - Appears after selection */}
        {showActionPopup && selectedArea && (
          <div
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
            onClick={() => {
              setShowActionPopup(false);
              setSelectedArea(null);
            }}
          >
            <div
              className="bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">What do you want to know?</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowActionPopup(false);
                    setSelectedArea(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start gap-4 hover:bg-orange-50 hover:border-blue-200 dark:hover:bg-orange-950/30"
                  onClick={() => handleAction("define")}
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                    <BookOpen className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Define</div>
                    <div className="text-xs text-muted-foreground">Simple explanation</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start gap-4 hover:bg-emerald-50 hover:border-emerald-200 dark:hover:bg-emerald-950/30"
                  onClick={() => handleAction("stickflow")}
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                    <GitBranch className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Stick Flow</div>
                    <div className="text-xs text-muted-foreground">Step-by-step breakdown</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start gap-4 hover:bg-amber-50 hover:border-amber-200 dark:hover:bg-amber-950/30"
                  onClick={() => handleAction("elaborate")}
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Elaborate</div>
                    <div className="text-xs text-muted-foreground">Detailed explanation</div>
                  </div>
                </Button>
              </div>

              {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating "Doubt?" Button */}
        {currentLesson && !isLoading && !loadError && !isSelecting && !showActionPopup && (
          <Button
            className="fixed bottom-6 right-6 h-14 px-6 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 z-40 gap-2"
            onClick={startSelectionMode}
            title="Have a doubt? Select an area to ask AI (Press D)"
          >
            <HelpCircle className="h-5 w-5" />
            <span className="font-medium">Doubt?</span>
          </Button>
        )}

        {/* NoteTaker Component - Persistent notes for current page (toggleable) */}
        {showNotes && currentLesson && !isLoading && !loadError && (
          <NoteTaker
            currentLesson={currentLesson}
            pageNumber={pageNumber}
            onClose={() => setShowNotes(false)}
          />
        )}
      </div>

      {/* Admin Chapter Summary Modal */}
      {showSummaryModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <BookMarked className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Chapter Summary</p>
                  <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                    {summaryData?.chapter_name || currentLesson?.title || "Chapter Summary"}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6">
              {summaryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="ml-3 text-gray-500">Loading summary...</span>
                </div>
              ) : summaryData?.error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
                  <p className="font-medium text-gray-700 dark:text-gray-300">Could not load summary</p>
                  <p className="text-sm text-gray-500 mt-1">Please try again later</p>
                </div>
              ) : summaryData?.has_summary ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: summaryData.summary }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-medium text-gray-600 dark:text-gray-400">No summary available yet</p>
                  <p className="text-sm text-gray-400 mt-1">Your teacher hasn't written a summary for this chapter yet</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-gray-50 dark:bg-gray-800 flex justify-end">
              <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
