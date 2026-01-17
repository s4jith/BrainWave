import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../../components/ui/button";
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
} from "lucide-react";
import useAnnotationStore from "../../stores/annotationStore";
import AIPanel from "../annotations/AIPanel";
import NotesPanel from "../annotations/NotesPanel";
import HistoryPanel from "../annotations/HistoryPanel";
import HighlightOverlay from "../annotations/HighlightOverlay";

/**
 * PDF Viewer Component with "Doubt" Screenshot Feature
 *
 * Simple flow:
 * 1. Student reads book
 * 2. Has doubt → clicks "Doubt?" button
 * 3. Draws box around confusing area
 * 4. Picks Define/Stick Flow/Elaborate
 * 5. AI retrieves from Pinecone and answers
 */

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

  // Doubt selection states
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const imageRef = useRef(null);
  const containerRef = useRef(null);
  
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const setSelectedText = useAnnotationStore((state) => state.setSelectedText);
  const activePanel = useAnnotationStore((state) => state.activePanel);
  const setActivePanel = useAnnotationStore((state) => state.setActivePanel);

  // Get book ID from currentLesson
  const bookId = currentLesson?.book_id;
  
  // Check if pdfUrl is a Cloudinary URL (starts with http)
  const isCloudinaryUrl = pdfUrl?.startsWith('http');
  
  // Extract file path from local pdfUrl (legacy support)
  const getFilePath = useCallback(() => {
    if (!pdfUrl || isCloudinaryUrl) return null;
    const match = pdfUrl.match(/\/api\/books\/pdf\/(.+)$/);
    return match ? match[1] : null;
  }, [pdfUrl, isCloudinaryUrl]);

  // Get PDF info (page count) on load
  useEffect(() => {
    const fetchPdfInfo = async () => {
      try {
        let response;
        
        if (bookId) {
          // Use new book ID-based endpoint for Cloudinary PDFs
          response = await fetch(`${API_BASE}/api/books/render/${bookId}/info`);
        } else {
          // Legacy: use file path-based endpoint
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

  // Load page image when page number or scale changes
  useEffect(() => {
    const loadPage = async () => {
      if (!numPages) return;
      
      setIsLoading(true);
      const backendScale = 1.5 * scale;
      
      let url;
      if (bookId) {
        // Use new book ID-based endpoint for Cloudinary PDFs
        url = `${API_BASE}/api/books/render/${bookId}/page/${pageNumber}?scale=${backendScale}`;
      } else {
        // Legacy: use file path-based endpoint
        const filePath = getFilePath();
        if (!filePath) return;
        url = `${API_BASE}/api/books/pdf-page/${filePath}?page=${pageNumber}&scale=${backendScale}`;
      }
      
      setImageUrl(url);
    };

    loadPage();
  }, [pageNumber, scale, numPages, bookId, getFilePath, API_BASE]);

  // Keyboard navigation
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

  // Start selection mode
  const startSelectionMode = () => {
    setIsSelecting(true);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedArea(null);
    setShowActionPopup(false);
  };

  // Cancel selection
  const cancelSelection = () => {
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setSelectedArea(null);
    setShowActionPopup(false);
  };

  // Handle mouse down for selection
  const handleMouseDown = (e) => {
    if (!isSelecting) return;

    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  // Handle mouse move for selection
  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionStart) return;

    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    setSelectionEnd({ x, y });
  };

  // Handle mouse up for selection
  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;

    // Calculate selection area
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;

    // Only process if selection is meaningful (at least 20x20 pixels)
    if (width > 20 && height > 20) {
      setSelectedArea({ x: minX, y: minY, width, height });
      setShowActionPopup(true);
      setIsSelecting(false);
    }
  };

  // Get selection rectangle style
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

  // Handle action selection (Define, Stick Flow, Elaborate)
  const handleAction = async (action) => {
    if (!selectedArea || !imageRef.current) return;

    setIsProcessing(true);

    try {
      // Create canvas to capture the selected area
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Get the displayed image dimensions
      const img = imageRef.current;
      const displayedWidth = img.clientWidth;
      const displayedHeight = img.clientHeight;

      // Calculate the ratio between natural and displayed size
      const ratioX = img.naturalWidth / displayedWidth;
      const ratioY = img.naturalHeight / displayedHeight;

      // Set canvas size to the selected area (in natural image coordinates)
      canvas.width = selectedArea.width * ratioX;
      canvas.height = selectedArea.height * ratioY;

      // Draw the selected portion
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

      // Convert to base64
      const imageData = canvas.toDataURL("image/png");

      // Set the selected text with image data and action
      setSelectedText({
        text: `[Screenshot from page ${pageNumber}]`,
        imageData: imageData,
        action: action,
        pageNumber: pageNumber,
        lessonId: currentLesson?.id,
        position: { x: 0, y: 0 },
      });

      // Open AI panel
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
      {/* Panels */}
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

      {/* PDF Controls */}
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
            className="mr-4"
          >
            <History className="h-4 w-4 mr-2" />
            History
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-violet-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Scissors className="h-4 w-4" />
          <span className="text-sm font-medium">Draw a box around your doubt</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-violet-700"
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
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 min-h-[600px] min-w-[400px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-muted-foreground">
                      Loading page {pageNumber}...
                    </span>
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
                      className="absolute border-2 border-violet-500 bg-violet-500/20 pointer-events-none"
                      style={getSelectionStyle()}
                    />
                  )}

                  {/* Selected Area Highlight */}
                  {selectedArea && showActionPopup && (
                    <div
                      className="absolute border-2 border-violet-500 bg-violet-500/10"
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
                  className="h-auto py-4 px-4 justify-start gap-4 hover:bg-violet-50 hover:border-violet-200 dark:hover:bg-violet-950/30"
                  onClick={() => handleAction("define")}
                  disabled={isProcessing}
                >
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
                    <BookOpen className="h-5 w-5 text-violet-600" />
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
            className="fixed bottom-6 right-6 h-14 px-6 rounded-full shadow-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 z-40 gap-2"
            onClick={startSelectionMode}
            title="Have a doubt? Select an area to ask AI (Press D)"
          >
            <HelpCircle className="h-5 w-5" />
            <span className="font-medium">Doubt?</span>
          </Button>
        )}
      </div>
    </div>
  );
}
