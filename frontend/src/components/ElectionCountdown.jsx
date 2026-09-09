import { useEffect, useState } from "react";

/**
 * ElectionCountdown component displays start & end time metadata and
 * a real-time countdown timer with a prominent 1-minute warning state.
 */
export default function ElectionCountdown({ startTime, endTime, onExpired, isClosed }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    if (!endTime) return { totalMs: 0, seconds: 0, minutes: 0, hours: 0, days: 0, isExpired: true };
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) {
      return { totalMs: 0, seconds: 0, minutes: 0, hours: 0, days: 0, isExpired: true };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { totalMs: diff, seconds, minutes, hours, days, isExpired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining.isExpired && onExpired) {
        onExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  function formatDateTime(dateStr) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  const isOneMinuteOrLess = !timeLeft.isExpired && timeLeft.totalMs <= 60 * 1000;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="font-semibold text-slate-700">🟢 Start Time:</span>
          <span>{formatDateTime(startTime)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 sm:justify-end">
          <span className="font-semibold text-slate-700">🔴 Closing Time:</span>
          <span>{formatDateTime(endTime)}</span>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Election Clock &amp; Status
        </span>

        {isClosed || timeLeft.isExpired ? (
          <div className="bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
            <span>🔒</span>
            <span>Voting is Closed (Closing Time Reached)</span>
          </div>
        ) : isOneMinuteOrLess ? (
          <div className="bg-red-500 text-white border border-red-600 text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-md animate-pulse">
            <span className="text-sm">⚠️</span>
            <span>FINAL COUNTDOWN: {String(timeLeft.seconds).padStart(2, "0")}s REMAINING!</span>
          </div>
        ) : (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm font-mono">
            <span>⏳</span>
            <span>
              Closes in:{" "}
              {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
              {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
