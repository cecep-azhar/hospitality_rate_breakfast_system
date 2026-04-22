"use client";

import { useEffect, useMemo, useState } from "react";

interface AdminNavItem {
  id: string;
  label: string;
}

interface AdminSidebarNavProps {
  items: AdminNavItem[];
  defaultActiveId?: string;
}

export function AdminSidebarNav({ items, defaultActiveId = "overview" }: AdminSidebarNavProps) {
  const validIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const [activeId, setActiveId] = useState(defaultActiveId);

  useEffect(() => {
    const syncFromHash = () => {
      const hashId = window.location.hash.replace(/^#/, "");

      if (hashId && validIds.has(hashId)) {
        setActiveId(hashId);
        return;
      }

      setActiveId(defaultActiveId);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [defaultActiveId, validIds]);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null);

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visibleEntries.length) {
          return;
        }

        const nextId = visibleEntries[0]?.target.id;
        if (nextId && validIds.has(nextId)) {
          setActiveId(nextId);
        }
      },
      {
        root: null,
        rootMargin: "-100px 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
    };
  }, [items, validIds]);

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {items.map((item) => (
        <a
          key={item.id}
          className={`admin-nav-link${activeId === item.id ? " active" : ""}`}
          href={`#${item.id}`}
          onClick={() => setActiveId(item.id)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
