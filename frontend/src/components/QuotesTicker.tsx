'use client';

import { useEffect, useState } from 'react';

const QUOTES = [
  { text: 'Insanity is doing the same thing over and over again and expecting different results.', author: 'Albert Einstein' },
  { text: 'The stock market is a device for transferring money from the impatient to the patient.', author: 'Warren Buffett' },
  { text: 'Risk comes from not knowing what you are doing.', author: 'Warren Buffett' },
  { text: 'In investing, what is comfortable is rarely profitable.', author: 'Robert Arnott' },
  { text: 'The four most dangerous words in investing are: this time it\'s different.', author: 'Sir John Templeton' },
  { text: 'Wide diversification is only required when investors do not understand what they are doing.', author: 'Warren Buffett' },
  { text: 'The market is filled with individuals who know the price of everything, but the value of nothing.', author: 'Philip Fisher' },
  { text: 'It\'s not whether you\'re right or wrong, but how much money you make when you\'re right.', author: 'George Soros' },
  { text: 'The individual investor should act consistently as an investor and not as a speculator.', author: 'Benjamin Graham' },
  { text: 'Buy when everyone else is selling and hold until everyone else is buying.', author: 'J. Paul Getty' },
];

const INTERVAL_MS = 6000;

export function QuotesTicker({ bar = false }: { bar?: boolean }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 400);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const quote = QUOTES[index];

  if (bar) {
    return (
      <div className="lg:hidden fixed top-16 z-40 w-full h-8 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/10 flex items-center justify-center overflow-hidden px-6">
        <p
          className="text-[10px] text-on-surface/35 italic line-clamp-1 transition-opacity duration-400"
          style={{ opacity: visible ? 1 : 0 }}
        >
          &ldquo;{quote.text}&rdquo; — {quote.author}
        </p>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex flex-col items-center justify-center flex-1 min-w-0 px-8 overflow-hidden">
      <div
        className="text-center transition-opacity duration-400"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-[11px] text-on-surface/40 italic leading-tight line-clamp-1">
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="text-[10px] text-on-surface/25 mt-0.5 tracking-wide">
          — {quote.author}
        </p>
      </div>
    </div>
  );
}
