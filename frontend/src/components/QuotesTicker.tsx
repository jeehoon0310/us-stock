'use client';

const QUOTE = {
  text: 'Insanity is doing the same thing over and over again and expecting different results.',
  author: 'Albert Einstein',
};

export function QuotesTicker({ bar = false }: { bar?: boolean }) {
  if (bar) {
    return (
      <div className="lg:hidden fixed top-16 z-40 w-full h-8 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/10 flex items-center justify-center overflow-hidden px-6">
        <p className="text-[10px] text-on-surface/35 italic line-clamp-1">
          &ldquo;{QUOTE.text}&rdquo; — {QUOTE.author}
        </p>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex flex-col items-center justify-center flex-1 min-w-0 px-8 overflow-hidden">
      <div className="text-center">
        <p className="text-[11px] text-on-surface/40 italic leading-tight line-clamp-1">
          &ldquo;{QUOTE.text}&rdquo;
        </p>
        <p className="text-[10px] text-on-surface/25 mt-0.5 tracking-wide">
          — {QUOTE.author}
        </p>
      </div>
    </div>
  );
}
