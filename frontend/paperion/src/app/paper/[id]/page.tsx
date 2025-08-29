"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { useRouter } from "next/navigation";
import "../../globals.css";
import "../../styles/minimalPaper.css";
import BurgerMenu from "../../components/BurgerMenu";

type Collection = {
  collection_id: number;
  user_id: number;
  title: string;
  description: string;
  papers_id: string | null;
};

export default function PaperPage() {
  const { id } = useParams();
  const [paper, setPaper] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [sameAuthor, setSameAuthor] = useState<any[]>([]);
  const [sameJournal, setSameJournal] = useState<any[]>([]);
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<
    "similar" | "author" | "journal"
  >("similar");

  // Add-to-collection UI state
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreateCollection = async () => {
    if (!token) return;
    await fetch(
      `http://backend:8000/user/collections?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          papers_id: [],
        }),
      },
    );
    setShowCreateForm(false);
    setNewTitle("");
    setNewDescription("");
    openCollections(); // refresh list
  };

  useEffect(() => {
    if (!id) return;
    fetch(
      `http://backend:8000/getPaperById?id=${encodeURIComponent(id as string)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setPaper(data._source);
        const doi = data._source?.DOI;
        if (doi) {
          fetch(
            `http://backend:8000/download_paper?doi=${encodeURIComponent(doi)}`,
          )
            .then((res) => res.json())
            .then((d) => setPdfUrl(d.pdf_url))
            .catch(() => setPdfUrl(null));
        }
      });
  }, [id]);

  // fetch after paper loads
  useEffect(() => {
    if (!paper?.DOI) return;
    const doi = encodeURIComponent(paper.DOI);
    fetch(`http://backend:8000/getRecommendation_similarPaper?doi=${doi}`)
      .then((r) => r.json())
      .then((d) => {
        console.log("similar response:", d); // <--- check this
        if (Array.isArray(d)) {
          setSimilar(d);
        } else if (Array.isArray(d?.results)) {
          setSimilar(d.results);
        } else {
          setSimilar([]);
        }
      })
      .catch(() => setSimilar([]));
    fetch(`http://backend:8000/getRecommendation_sameAuthor?doi=${doi}`)
      .then((r) => r.json())
      .then((d) => setSameAuthor(d.map((x: any) => x._source)))
      .catch(() => setSameAuthor([]));
    fetch(`http://backend:8000/getRecommendation_sameJournal?doi=${doi}`)
      .then((r) => r.json())
      .then((d) => setSameJournal(d.map((x: any) => x._source)))
      .catch(() => setSameJournal([]));
  }, [paper?.DOI]);

  const openCollections = async () => {
    if (!token) return alert("Please log in");
    try {
      const res = await fetch(
        `http://backend:8000/user/collections?token=${encodeURIComponent(token)}`,
      );
      const data = await res.json();
      const normalized: Collection[] = Array.isArray(data)
        ? data.map((row: any) =>
            Array.isArray(row)
              ? ({
                  collection_id: row[0],
                  user_id: row[1],
                  title: row[2],
                  description: row[3],
                  papers_id: row[4],
                } as Collection)
              : (row as Collection),
          )
        : [];

      const currentId = String(id);
      const preselected = new Set<number>();
      for (const c of normalized) {
        try {
          const arr = c.papers_id ? JSON.parse(c.papers_id) : [];
          if (Array.isArray(arr) && arr.map(String).includes(currentId)) {
            preselected.add(c.collection_id);
          }
        } catch {
          /* ignore malformed JSON */
        }
      }

      setCollections(normalized);
      setSelected(preselected);
      setShowCollections(true);
    } catch {
      setCollections([]);
      setSelected(new Set());
      setShowCollections(true);
    }
  };

  const toggleSelection = (cid: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cid) ? next.delete(cid) : next.add(cid);
      return next;
    });
  };

  const addToSelectedCollections = async () => {
    if (!token || !id) return;
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const paper_id = String(id);
      await Promise.all(
        Array.from(selected).map((cid) =>
          fetch(
            `http://backend:8000/user/collections/${cid}/add_paper?paper_id=${encodeURIComponent(
              paper_id,
            )}&token=${encodeURIComponent(token)}`,
            { method: "PUT" },
          ),
        ),
      );
      setShowCollections(false);
    } finally {
      setSubmitting(false);
    }
  };
  if (!paper) return <div></div>;

  return (
    <div>
      <div className="z-1000 absolute top-4 right-4">
        <BurgerMenu token={token} />
      </div>
      <div className="w-full px-8 py-4">
        <a
          href="/home"
          className="text-black hover:cursor-pointer font-1001 text-6xl"
        >
          Paperion
        </a>
      </div>
      <div className="flex px-8 gap-14 ">
        <div className="w-2/3 min-w-0 max-h-[100vh] scrollbar-hidden overflow-y-auto pr-4 text-right">
          <div className="flex flex-row justify-end gap-4 py-4 pb-10">
            {paper?.DOI && (
              <button
                onClick={openCollections}
                className="px-4 whitespace-nowrap cursor-pointer font-4005 text-sm py-2 font-bold hover:opacity-80 rounded-full text-white bg-black"
              >
                Add to Collection
              </button>
            )}

            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 whitespace-nowrap cursor-pointer font-4005 text-sm py-2 font-bold hover: rounded-full text-white bg-black inline-block"
              >
                Download
              </a>
            )}
          </div>

          <p className="text-gray-700 font-4003 mb-2">
            {paper.DOI || "Unknown"}
          </p>

          <h1 className="text-4xl font-4004 mb-4">
            {(paper.Title || "Untitled").replace(/[^a-zA-Z0-9\s\-.:\"']/g, "")}
          </h1>
          <p className="text-gray-700 mb-2">{paper.Author || "Unknown"}</p>

          <p className="text-gray-700 mb-2">{paper.Year || "Unknown"}</p>

          <div className="flex flex-row justify-end gap-4 py-4 pb-2">
            <button
              onClick={() => setSelectedTab("similar")}
              className={`px-4 py-2 cursor-pointer font-4005 tracking-wide rounded-md ${
                selectedTab === "similar"
                  ? "bg-gray-200 opacity-70 text-gray-700"
                  : "bg-white border border-gray-400 border-opacity-80 text-gray-500"
              }`}
            >
              Similar Papers
            </button>

            <button
              onClick={() => setSelectedTab("author")}
              className={`px-4 py-2 cursor-pointer font-4005 tracking-wide rounded-md ${
                selectedTab === "author"
                  ? "bg-gray-200 opacity-70 text-gray-700"
                  : "bg-white border border-gray-400 border-opacity-80 text-gray-500"
              }`}
            >
              More by author
            </button>
            <button
              onClick={() => setSelectedTab("journal")}
              className={`px-4 py-2 cursor-pointer font-4005 tracking-wide rounded-md ${
                selectedTab === "journal"
                  ? "bg-gray-200 opacity-70 text-gray-700"
                  : "bg-white border border-gray-400 border-opacity-80 text-gray-500"
              }`}
            >
              More by Journal
            </button>
          </div>
          {/* Recommendations */}
          <div className="mt-10">
            {selectedTab === "similar" && (
              <section>
                <div className="bookshelf cursor-pointer grid grid-cols-3 gap-x-1 gap-y-4 justify-items-center">
                  {similar.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="book group relative hover:cursor-pointer"
                      onClick={() =>
                        p.ID
                          ? router.push(`/paper/${p.ID}`)
                          : p.DOI &&
                            window.open(
                              `https://doi.org/${encodeURIComponent(p.DOI)}`,
                              "_blank",
                            )
                      }
                    >
                      <div className="link"></div>
                      <div className="cover">
                        <div className="flex flex-col justify-between h-full w-full text-center">
                          <div className="text-[14px] text-[#FFEDB8] font-normal">
                            {p.Year?.toString().split(",")[0] || "Unknown"}
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
                      <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left cursor-pointer rounded w-[100px] overflow-y-auto max-h-[260px]">
                        <div className="font-4002 text-[16px] mb-2 font-bold">
                          {p.Title || "Untitled"}
                        </div>
                        <div className="opacity-80 text-[13px] mb-2">
                          {p.Author || "Unknown"}
                        </div>
                        <div className="font-4003 text-[14px]">
                          {p.paperContent || "Not available."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedTab === "author" && (
              <section>
                <div className="bookshelf grid grid-cols-3 gap-x-1 gap-y-4 justify-items-center">
                  {sameAuthor.map((p: any) => (
                    <div
                      key={p.ID}
                      className="book group relative hover:cursor-pointer"
                      onClick={() => router.push(`/paper/${p.ID}`)}
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
                      <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left cursor-pointer rounded w-[160px] overflow-y-auto max-h-[260px]">
                        <div className="font-4002 text-[16px] mb-2 font-bold">
                          {p.Title || "Untitled"}
                        </div>
                        <div className="opacity-80 text-[13px] mb-2">
                          {p.Author || "Unknown"}
                        </div>
                        <div className="font-4003 text-[14px]">
                          {p.Abstract || "Not available."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedTab === "journal" && (
              <section>
                <div className="bookshelf grid grid-cols-3 gap-x-1 gap-y-4 justify-items-center">
                  {sameJournal.map((p: any) => (
                    <div
                      key={p.ID}
                      className="book group relative hover:cursor-pointer"
                      onClick={() => router.push(`/paper/${p.ID}`)}
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
                            {p.Journal || "Unknown"}
                          </div>
                        </div>
                      </div>
                      <div className="popup absolute top-0 left-0 transform z-[999] hidden group-hover:block bg-white text-black p-2 text-sm shadow-xl text-left cursor-pointer rounded w-[100px] overflow-y-auto max-h-[260px]">
                        <div className="font-4002 text-[16px] mb-2 font-bold">
                          {p.Title || "Untitled"}
                        </div>
                        <div className="opacity-80 text-[13px] mb-2">
                          {p.Journal || "Unknown"}
                        </div>
                        <div className="font-4003 text-[14px]">
                          {p.Abstract || "Not available."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Modal */}
          {showCollections && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-left">
                <div className="flex items-center justify-between "></div>
                <div className="flex items-center mt-2 justify-center flex-row ">
                  {" "}
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 w-full max-w-md  py-4 flex justify-center items-center flex-row gap-4 hover:cursor-pointer bg-gray-200/80 hover:bg-gray-300/70 text-md tracking-wider font-4005 rounded-xl "
                  >
                    <img
                      src="/icons/plus.svg"
                      alt="Delete"
                      className="w-6 h-6 opacity-25 hover:cursor-pointer"
                    />
                    New Collection
                  </button>
                </div>

                <div className="max-h-68 rounded p-2 mt-6 mb-6">
                  {collections.length === 0 && (
                    <div className="flex flex-row items-center  justify-center">
                      <img
                        src="/icons/none.jpg"
                        alt="empty_folder"
                        className="w-48 h-48"
                      />
                    </div>
                  )}
                  <div className="overflow-y-auto">
                    {collections.map((c) => (
                      <label
                        key={c.collection_id}
                        className="flex items-start gap-4 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(c.collection_id)}
                          onChange={() => toggleSelection(c.collection_id)}
                          className="mt-1"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-5002 mb-1">
                            {c.title}
                          </span>
                          <span className="text-xs mb-2 font-4003 text-gray-500">
                            {c.description}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex text-sm font-4005 tracking-wider justify-end gap-2">
                    {" "}
                    <button
                      onClick={() => {
                        setSelected(new Set());
                        setShowCollections(false);
                      }}
                      className="px-4 py-2 hover:cursor-pointer border rounded-full "
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addToSelectedCollections}
                      disabled={
                        submitting ||
                        selected.size === 0 ||
                        collections.length === 0
                      }
                      className="px-4 py-2 flex flex-row gap-2 rounded-full text-white bg-black 
                                hover:cursor-pointer items-center disabled:cursor-not-allowed"
                    >
                      <img
                        src="/icons/stack.png"
                        alt="Delete"
                        className="w-6 h-6 opacity-50 hover:cursor-pointer"
                      />

                      {submitting ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCreateForm && (
            <div
              className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
              onClick={() => setShowCreateForm(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-md rounded-lg bg-white p-10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-start justify-start">
                  <h3 className="text-lg font-semibold mb-2">
                    Create Collection
                  </h3>
                  <h3 className="text-md font-4002 text-left tracking-wide mb-8 text-gray-400">
                    Your collection will group your papers into one folder. Give
                    it a name that describes the selection.
                  </h3>
                </div>

                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-md mb-3 w-full border p-2 px-4 border-gray-300 font-4005 tracking-wide rounded-md"
                  placeholder="Title"
                />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="text-md mb-8 w-full border p-2 px-4 border-gray-300 font-4005 tracking-wide rounded-md"
                  placeholder="Description"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-full font-4005 border hover:cursor-pointer border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCollection}
                    className="rounded-full flex flex-row gap-2 hover:cursor-pointer items-center justify-center font-4005 bg-gray-900 px-5 py-2 text-sm text-white hover:bg-black"
                  >
                    <img
                      src="/icons/folder-create.png"
                      alt="Create"
                      className="w-6 h-6 opacity-50 hover:cursor-pointer"
                    />
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-3/6 h-[100vh] shrink-0">
          {pdfUrl ? (
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <Viewer
                fileUrl={`/api/proxy-pdf?url=${encodeURIComponent((pdfUrl || "").replace(/#.*$/, ""))}`}
              />
            </Worker>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Image
                src="/icons/loading.gif"
                alt="Loading"
                width={100}
                height={100}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
