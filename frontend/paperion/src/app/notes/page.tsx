"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import BurgerMenu from "../components/BurgerMenu";
import "../globals.css";
import "../styles/paper.css";

interface Note {
  note_id: number;
  user_id: number;
  paper_id: string;
  citation: string;
  description: string;
  doi: string;
}

interface GroupedNotes {
  [paperId: string]: Note[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editCitation, setEditCitation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [paperDetails, setPaperDetails] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const confirmDelete = async () => {
    if (confirmDeleteId === null) return;
    await handleDelete(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const fetchNotes = async () => {
    if (!token) {
      setError("You must be logged in to view your notes.");
      setLoading(false);
      return;
    }
    try {
      const papersRes = await fetch(
        `http://backend:8000/user/collections/papers?token=${encodeURIComponent(token)}`,
      );
      if (!papersRes.ok) throw new Error("Failed to fetch collection papers");
      const paperIds: string[] = await papersRes.json();
      console.log("paperIds : ", paperIds);
      const notesRes = await fetch(
        `http://backend:8000/user/notes?token=${encodeURIComponent(token)}`,
      );
      if (!notesRes.ok) throw new Error("Failed to fetch notes");
      const allNotes: Note[] = await notesRes.json();
      console.log("allNotes : ", allNotes);
      setNotes(allNotes.filter((note) => paperIds.includes(note.paper_id)));
      console.log(
        " Filtered papers : ",
        allNotes.filter((note) => paperIds.includes(note.paper_id)),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleDelete = async (noteId: number) => {
    if (!token) return;
    const res = await fetch(
      `http://backend:8000/user/notes/${noteId}?token=${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
    if (res.ok) setNotes((prev) => prev.filter((n) => n.note_id !== noteId));
  };

  const handleEdit = (note: Note) => {
    setEditNote(note);
    setEditCitation(note.citation);
    setEditDescription(note.description);
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editNote) return;

    if (!token) return;
    const res = await fetch(
      `http://backend:8000/user/notes/${editNote.note_id}?token=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: editNote.paper_id,
          citation: editCitation,
          description: editDescription,
        }),
      },
    );
    if (res.ok) {
      setNotes((prev) =>
        prev.map((n) =>
          n.note_id === editNote.note_id
            ? { ...n, citation: editCitation, description: editDescription }
            : n,
        ),
      );
      setEditModalOpen(false);
      setEditNote(null);
    }
  };

  const [tooltipMessage, setTooltipMessage] = useState("Copy APA Reference");

  const handleCopyAPA = async (paperId: string) => {
    try {
      const res = await fetch(
        `http://localhost:8000/apa_citation?paper_id=${encodeURIComponent(paperId)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch citation");
      const data = await res.json();
      await navigator.clipboard.writeText(data.apa_citation);
      setTooltipMessage("Copied!");
      setTimeout(() => setTooltipMessage("Copy APA Reference"), 2000);
    } catch (err) {
      setTooltipMessage("Error");
      setTimeout(() => setTooltipMessage("Copy APA Reference"), 2000);
    }
  };

  const mergedNotes = useMemo(() => {
    const latestNotes = new Map<string, Note>();
    [...notes]
      .sort((a, b) => a.note_id - b.note_id)
      .forEach((note) =>
        latestNotes.set(`${note.paper_id}-${note.citation}`, note),
      );
    return Array.from(latestNotes.values());
  }, [notes]);

  const groupedNotes = useMemo(
    () =>
      mergedNotes.reduce<GroupedNotes>((acc, note) => {
        (acc[note.paper_id] = acc[note.paper_id] || []).push(note);
        return acc;
      }, {}),
    [mergedNotes],
  );
  const paperTitles = Object.keys(groupedNotes);
  const displayedNotes = selectedPaper ? groupedNotes[selectedPaper] : [];
  useEffect(() => {
    if (paperTitles.length === 0) return;
    console.log("fetching", paperTitles);
    Promise.all(
      paperTitles.map((pid) =>
        fetch(`http://backend:8000/getPaperById?id=${encodeURIComponent(pid)}`)
          .then((r) => r.json())
          .then((d) => d?._source || null)
          .catch(() => null),
      ),
    ).then((arr) => {
      const filtered = arr.filter(Boolean);
      setPaperDetails((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(filtered)) return prev;
        return filtered;
      });
    });
  }, [paperTitles]);

  if (loading) return <div className="p-4"></div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="">
      <div className="z-1000 absolute top-4 right-4">
        <BurgerMenu token={token} />
      </div>
      <div className="w-full px-8 py-4">
        <a href="/home" className="text-black font-1001 text-6xl">
          Paperion
        </a>
      </div>
      <div className="mx-auto px-14 p-4 mt-4 gap-4 flex flex-col">
        <div className="flex gap-4 p-4 h-[90vh]">
          <div className="min-w-0 w-2/5 overflow-y-auto scrollbar-hidden -mt-8 p-1">
            {paperTitles.length > 0 ? (
              <div className="bookshelf hover:cursor-pointer grid grid-cols-2 gap-x-1 gap-y-8 justify-items-center">
                {paperDetails.map((p) => {
                  const pid = String(p?.ID || p?.id);
                  return (
                    <div key={pid}>
                      <div
                        key={pid}
                        className={`book group relative hover:cursor-pointer w-full ${
                          selectedPaper === pid ? "" : ""
                        }`}
                        onClick={() => setSelectedPaper(pid)}
                      >
                        <div className="link"></div>
                        <div className="cover">
                          <div className="flex flex-col justify-between h-full w-full text-center">
                            <div className="text-sm text-[#FFEDB8] font-normal">
                              {(p?.Year || "Unknown").toString().split(",")[0]}
                            </div>
                            <div className="p-2 text-[#FFEDB8]">
                              {p?.Title?.length > 80
                                ? p.Title.slice(0, 80) + "..."
                                : p?.Title}
                            </div>
                            <div className="text-lg text-[#FFEDB8] text-opacity-50 font-3001">
                              {(() => {
                                const authors = (p?.Author || "Unknown").split(
                                  ",",
                                );
                                let name = authors[0];
                                if (authors.length > 1) name += " et al.";
                                return name.length > 20
                                  ? name.slice(0, 20) + "..."
                                  : name;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* popup shown on hover */}
                        <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left rounded w-[210px] max-h-[320px] overflow-y-auto">
                          <div className="font-4002 text-[16px] mb-2 font-bold">
                            {p?.Title}
                          </div>
                          <div className="opacity-80 text-[13px] mb-2">
                            {p?.Author}
                          </div>
                          <div className="font-4003 text-[14px]">
                            {p.Abstract || p.paperContent || "Not available."}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAPA(pid);
                        }}
                        className="relative mt-2 text-xs flex flex-row items-end justify-end text-blue-500 block text-center w-full"
                        onMouseMove={(e) => {
                          const tooltip = document.getElementById(
                            `tooltip-${pid}`,
                          );
                          if (tooltip) {
                            tooltip.style.left = e.pageX + 10 + "px";
                            tooltip.style.top = e.pageY + 10 + "px";
                          }
                        }}
                        onMouseEnter={() => {
                          const tooltip = document.getElementById(
                            `tooltip-${pid}`,
                          );
                          if (tooltip) tooltip.style.display = "block";
                        }}
                        onMouseLeave={() => {
                          const tooltip = document.getElementById(
                            `tooltip-${pid}`,
                          );
                          if (tooltip) tooltip.style.display = "none";
                        }}
                      >
                        <img
                          src="/icons/copy.svg"
                          alt="Copy"
                          className="w-8 h-8 mr-3 opacity-40 hover:opacity-100"
                        />
                        <span
                          id={`tooltip-${pid}`}
                          className="absolute hidden cursor-pointer bg-black bg-opacity-50 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none"
                          style={{ position: "fixed", zIndex: 9999 }}
                        >
                          {tooltipMessage}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2 -ml-20 items-center justify-center">
                <img src="/icons/empty.gif" alt="empty_folder" />
                <span className="text-2xl -mt-14 text-gray-400 text-opacity-70 font-5002">
                  No notes found
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pl-14 -mt-10 scrollbar-hidden overflow-y-auto">
            <div className="w-full px-4 ">
              {selectedPaper ? (
                <>
                  {/* <h2 className="text-xl mb-3 text-gray-800 opacity-50">
                    {paperDetails.find(
                      (p) => String(p.ID || p.id) === selectedPaper,
                    )?.Author || selectedPaper}
                  </h2>
                  <h2 className="text-4xl font-4004 mb-10">
                    {paperDetails.find(
                      (p) => String(p.ID || p.id) === selectedPaper,
                    )?.Title || selectedPaper}
                  </h2> */}

                  <div className="space-y-6 ">
                    {displayedNotes.map((note) => {
                      let noteDetails = { page: "N/A", pdf: "N/A", note: "" };
                      try {
                        const desc = JSON.parse(note.description);
                        noteDetails = {
                          page: desc.page || "N/A",
                          pdf: desc.pdf || "N/A",
                          note: desc.note || "",
                        };
                      } catch {}
                      return (
                        <div
                          key={note.note_id}
                          className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl"
                        >
                          <div className="flex mb-2 mt-4 flex-row gap-2">
                            <img
                              src="/icons/quotes2.svg"
                              alt="Quotes"
                              className="h-8 w-8 mr-3 mt-2 opacity-30"
                            />
                            <span className="font-3003 text-black/70 mt-4 leading-[28px] text-[18px]">
                              {note.citation} <br />
                            </span>
                          </div>

                          <div
                            key={note.note_id}
                            className="rounded-4xl px-8 py-4"
                          >
                            <div className="px-6 pt-2 pb-4  rounded-3xl">
                              <div className="text-[14px] text-black space-y-1">
                                {noteDetails.note && (
                                  <p className="font-4001">
                                    {noteDetails.note}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-row items-center mt-5 justify-between">
                                {note.doi && (
                                  <Link
                                    href={`/read?doi=${note.doi.replace("/", "_")}`}
                                    className="text-sm font-5002 rounded-full border-orange-400 text-orange-800/50 flex flex-row gap-2 items-center justify-center bg-orange-100/60  hover:opacity-80 hover:cursor-pointer py-1 px-5"
                                  >
                                    Open in Reader
                                    <img
                                      src="/icons/goto.svg"
                                      alt="GoTo"
                                      className="w-5 h-5 opacity-90 hover:cursor-pointer"
                                    />
                                  </Link>
                                )}

                                <div className="">
                                  <button
                                    onClick={() => handleEdit(note)}
                                    className=""
                                  >
                                    <img
                                      src="/icons/edit.svg"
                                      alt="Edit"
                                      className="w-5 h-5 mb-0.5 mr-3 hover:opacity-40 hover:cursor-pointer"
                                    />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteId(note.note_id)
                                    }
                                    className=""
                                  >
                                    <img
                                      src="/icons/trash.svg"
                                      alt="Trash"
                                      className="w-6 h-6 hover:opacity-40 hover:cursor-pointer"
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 -ml-20 items-center justify-center">
                  <img src="/icons/empty.gif" alt="empty_folder" className="" />
                  <span className="text-2xl -mt-14 text-gray-400 text-opacity-70 font-5002"></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Edit Note</h3>

            <textarea
              value={(() => {
                try {
                  const desc = JSON.parse(editDescription);
                  return desc.note || "";
                } catch {
                  return editDescription;
                }
              })()}
              onChange={(e) => {
                try {
                  const desc = JSON.parse(editDescription || "{}");
                  desc.note = e.target.value;
                  setEditDescription(JSON.stringify(desc));
                } catch {
                  setEditDescription(e.target.value);
                }
              }}
              className="mb-6 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h3 className="text-lg font-semibold mb-4">Delete Note</h3>
            <p className="mb-6">
              Are you sure you want to delete this note? This action cannot be
              undone.
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
    </div>
  );
}
