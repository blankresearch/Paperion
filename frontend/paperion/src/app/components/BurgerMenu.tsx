"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token?: string | null;
  className?: string;
};

export default function BurgerMenu({ token, className }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    try {
      if (token) {
        await fetch(
          `http://backend:8000/logout?token=${encodeURIComponent(token)}`,
          { method: "POST" },
        );
      }
    } catch {}
    localStorage.removeItem("token");
    router.push("/");
  }

  return (
    <div ref={menuRef} className={`absolute top-4 right-4 ${className || ""}`}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex flex-col space-y-1.5 p-2 rounded hover:cursor-pointer"
      >
        <span className="block w-6 h-0.5 bg-black" />
        <span className="block w-6 h-0.5 bg-black" />
        <span className="block w-6 h-0.5 bg-black" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="font-5001 tracking-wider text-[13px] mt-1 w-42 bg-white shadow-lg rounded-2xl py-3 px-3 absolute right-0"
        >
          <a
            href="/collection"
            className="rounded-lg flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
            role="menuitem"
          >
            <img
              src="/icons/collections.svg"
              alt="Search"
              className="w-5 h-5"
            />
            Collections
          </a>
          <a
            href="/notes"
            className="rounded-lg flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
            role="menuitem"
          >
            <img src="/icons/notes.svg" alt="Search" className="w-5 h-5" />
            Notes
          </a>
          <a
            href="/profile"
            className="rounded-lg flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
            role="menuitem"
          >
            <img src="/icons/profile.svg" alt="Search" className="w-5 h-5" />
            Profile
          </a>
          <button
            onClick={handleLogout}
            role="menuitem"
            className="rounded-lg mt-2 border-t border-gray-300 hover:cursor-pointer flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
          >
            <img src="/icons/logout.svg" alt="Search" className="w-5 h-5" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
