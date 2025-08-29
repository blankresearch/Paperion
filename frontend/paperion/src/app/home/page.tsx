"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import "../globals.css";
import "../styles/paper.css";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [searchAbstract, setSearchAbstract] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      setIsAuthenticated(true);
    } else {
      router.replace("/auth");
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setLoadingRecs(true);
    fetch(
      `http://backend:8000/recommendations/from_collections?token=${encodeURIComponent(token)}`,
    )
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? d : []))
      .then(setRecs)
      .catch(() => setRecs([]))
      .finally(() => setLoadingRecs(false));
  }, [token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim()) {
        const endpoint = searchAbstract
          ? `http://backend:8000/SearchbyContent?query=${encodeURIComponent(query)}`
          : `http://backend:8000/getPaper?title=${encodeURIComponent(query)}`;
        fetch(endpoint)
          .then((res) => res.json())
          .then((data) => setResults(Array.isArray(data) ? data : []))
          .catch(() => setResults([]));
      } else {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [query, searchAbstract]);

  if (!isAuthenticated) return null;

  return (
    <div className="">
      <div className="max-w-7xl mx-auto px-14 p-4 mt-4 gap-4 flex flex-col items-center">
        <div ref={menuRef} className="absolute top-4 right-4">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col space-y-1.5 p-2 rounded hover:cursor-pointer "
          >
            <span className="block w-6 h-0.5 bg-black"></span>
            <span className="block w-6 h-0.5 bg-black"></span>
            <span className="block w-6 h-0.5 bg-black"></span>
          </button>
          {menuOpen && (
            <div className="font-5001 tracking-wider text-[13px] mt-1 w-42 bg-white shadow-lg rounded-2xl py-3 px-3 absolute right-0">
              <a
                href="/collection"
                className="rounded-lg flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
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
              >
                <img src="/icons/notes.svg" alt="Search" className="w-5 h-5" />
                Notes
              </a>
              <a
                href="/profile"
                className="rounded-lg flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
              >
                <img
                  src="/icons/profile.svg"
                  alt="Search"
                  className="w-5 h-5"
                />
                Profile
              </a>

              <a
                onClick={async () => {
                  if (token) {
                    await fetch(
                      `http://backend:8000/logout?token=${encodeURIComponent(token)}`,
                      { method: "POST" },
                    );
                  }
                  localStorage.removeItem("token");
                  router.push("/");
                }}
                className="rounded-lg mt-2 border-t border-gray-300 hover:cursor-pointer flex flex-row gap-4 items-center justify-start block px-4 py-2 hover:bg-gray-100"
              >
                <img src="/icons/logout.svg" alt="Search" className="w-5 h-5" />
                Logout
              </a>
            </div>
          )}
        </div>

        <div className="justify-center flex flex-row mb-4">
          <a
            href="/home"
            className="text-black hover:cursor-pointer font-1001 text-8xl"
          >
            Paperion
          </a>
        </div>

        <div
          className={`w-3/5 max-w-xl ${searchAbstract ? "p-2" : "p-2"} flex items-center gap-2 border border-gray-300 ${searchAbstract ? "rounded-3xl" : "rounded-full"}`}
        >
          <img
            src="/icons/search.svg"
            alt="Search"
            className="w-7 h-7 ml-3 self-start mt-1"
          />
          {searchAbstract ? (
            <textarea
              id="search-bar"
              className="w-full h-28 resize-none bg-transparent focus:outline-none pt-1.5"
              placeholder="Search in papers content..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : (
            <input
              type="text"
              id="search-bar"
              className="w-full focus:outline-none bg-transparent"
              placeholder="Ex; Business Cycle -- Schumpeter -- 1927"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <button
            onClick={() => setSearchAbstract(!searchAbstract)}
            className={`px-4 whitespace-nowrap text-sm py-2 font-bold hover:cursor-pointer hover:opacity-80 py-1 self-start rounded-full ${
              searchAbstract
                ? "bg-gray-800 text-gray-100 border-opacity-50 border border-gray-500 hover:opacity-80"
                : "text-gray-400 bg-gray-100 hover:bg-gray-200 hover:text-gray-500"
            }`}
          >
            Deep Search
          </button>
        </div>

        {!query.trim() && (
          <div className="mt-6 w-full px-4">
            {loadingRecs ? (
              <div className="flex items-center justify-center h-full">
                <Image
                  src="/icons/loading.gif"
                  alt="Loading"
                  width={100}
                  height={100}
                />
              </div>
            ) : recs.length === 0 ? (
              <p>No recommendations yet.</p>
            ) : (
              <div className="bookshelf grid grid-cols-5 gap-x-8 gap-y-8 justify-items-center">
                {recs.map((p: any) => (
                  <div
                    key={p.ID}
                    className="book group relative hover:cursor-pointer"
                    onClick={() =>
                      router.push(`/paper/${encodeURIComponent(p.ID)}`)
                    }
                  >
                    <div className="link"></div>
                    <div className="cover">
                      <div className="flex flex-col justify-between h-full w-full text-center">
                        <div className="text-[14px] text-[#FFEDB8] font-normal">
                          {(p.Year || "Unknown").toString().split(",")[0]}
                        </div>
                        <div className="p-2 text-[#FFEDB8]">
                          {(() => {
                            const title = (p.Title || "Untitled").trim();
                            return title.length > 100
                              ? title.slice(0, 100) + "..."
                              : title;
                          })()}
                        </div>
                        <div className="text-[18px] text-[#FFEDB8] text-opacity-50 font-3001">
                          {(() => {
                            const authors = (p.Author || "Unknown")
                              .split(",")
                              .map((a: string) => a.trim());
                            let name = authors[0] || "Unknown";
                            if (authors.length > 1) name += " et al.";
                            return name.length > 20
                              ? name.slice(0, 20) + "..."
                              : name;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left cursor-pointer rounded w-[210px] overflow-y-auto max-h-[320px]">
                      <div className="font-4002 text-[16px] mb-2 font-bold">
                        {p.Title || "Untitled"}
                      </div>
                      <div className="opacity-80 text-[13px] mb-2">
                        {p.Author || "Unknown"}
                      </div>
                      <div className="font-4003 text-[14px]">
                        {p.Abstract || p.paperContent || "Not available."}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 w-full px-4">
          <div className="bookshelf grid grid-cols-5 gap-x-8 gap-8 gap-y-8 justify-items-center">
            {results.map((paper: any) => (
              <div
                key={paper._source?.ID}
                className="book group relative hover:cursor-pointer"
                onClick={() => router.push(`/paper/${paper._source?.ID}`)}
              >
                <div className="link"></div>
                <div className="cover">
                  <div className="flex flex-col justify-between h-full w-full text-center">
                    <div className="text-[14px] text-[#FFEDB8] font-normal">
                      {paper._source?.Year?.split(",")[0] || "Unknown"}
                    </div>
                    <div className="p-2 text-[#FFEDB8]">
                      {(() => {
                        const title =
                          paper._source?.Title?.trim() || "Untitled";
                        return title.length > 100
                          ? title.slice(0, 100) + "..."
                          : title;
                      })()}
                    </div>
                    <div className="text-[18px] text-[#FFEDB8] text-opacity-50 font-3001">
                      {(() => {
                        const authors = paper._source?.Author?.split(",").map(
                          (a: string) => a.trim(),
                        ) || ["Unknown"];
                        let name = authors[0];
                        if (authors.length > 1) name += " et al.";
                        return name.length > 20
                          ? name.slice(0, 20) + "..."
                          : name;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left cursor-pointer rounded w-[210px] overflow-y-auto max-h-[320px]">
                  <div className="font-4002 text-[16px] mb-2 font-bold">
                    {paper._source?.Title || "Untitled"}
                  </div>
                  <div className="opacity-80 text-[13px] mb-2">
                    {paper._source?.Author || "Unknown"}
                  </div>
                  <div className="font-4003 text-[14px]">
                    {paper._source?.paperContent || "Not available."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
