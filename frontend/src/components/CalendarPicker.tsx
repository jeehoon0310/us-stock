"use client";
import { useEffect, useRef, useState } from "react";

interface CalendarPickerProps {
  value: string; // "YYYY-MM-DD"
  availableDates: Set<string>;
  onChange: (date: string) => void;
  onShift: (delta: number) => void;
  status?: string;
}

// 월요일 시작
const DAYS_KO = ["월", "화", "수", "목", "금", "토", "일"];

// NYSE 휴장일
const US_MARKET_HOLIDAYS = new Set([
  "2025-01-01","2025-01-20","2025-02-17","2025-04-18",
  "2025-05-26","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03",
  "2026-05-25","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-03-26",
  "2027-05-31","2027-07-05","2027-09-06","2027-11-25","2027-12-24",
]);

function isRedDay(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=일, 6=토
  return day === 0 || day === 6 || US_MARKET_HOLIDAYS.has(dateStr);
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${y}. ${m}. ${d}.`;
}

function toYM(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarPicker({
  value,
  availableDates,
  onChange,
  onShift,
  status,
}: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<string>(toYM(value || todayStr()));
  const ref = useRef<HTMLDivElement>(null);

  // value 변경 시 viewMonth 동기화
  useEffect(() => {
    if (value) setViewMonth(toYM(value));
  }, [value]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function shiftViewMonth(delta: number) {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function handleDayClick(dateStr: string) {
    if (!availableDates.has(dateStr)) return;
    onChange(dateStr);
    setOpen(false);
  }

  function handleToday() {
    // 가장 최신 available date로 이동
    const sorted = [...availableDates].sort();
    const latest = sorted[sorted.length - 1];
    if (latest) {
      onChange(latest);
      setViewMonth(toYM(latest));
    }
    setOpen(false);
  }

  function handleDelete() {
    setOpen(false);
  }

  // 달력 날짜 배열 생성 (월요일 시작)
  function buildCalendar() {
    const [y, m] = viewMonth.split("-").map(Number);
    const rawFirstDay = new Date(y, m - 1, 1).getDay(); // 0=일
    // 월요일=0, 화요일=1, ..., 토요일=5, 일요일=6
    const firstDayMon = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
    const total = daysInMonth(y, m - 1);
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];

    // 이전 달 빈칸 (숫자 미표시 — 현재 달과 혼동 방지)
    for (let i = 0; i < firstDayMon; i++) {
      cells.push({ day: null, dateStr: null });
    }
    // 이번 달
    for (let d = 1; d <= total; d++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, dateStr: ds });
    }
    // 다음 달 빈칸 (숫자 미표시 — 현재 달과 혼동 방지)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: null, dateStr: null });
    }
    return cells;
  }

  const cells = buildCalendar();
  const today = todayStr();
  const [vy, vm] = viewMonth.split("-").map(Number);

  return (
    <div className="relative" ref={ref}>
      {/* 날짜 표시 + 네비게이션 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onShift(-1)}
          className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center text-sm"
          title="이전 거래일"
        >
          ◀
        </button>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 transition-colors"
          title="날짜 선택"
        >
          <span className="text-sm font-bold text-primary">{formatDisplay(value)}</span>
          <span className="material-symbols-outlined text-on-surface-variant text-base" style={{ fontSize: "16px" }}>
            calendar_month
          </span>
        </button>

        <button
          onClick={() => onShift(1)}
          className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center text-sm"
          title="다음 거래일"
        >
          ▶
        </button>

        {status && (
          <span className="text-[10px] text-on-surface-variant ml-1">{status}</span>
        )}
      </div>

      {/* 팝업 캘린더 */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[280px] bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden">
          {/* 월 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
            <button
              onClick={() => shiftViewMonth(-1)}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors text-sm"
            >
              ◀
            </button>
            <span className="text-sm font-bold text-on-surface">
              {vy}년 {vm}월
            </span>
            <button
              onClick={() => shiftViewMonth(1)}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors text-sm"
            >
              ▶
            </button>
          </div>

          {/* 요일 헤더 (월요일 시작, 토/일 빨간색) */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS_KO.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] font-bold pb-1 ${i >= 5 ? "text-error/70" : "text-on-surface-variant"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {cells.map((cell, idx) => {
              const isCurrentMonth = cell.dateStr !== null;
              const hasData = cell.dateStr ? availableDates.has(cell.dateStr) : false;
              const isSelected = cell.dateStr === value;
              const isToday = cell.dateStr === today;
              // 실제 날짜 기반 빨간날(토/일/공휴일), 이전·다음 달은 위치 기반
              const isRed = cell.dateStr ? isRedDay(cell.dateStr) : idx % 7 >= 5;

              let cellCls =
                "w-full aspect-square flex items-center justify-center text-xs rounded-full transition-colors ";

              if (!isCurrentMonth) {
                cellCls += isRed
                  ? "text-error/15 cursor-default"
                  : "text-on-surface-variant/20 cursor-default";
              } else if (isSelected) {
                cellCls += "bg-primary text-on-primary font-bold cursor-pointer";
              } else if (hasData) {
                cellCls += "cursor-pointer hover:bg-primary/20 font-medium ";
                if (isToday) cellCls += "ring-1 ring-primary ";
                cellCls += isRed ? "text-error" : "text-on-surface";
              } else {
                // 이번 달이지만 데이터 없음 (주말/공휴일)
                cellCls += "cursor-not-allowed opacity-30 ";
                cellCls += isRed ? "text-error" : "text-on-surface-variant";
              }

              return (
                <button
                  key={idx}
                  className={cellCls}
                  onClick={() => cell.dateStr && handleDayClick(cell.dateStr)}
                  disabled={!hasData}
                  title={cell.dateStr ?? ""}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/10">
            <button
              onClick={handleDelete}
              className="text-xs font-bold text-primary hover:text-primary/70 transition-colors"
            >
              삭제
            </button>
            <button
              onClick={handleToday}
              className="text-xs font-bold text-primary hover:text-primary/70 transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
