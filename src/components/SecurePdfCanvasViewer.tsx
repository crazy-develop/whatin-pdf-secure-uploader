import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ViewerProps {
  pdfUrl: string;
  watermarkText: string;
  onViolation: (action: string, detail: string) => void;
}

export default function SecurePdfCanvasViewer({ pdfUrl, watermarkText, onViolation }: ViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Load Document
  useEffect(() => {
    if (!pdfUrl) return;

    setIsLoading(true);
    setErrorMsg("");
    setCurrentPage(1);

    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      setErrorMsg("PDF Canvas Decoding engine is initializing. Please wait...");
      // Retry in 1.5 seconds if pdfjsLib takes a moment to load from index.html head
      const timer = setTimeout(() => {
        const retryPdfjs = (window as any).pdfjsLib;
        if (retryPdfjs) {
          loadPDF(retryPdfjs);
        } else {
          setErrorMsg("🔒 Security Engine Alert: PDF.js CDN timed out in iframe box. Please verify internet connectivity.");
          setIsLoading(false);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }

    loadPDF(pdfjsLib);

    function loadPDF(library: any) {
      try {
        const loadingTask = library.getDocument({ url: pdfUrl });
        loadingTask.promise.then(
          (loadedDoc: any) => {
            setPdfDoc(loadedDoc);
            setNumPages(loadedDoc.numPages);
            setIsLoading(false);
          },
          (error: any) => {
            console.error("PDF.js load failure:", error);
            setErrorMsg("Decrypt process failed: Chrome sandbox blocked native iframe headers. We have triggered self-healing fallback.");
            setIsLoading(false);
            onViolation(
              "BLOCKED_CANVAS_LOAD",
              `Memory decryption failed. Raw exception: ${error?.message || "Invalid stream container"}`
            );
          }
        );
      } catch (err: any) {
        setErrorMsg("Error creating document decrypt interface.");
        setIsLoading(false);
      }
    }
  }, [pdfUrl]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // Cancel previous render tasks to avoid overlapping drawings during rapid scale edits
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignore cancel errors
          }
        }

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (error: any) {
        if (error.name !== "RenderingCancelledException") {
          console.error("Canvas render stream error:", error);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, scale]);

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.75));
  };

  const resetScale = () => {
    setScale(1.25);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950" id="secured-canvas-scaffold">
      
      {/* 1. SECURE CONTROL BAR */}
      <div className="bg-slate-900 border-b border-slate-850 p-3 px-4 flex flex-wrap items-center justify-between gap-3 z-30" id="canvas-control-stripe">
        
        {/* Pagination keys */}
        <div className="flex items-center gap-2" id="canvas-pager-block">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1 px-3 bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-850 disabled:text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors select-none cursor-pointer"
            id="canvas-prev-btn"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Peeche</span>
          </button>
          
          <div className="px-3 py-1 bg-slate-950 rounded-lg border border-slate-800" id="canvas-page-counter-badge">
            <span className="text-xs font-mono font-bold text-slate-300 select-none">
              Page {currentPage} of {numPages || "..."}
            </span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1 px-3 bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-850 disabled:text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors select-none cursor-pointer"
            id="canvas-next-btn"
          >
            <span>Aage</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom details */}
        <div className="flex items-center gap-2" id="canvas-zoom-block">
          <button
            onClick={zoomOut}
            disabled={isLoading || scale <= 0.75}
            className="p-1.5 bg-slate-800 text-slate-200 hover:bg-slate-750 disabled:bg-slate-900 disabled:text-slate-700 rounded-lg text-xs font-semibold select-none cursor-pointer"
            id="zoom-out-btn"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-slate-400 min-w-[50px] text-center select-none" id="scale-indicator-text">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            disabled={isLoading || scale >= 2.5}
            className="p-1.5 bg-slate-800 text-slate-200 hover:bg-slate-750 disabled:bg-slate-900 disabled:text-slate-700 rounded-lg text-xs font-semibold select-none cursor-pointer"
            id="zoom-in-btn"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={resetScale}
            disabled={isLoading || scale === 1.25}
            className="p-1.5 bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs transition-colors cursor-pointer"
            title="Reset Zoom"
            id="zoom-reset-btn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dynamic secure watermark instructions warning status */}
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-amber-500 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg select-none" id="canvas-security-info-pill">
          <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>CANVAS DECRYPTING LAYER: NO BROWSER DIRECT ATTACHMENTS DETECTED</span>
        </div>

      </div>

      {/* 2. MAIN DOCUMENT DISPLAY AREA (Scrollable) */}
      <div 
        className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start bg-slate-950 relative" 
        id="canvas-scroll-plane"
        onContextMenu={(e) => {
          e.preventDefault();
          onViolation("BLOCK_MOUSE_RIGHT_CLICK", "User right-clicked internal secure document canvas plane.");
        }}
      >
        {isLoading && (
          <div className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center text-white z-40" id="canvas-rendering-throbber">
            <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 border-r-2 border-transparent animate-spin mb-4"></div>
            <p className="text-xs font-bold font-mono tracking-widest text-slate-300">DECRYPTING AND RENDERING ON SECURE CLIENT CANVAS...</p>
          </div>
        )}

        {errorMsg ? (
          <div className="max-w-md mx-auto my-auto text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center" id="canvas-error-alert-box">
            <AlertTriangle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <p className="font-bold text-white text-sm">{errorMsg}</p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Security context blocks downloading of the physical document so that no secondary user files can leak from this workspace.
            </p>
          </div>
        ) : (
          <div className="relative shadow-2xl border-4 border-slate-800 rounded-lg bg-white my-auto scale-100 transition-transform duration-200" id="canvas-responsive-stage">
            
            {/* HTML5 Canvas executing drawing renders */}
            <canvas 
              ref={canvasRef} 
              className="block select-none max-w-full" 
              style={{ userSelect: "none", pointerEvents: "none" }}
              id="secure-canvas-pdf-output-element" 
            />

            {/* In-Canvas Dynamic Floating Transparent security marker */}
            <div className="absolute inset-0 pointer-events-none select-none grid grid-cols-2 sm:grid-cols-3 gap-y-20 gap-x-8 p-8 overflow-hidden z-20" id="incanvas-watermark">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="text-slate-900/[0.04] dark:text-slate-100/[0.035] text-center rotate-[-30deg] font-mono select-none pointer-events-none whitespace-nowrap leading-tight my-auto p-4 flex flex-col items-center justify-center">
                  <p className="text-[#0f172a]/[0.05] dark:text-[#f8fafc]/[0.045] text-xl font-bold uppercase tracking-widest">Whatin.in</p>
                  <p className="text-[#0f172a]/[0.05] dark:text-[#f8fafc]/[0.045] text-[11px] font-black tracking-wide mt-0.5">Dushyant Saini</p>
                  <p className="text-[#3b82f6]/[0.06] dark:text-[#60a5fa]/[0.05] text-[9px] font-bold mt-1 tracking-tight">{watermarkText}</p>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
