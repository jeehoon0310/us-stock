"use client";
import Link from "next/link";
import { Suspense, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function ViewerContent() {
  const params = useSearchParams();
  const src = params.get("src") ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFSChange);
    document.addEventListener("webkitfullscreenchange", handleFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFSChange);
      document.removeEventListener("webkitfullscreenchange", handleFSChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className="viewer-fs fixed left-0 right-0 bottom-16 md:left-64 md:bottom-0 z-30 flex flex-col bg-surface-container-lowest"
      style={{ top: "64px" }}
    >
      {/* Compact toolbar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-outline-variant/10 flex-shrink-0">
        <Link
          href="/board"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low rounded-md text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border border-outline-variant/20"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_back</span>
          보드로 돌아가기
        </Link>

        <div className="flex items-center gap-2">
          {/* PDF download button */}
          {src && (
            <a
              href={src.replace("/prompts/", "/downloads/").replace(".html", ".pdf")}
              download
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low rounded-md text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors border border-outline-variant/20"
              title="PDF 파일로 내려받기"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
              PDF 내려받기
            </a>
          )}

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 flex items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant/20"
            title={isFullscreen ? "전체화면 종료" : "전체화면"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </div>

      {src ? (
        <iframe
          src={src}
          className="flex-1 w-full"
          style={{ border: "none" }}
          title="content"
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-on-surface-variant text-sm">
          콘텐츠를 찾을 수 없습니다
        </div>
      )}
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
