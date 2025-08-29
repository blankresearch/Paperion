"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import "../globals.css";
import "../styles/paper.css";

type RawRow = [number, number, string, string, string | null];

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<RawRow[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(
    null,
  );
  const [activeCollectionTitle, setActiveCollectionTitle] =
    useState<string>("");
  const [activePapers, setActivePapers] = useState<string[]>([]);
  const [activePaperDetails, setActivePaperDetails] = useState<any[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const fetchCollections = useCallback(() => {
    if (!token) return;
    fetch(
      `http://backend:8000/user/collections?token=${encodeURIComponent(token)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch collections");
        return res.json();
      })
      .then((rows: RawRow[]) => {
        setCollections(rows);
        if (rows.length > 0 && activeCollectionId === null) {
          hydrateRightPanel(rows[0]);
        }

        if (activeCollectionId !== null) {
          const found = rows.find((r) => r[0] === activeCollectionId);
          if (found) hydrateRightPanel(found);
          else {
            setActiveCollectionId(null);
            setActiveCollectionTitle("");
            setActivePapers([]);
            setActivePaperDetails([]);
          }
        }
      })
      .catch((err) => setError(err.message));
  }, [token, activeCollectionId]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      router.push("/auth");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    fetchCollections();
  }, [token, fetchCollections]);

  const hydrateRightPanel = (row: RawRow) => {
    const [collection_id, , title, , papersRaw] = row;
    let ids: string[] = [];
    try {
      const parsed = papersRaw ? JSON.parse(papersRaw) : [];
      ids = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      ids = [];
    }
    setActiveCollectionId(collection_id);
    setActiveCollectionTitle(title);
    setActivePapers(ids);
  };

  useEffect(() => {
    if (activePapers.length === 0) {
      setActivePaperDetails([]);
      return;
    }
    setLoadingPapers(true);
    Promise.all(
      activePapers.map((pid) =>
        fetch(`http://backend:8000/getPaperById?id=${encodeURIComponent(pid)}`)
          .then((r) => r.json())
          .then((d) => d?._source || null)
          .catch(() => null),
      ),
    )
      .then((arr) => setActivePaperDetails(arr.filter(Boolean)))
      .finally(() => setLoadingPapers(false));
  }, [activePapers]);

  const handleCreate = async () => {
    if (!token) return;
    await fetch(
      `http://backend:8000/user/collections?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, papers_id: [] }),
      },
    );
    setShowForm(false);
    setTitle("");
    setDescription("");
    fetchCollections();
  };

  const confirmDelete = async () => {
    if (!token || confirmDeleteId === null) return;
    await fetch(
      `http://backend:8000/user/collections/${confirmDeleteId}?token=${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
    if (activeCollectionId === confirmDeleteId) {
      setActiveCollectionId(null);
      setActiveCollectionTitle("");
      setActivePapers([]);
      setActivePaperDetails([]);
    }
    setConfirmDeleteId(null);
    fetchCollections();
  };

  useEffect(() => {
    if (confirmDeleteId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDeleteId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteId]);

  const handleUpdate = async () => {
    if (!token || editId === null) return;
    await fetch(
      `http://backend:8000/user/collections/${editId}?token=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          papers_id: [],
        }),
      },
    );
    setEditId(null);
    setEditTitle("");
    setEditDescription("");
    fetchCollections();
  };

  const removeFromCollection = async (paperId: string) => {
    if (!token || activeCollectionId === null) return;
    await fetch(
      `http://backend:8000/user/collections/${activeCollectionId}/remove_paper?paper_id=${encodeURIComponent(
        paperId,
      )}&token=${encodeURIComponent(token)}`,
      { method: "PUT" },
    );
    setActivePapers((prev) =>
      prev.filter((p) => String(p) !== String(paperId)),
    );
    setActivePaperDetails((prev) =>
      prev.filter((p) => String(p?.ID || p?.id) !== String(paperId)),
    );
    fetchCollections();
  };

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowForm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  useEffect(() => {
    if (editId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId]);

  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
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
          <div className="font-4002 tracking-wider text-md mt-1 w-40 bg-white shadow-lg z-1000 rounded-2xl py-3 px-2 absolute right-0">
            <a
              href="/collection"
              className="rounded-lg block px-4 py-2 hover:bg-gray-100"
            >
              Collections
            </a>
            <a
              href="/notes"
              className="rounded-lg block px-4 py-2 hover:bg-gray-100"
            >
              Notes
            </a>
            <a
              href="/profile"
              className="rounded-lg block px-4 py-2 hover:bg-gray-100"
            >
              Profile
            </a>

            <a
              href="/logout"
              className="block rounded-lg px-4 py-2 bg-red-50 hover:bg-red-100"
            >
              Logout
            </a>
          </div>
        )}
      </div>
      <div className="w-full hover:cursor-pointer px-8 py-4">
        <a href="/home" className="text-black  font-1001 text-6xl">
          Paperion
        </a>
      </div>
      <div className="mx-auto px-14 p-4 mt-4 gap-4 flex flex-col">
        <div className="flex gap-8 p-4">
          <div className="min-w-0 w-1/3">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200 hover:text-gray-900 ml-4 mb-2  tracking-wide font-5001 hover:cursor-pointer"
            >
              <img
                src="/icons/plus.svg"
                alt="Delete"
                className="w-6 h-6 mr-3 opacity-40 hover:opacity-100"
              />
              <span className="text-slate-800 text-[14px] ">
                New Collection
              </span>
            </button>

            {confirmDeleteId !== null && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={() => setConfirmDeleteId(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-4">
                    Delete Collection
                  </h3>
                  <p className="mb-6">
                    Are you sure you want to delete this collection?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {collections.length === 0 ? (
              <div className="flex flex-col gap-2 mt-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex flex-row rounded-2xl justify-between px-3 pr-5 py-2 ${
                      i === 0
                        ? "bg-gray-100"
                        : i === 1
                          ? "bg-gray-200"
                          : i === 2
                            ? "bg-gray-300"
                            : i === 3
                              ? "bg-gray-400"
                              : "bg-gray-500"
                    }`}
                  >
                    <div className="flex px-3 py-2 w-2/3 flex-col gap-1"></div>
                    <div className="mt-2 flex gap-3"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-4">
                {collections.map((c) => (
                  <div
                    key={c[0]}
                    className={`flex flex-row hover:bg-gray-50 rounded-2xl justify-between hover:cursor-pointer px-3 pr-5 py-2
                      ${
                        activeCollectionId === c[0]
                          ? "bg-gray-100 rounded-2xl"
                          : "bg-white"
                      }
                    `}
                    onClick={() => hydrateRightPanel(c)}
                  >
                    <div className="flex px-3 py-2 w-2/3 flex-col gap-1">
                      <span className="font-5002">{c[2]}</span>
                      <span className="text-gray-500 tracking-wide text-sm font-5003">
                        {c[3]}
                      </span>
                    </div>

                    <div className="mt-2 flex gap-3 ">
                      <button onClick={() => setConfirmDeleteId(c[0])}>
                        <img
                          src="/icons/trash.svg"
                          alt="Delete"
                          className="w-6 h-6 mt-0.5 opacity-40 hover:opacity-100 hover:cursor-pointer"
                        />
                      </button>
                      <button
                        onClick={() => {
                          setEditId(c[0]);
                          setEditTitle(c[2]);
                          setEditDescription(c[3]);
                        }}
                      >
                        <img
                          src="/icons/edit.svg"
                          alt="Edit"
                          className="w-5 h-5 opacity-40 hover:opacity-100 hover:cursor-pointer"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pl-14 ">
            {loadingPapers ? (
              <p>Loading papers…</p>
            ) : activePaperDetails.length === 0 ? (
              <div className="flex flex-col gap-2 -ml-10 items-center justify-center">
                <img
                  src="/icons/empty.gif"
                  alt="empty_folder"
                  className="h-2/3 w-2/3"
                />
                <span className="text-2xl -mt-14 text-gray-400 text-opacity-70 font-5002"></span>
              </div>
            ) : (
              <div className="bookshelf grid grid-cols-3 gap-x-4 gap-y-8 justify-items-center">
                {activePaperDetails.map((p: any) => {
                  const pid = String(p?.ID || p?.id);
                  return (
                    <div
                      key={pid}
                      className="flex flex-col items-center w-full"
                    >
                      <div
                        className="book group relative hover:cursor-pointer w-full"
                        onClick={() =>
                          router.push(`/paper/${encodeURIComponent(pid)}`)
                        }
                      >
                        <div className="link"></div>
                        <div className="cover">
                          <div className="flex flex-col justify-between h-full w-full text-center">
                            <div className="text-sm text-[#FFEDB8] font-normal">
                              {(p?.Year || "Unknown").toString().split(",")[0]}
                            </div>
                            <div className="p-2 text-[#FFEDB8]">
                              {(() => {
                                const t = (p?.Title || "Untitled").trim();
                                return t.length > 100
                                  ? t.slice(0, 100) + "..."
                                  : t;
                              })()}
                            </div>
                            <div className="text-lg text-[#FFEDB8] text-opacity-50 font-3001">
                              {(() => {
                                const authors = (p?.Author || "Unknown")
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
                      <div className="flex flex-row w-full px-5 pt-2 justify-between items-center mt-2">
                        <div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCollection(pid);
                            }}
                            className=" px-2 py-2 border bg-red-50 rounded-full hover:cursor-pointer hover:bg-red-100 border-red-100  hover:cursor-poinster"
                            aria-label="Remove from collection"
                            title="Remove from collection"
                          >
                            <img
                              src="/icons/x.svg"
                              alt="Delete"
                              className="w-2.5 h-2.5 opacity-50 "
                            />
                          </button>
                        </div>
                        <div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const doi = (p?.DOI || "").replace(/\//g, "_"); // match your saved filename format
                              router.push(
                                `/read?doi=${encodeURIComponent(doi)}`,
                              );
                            }}
                            className="text-sm font-5002 rounded-full border-orange-400 text-orange-800/50 flex flex-row gap-2 items-center justify-center bg-orange-100/50 border-black/30 hover:opacity-80 hover:cursor-pointer py-1 px-5"
                          >
                            Open in Reader
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowForm(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-10 py-10 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Create Collection</h3>
            <h3 className="text-md font-4002 tracking-wide mb-8 text-gray-400">
              Your collection will group your papers into one folder. Give it a
              name that describes the selection.
            </h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-md mb-3 w-full border-1 p-2 px-4 border-gray-300 font-4005 tracking-wide rounded-md"
              placeholder="Title"
            />

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-md mb-8 w-full border-1 p-2 px-4 border-gray-300 font-4005 tracking-wide rounded-md"
              placeholder="Description"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-full font-4005 border hover:cursor-pointer border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="rounded-full flex flex-row gap-2 hover:cursor-pointer items-center justify-center font-4005 bg-gray-900 px-5 py-2 text-sm text-white hover:bg-black"
              >
                <img
                  src="/icons/folder-create.png"
                  alt="Delete"
                  className="w-6 h-6 opacity-50 hover:cursor-pointer"
                />
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Update Collection</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mb-3 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="Title"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mb-6 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="Description"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditId(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
