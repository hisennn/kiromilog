"use client";

import { useEffect, useState } from "react";

type ToastEvent = {
  id: number;
  message: string;
  type: "success" | "danger" | "info";
};

let nextId = 0;
let listeners: ((event: ToastEvent) => void)[] = [];

export function toast(message: string, type: "success" | "danger" | "info" = "success") {
  const event: ToastEvent = { id: nextId++, message, type };
  listeners.forEach((listener) => listener(event));
}

export function Toaster() {
  const [currentToast, setCurrentToast] = useState<ToastEvent | null>(null);

  useEffect(() => {
    let timeortId: NodeJS.Timeout;
    
    const listener = (event: ToastEvent) => {
      setCurrentToast(event);
      clearTimeout(timeortId);
      timeortId = setTimeout(() => {
        setCurrentToast(null);
      }, 3000);
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
      clearTimeout(timeortId);
    };
  }, []);

  if (!currentToast) return null;

  if (currentToast.type === "danger") {
    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#1c1110] border border-[#d96b61]/40 px-5 py-3 rounded shadow-2xl animate-fade-in-up text-[14px] font-medium text-foreground">
        <svg className="text-[#d96b61]" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {currentToast.message}
      </div>
    );
  }

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#131b14] border border-[#238636]/40 px-5 py-3 rounded shadow-2xl animate-fade-in-up text-[14px] font-medium text-foreground">
      <svg className="text-[#238636]" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      {currentToast.message}
    </div>
  );
}
