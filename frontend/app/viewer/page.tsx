"use client";
import Link from "next/link";
import { Suspense, useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

function PdfPasswordModal({
  filename,
  onSuccess,
  onClose,
}: {
  filename: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/download/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
        const a = document.createElement("a");
        a.href = `/api/download/file/${encodeURIComponent(filename)}`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError("비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 p-6 w-80 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary">lock</span>
          <h2 className="text-base font-bold text-on-surface">PDF 내려받기</h2>
        </div>
        <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
          수업에서 공유된 비밀번호를 입력하세요.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg pl-3 pr-11 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {show ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {error && <div className="text-[11px] text-error font-medium">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-container text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container-high transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex-1 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {submitting ? "확인 중..." : "확인"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewerContent() {
  const params = useSearchParams();
  const src = params.get("src") ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfAuthed, setPdfAuthed] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const pdfFilename = src
    ? (src.split("/").pop()?.replace(".html", ".pdf") ?? "")
    : "";

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

  const handlePdfClick = useCallback(() => {
    if (!pdfFilename) return;
    if (pdfAuthed) {
      const a = document.createElement("a");
      a.href = `/api/download/file/${encodeURIComponent(pdfFilename)}`;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setShowPdfModal(true);
    }
  }, [pdfAuthed, pdfFilename]);

  return (
    <div
      ref={containerRef}
      className="viewer-fs fixed left-0 right-0 bottom-16 md:left-64 md:bottom-0 z-30 flex flex-col bg-surface-container-lowest"
      style={{ top: "64px" }}
    >
      {showPdfModal && pdfFilename && (
        <PdfPasswordModal
          filename={pdfFilename}
          onSuccess={() => { setPdfAuthed(true); setShowPdfModal(false); }}
          onClose={() => setShowPdfModal(false)}
        />
      )}

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
          {src && pdfFilename && (
            <button
              onClick={handlePdfClick}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-low rounded-md text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors border border-outline-variant/20"
              title="PDF 파일로 내려받기"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>download</span>
              PDF 내려받기
            </button>
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
