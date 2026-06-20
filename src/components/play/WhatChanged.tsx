"use client";
import { PartyPopper, X } from "lucide-react";
import { summarizeChange } from "@/lib/diff/summarizeChange";

export function WhatChanged({
  oldCode,
  newCode,
  onClose,
}: {
  oldCode: string;
  newCode: string;
  onClose: () => void;
}) {
  const { summary } = summarizeChange(oldCode, newCode);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-xl">
        <PartyPopper className="mx-auto mb-2 text-primary" size={36} />
        <h2 className="mb-2 text-xl font-bold">Here&apos;s what changed!</h2>
        <p className="mb-4 text-muted-foreground">{summary}</p>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground"
        >
          <X size={16} /> Keep playing
        </button>
      </div>
    </div>
  );
}
