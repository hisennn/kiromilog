"use client";

import { Check, CheckCircle } from "iconoir-react";
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
    let timeoutId: NodeJS.Timeout;
    
    const listener = (event: ToastEvent) => {
      setCurrentToast(event);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setCurrentToast(null);
      }, 3000);
    };

    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!currentToast) return null;

  if (currentToast.type === "danger") {
    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#1c1110] border border-[#d96b61]/40 px-5 py-3 rounded shadow-2xl animate-fade-in-up text-[14px] font-medium text-foreground">
        <Check className="text-[#d96b61]" width={18} height={18} strokeWidth={2.5} />
        {currentToast.message}
      </div>
    );
  }

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#131b14] border border-[#238636]/40 px-5 py-3 rounded shadow-2xl animate-fade-in-up text-[14px] font-medium text-foreground">
      <CheckCircle className="text-[#238636]" width={18} height={18} strokeWidth={2.5} />
      {currentToast.message}
    </div>
  );
}
