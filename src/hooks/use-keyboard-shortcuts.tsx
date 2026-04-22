"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcuts for admin panel
export const adminShortcuts = {
  // Navigation
  goToDashboard: { key: "g", ctrlKey: true, shiftKey: false, description: "Go to Dashboard" },
  goToGateway: { key: "g", ctrlKey: true, description: "Go to Gateway Settings" },
  goToMasterData: { key: "m", ctrlKey: true, description: "Go to Master Data" },
  goToTransactions: { key: "t", ctrlKey: true, description: "Go to Transactions" },
  goToVouchers: { key: "v", ctrlKey: true, description: "Go to Voucher Operations" },
  goToRatings: { key: "r", ctrlKey: true, description: "Go to Ratings" },

  // Actions
  newRoom: { key: "n", ctrlKey: true, shiftKey: false, description: "Add New Room" },
  newVendor: { key: "n", ctrlKey: true, shiftKey: true, description: "Add New Vendor" },
  newTransaction: { key: "n", ctrlKey: true, altKey: true, description: "Add New Transaction" },
  generateVouchers: { key: "g", ctrlKey: true, altKey: true, description: "Generate Vouchers" },
  search: { key: "/", description: "Focus Search" },

  // General
  refresh: { key: "F5", description: "Refresh Page" },
  escape: { key: "Escape", description: "Close Modal/Dialog" },
  help: { key: "?", shiftKey: true, description: "Show Keyboard Shortcuts" },
} as const;

// Component to show keyboard shortcuts help
export function KeyboardShortcutsHelp({ shortcuts }: { shortcuts?: KeyboardShortcut[] }) {
  const defaultShortcuts: KeyboardShortcut[] = [
    { ...adminShortcuts.goToDashboard, handler: () => (window.location.href = "/admin#overview") },
    { ...adminShortcuts.goToMasterData, handler: () => (window.location.href = "/admin#master-data") },
    { ...adminShortcuts.goToTransactions, handler: () => (window.location.href = "/admin#transactions") },
    { ...adminShortcuts.goToVouchers, handler: () => (window.location.href = "/admin#vouchers") },
    { ...adminShortcuts.goToRatings, handler: () => (window.location.href = "/admin#ratings") },
    { ...adminShortcuts.refresh, handler: () => window.location.reload() },
    { ...adminShortcuts.search, handler: () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus() },
  ];

  const allShortcuts = shortcuts || defaultShortcuts;

  return (
    <div className="keyboard-shortcuts-help">
      <h3 className="text-lg font-semibold mb-3">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {allShortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">{shortcut.description}</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
              {shortcut.ctrlKey && "Ctrl + "}
              {shortcut.shiftKey && "Shift + "}
              {shortcut.altKey && "Alt + "}
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}