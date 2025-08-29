"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BurgerMenu from "../components/BurgerMenu";
import "../styles/button.css";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function ReadPage() {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const file = useMemo(() => {
    const doi = searchParams.get("doi") || "";
    const fileParam = searchParams.get("file") || "";
    return fileParam || (doi ? `${doi}.pdf` : "");
  }, [searchParams]);
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function handleSummarizeWithAI() {
    setLoading(true);

    const token = localStorage.getItem("token") || "";
    if (!token) return alert("Missing token");
    if (!file) return alert("Missing PDF file");

    const res = await fetch(
      `http://backend:8000/user/analyze_paper?pdf=${encodeURIComponent(file)}&token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );

    if (!res.ok) {
      alert("Error: " + (await res.text()));
      return;
    }

    const data = await res.json();
    setSummary(data);
    setLoading(false);
    if (data?.quotes?.length) {
      for (const q of data.quotes) {
        await fetch(
          `http://backend:8000/user/highlight?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page: 1,
              sentence: q.quote,
              pdf: file,
              note: `AI=${q.why_important}`,
            }),
          },
        );
      }
      //rerenderAll();
    }
  }

  useEffect(() => {
    if (!file) return;

    const circle = document.createElement("div");
    circle.className = "highlight-cursor";
    document.body.appendChild(circle);

    document.addEventListener("mousemove", (e) => {
      circle.style.left = e.clientX + "px";
      circle.style.top = e.clientY + "px";
    });

    let mouseUpHandler: ((this: Document, ev: MouseEvent) => any) | null = null;
    let clickHandler: ((this: HTMLElement, ev: MouseEvent) => any) | null =
      null;

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.min.js";
    script.async = true;

    script.onload = async () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js";

      const token = localStorage.getItem("token") || "";
      const persisted: Record<
        number,
        Record<string, { sentence: string; note?: string }>
      > = {};

      if (token) {
        try {
          const res = await fetch(
            `http://backend:8000/user/highlight?token=${encodeURIComponent(
              token,
            )}&pdf=${encodeURIComponent(file)}`,
          );
          if (res.ok) {
            const arr: { page: number; sentence: string; note?: string }[] =
              await res.json();
            console.log("Fetched notes:", arr);

            for (const h of arr) {
              if (!persisted[h.page]) persisted[h.page] = {};
              persisted[h.page][h.sentence] = {
                sentence: h.sentence,
                note: (h as any).note ?? "",
              };
            }
          }
        } catch {}
      }

      const url = `http://backend:8000/downloads/${encodeURIComponent(file)}`;
      const container = containerRef.current!;
      if (!container) return;
      container.innerHTML = "";
      let pdfDoc: any = null;

      function makeTrashButton(): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "hl-del";
        btn.setAttribute("aria-label", "Delete highlight");
        btn.innerHTML = "";
        return btn;
      }

      function makeNoteInput(
        sentence: string,
        pageNum: number,
        initialValue: string,
      ): HTMLTextAreaElement {
        const noteInput = document.createElement("textarea");
        noteInput.className = "hl-note-input rounded-xl font-4005";
        noteInput.placeholder = "Add a note...";
        noteInput.value = initialValue || "";
        noteInput.style.display = "none";

        noteInput.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const note = noteInput.value.trim();
            if (!note) return;
            if (!persisted[pageNum]) persisted[pageNum] = {};
            persisted[pageNum][sentence] = { sentence, note };

            if (token) {
              await fetch(
                `http://backend:8000/user/highlight?token=${encodeURIComponent(token)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    page: pageNum,
                    sentence,
                    pdf: file,
                    note,
                  }),
                },
              );
            }
            noteInput.style.display = "none";
          }
        });

        return noteInput;
      }

      function splitAndWrap(
        span: HTMLElement,
        start: number,
        end: number,
        sentence: string,
        pageNum: number,
        note: string = "",
      ) {
        const tn = span.firstChild as Text | null;
        if (!tn || tn.nodeType !== 3) return;
        const txt = tn.textContent || "";
        if (start < 0 || end > txt.length || start >= end) return;

        const before = txt.slice(0, start);
        const mid = txt.slice(start, end);
        const after = txt.slice(end);

        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));

        const mark = document.createElement("span");
        mark.className = "highlighted";
        mark.dataset.sentence = sentence;
        mark.dataset.page = String(pageNum);

        const textNode = document.createElement("span");
        textNode.className = "hl-text";
        textNode.textContent = mid;

        const del = makeTrashButton();
        const noteInput = makeNoteInput(sentence, pageNum, note);

        mark.addEventListener("click", () => {
          const savedNote = persisted[pageNum]?.[sentence]?.note || "";
          noteInput.value = savedNote;
          noteInput.style.display =
            noteInput.style.display === "none" ? "block" : "none";
          if (noteInput.style.display === "block") {
            setTimeout(() => noteInput.focus(), 0);
          }
        });

        noteInput.addEventListener("mouseenter", () => {
          clearTimeout((mark as any)._noteHideTimer);
        });
        noteInput.addEventListener("mouseleave", () => {
          (mark as any)._noteHideTimer = setTimeout(() => {
            noteInput.style.display = "none";
          }, 2000);
        });

        mark.appendChild(textNode);
        mark.appendChild(del);
        mark.appendChild(noteInput);

        (span as HTMLElement).style.pointerEvents = "auto";

        frag.appendChild(mark);
        if (after) frag.appendChild(document.createTextNode(after));

        span.innerHTML = "";
        span.appendChild(frag);
      }

      function normalizeForMatch(str: string) {
        return str
          .replace(/-\s*\n\s*/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }

      if (token) {
        try {
          const res = await fetch(
            `http://backend:8000/user/highlight?token=${encodeURIComponent(
              token,
            )}&pdf=${encodeURIComponent(file)}`,
          );
          if (res.ok) {
            const arr: { page: number; sentence: string; note?: string }[] =
              await res.json();
            console.log("Fetched notes:", arr);

            for (const h of arr) {
              if (!persisted[h.page]) persisted[h.page] = {};
              const normSentence = normalizeForMatch(h.sentence);
              persisted[h.page][normSentence] = {
                sentence: normSentence,
                note: (h as any).note ?? "",
              };
            }
          }
        } catch {}
      }

      mouseUpHandler = async () => {
        const selection = window.getSelection();
        const text = selection?.toString() || "";
        if (!text || !selection || selection.rangeCount === 0) return;
        const normalized = normalizeForMatch(text);
        const range = selection.getRangeAt(0);
        const selectedSpans: HTMLElement[] = [];
        container.querySelectorAll(".textLayer span").forEach((span) => {
          const spanRange = document.createRange();
          spanRange.selectNodeContents(span);
          // @ts-ignore
          if (range.intersectsNode(span))
            selectedSpans.push(span as HTMLElement);
        });
        const page =
          (range.startContainer as HTMLElement)?.parentElement
            ?.closest(".page-container")
            ?.getAttribute("data-page-number") || "1";
        const pg = parseInt(page, 10) || 1;
        selectedSpans.forEach((span) => {
          const textNode = span.firstChild;
          if (!textNode || textNode.nodeType !== 3) return;
          const spanText = textNode.textContent || "";
          const spanStart =
            range.startContainer === textNode ? range.startOffset || 0 : 0;
          const spanEnd =
            range.endContainer === textNode
              ? range.endOffset || spanText.length
              : spanText.length;
          if (spanStart >= spanEnd) return;
          splitAndWrap(span, spanStart, spanEnd, normalized, pg);
        });
        if (!persisted[pg]) persisted[pg] = {};
        persisted[pg][normalized] = { sentence: normalized, note: "" };
        if (token) {
          await fetch(
            `http://backend:8000/user/highlight?token=${encodeURIComponent(token)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: pg,
                sentence: normalized,
                pdf: file,
                note: "",
              }),
            },
          );
        }
        selection.removeAllRanges();
      };

      function highlightSentenceInLayer(
        layer: HTMLElement,
        sentenceRaw: string,
        pageNum: number,
        note: string = "",
      ) {
        const sentence = normalizeForMatch(sentenceRaw);
        if (!sentence) return;
        let existingHighlight = null;
        const highlightedElements = layer.querySelectorAll(".highlighted");
        for (const element of highlightedElements) {
          if (
            element.getAttribute("data-sentence") === sentence &&
            element.getAttribute("data-page") === String(pageNum)
          ) {
            existingHighlight = element;
            break;
          }
        }
        if (existingHighlight) {
          const noteInput = existingHighlight.querySelector(
            ".hl-note-input",
          ) as HTMLInputElement;
          if (noteInput) noteInput.value = note;
          return;
        }
        const spans = Array.from(
          layer.querySelectorAll("span"),
        ) as HTMLElement[];
        const texts = spans.map((s) =>
          s.firstChild && s.firstChild.nodeType === 3
            ? normalizeForMatch((s.firstChild as Text).data)
            : "",
        );

        const W = 8;
        for (let i = 0; i < spans.length; i++) {
          let acc = "";
          for (let w = 0; w < W && i + w < spans.length; w++) {
            const t = texts[i + w];
            acc += (acc ? " " : "") + t;
            const accNorm = acc.replace(/\s+/g, " ");

            const pos = accNorm.indexOf(sentence);
            if (pos === -1) continue;

            let rawStart = acc.indexOf(sentence);
            let rawEnd = rawStart + sentence.length;

            const segOffsets: { start: number; end: number }[] = [];
            {
              let offset = 0;
              for (let j = 0; j <= w; j++) {
                const seg = texts[i + j];
                const start = offset;
                const end = start + seg.length;
                segOffsets.push({ start, end });
                offset = end + 1;
              }
            }

            for (let j = 0; j <= w; j++) {
              const { start, end } = segOffsets[j];
              const spanIdx = i + j;
              const intersectStart = Math.max(start, rawStart);
              const intersectEnd = Math.min(end, rawEnd);
              if (intersectStart < intersectEnd) {
                const localStart = intersectStart - start;
                const localEnd = intersectEnd - start;
                splitAndWrap(
                  spans[spanIdx],
                  localStart,
                  localEnd,
                  sentence,
                  pageNum,
                  note,
                );
              }
            }
            return;
          }
        }
      }

      function renderPage(num: number) {
        pdfDoc.getPage(num).then((page: any) => {
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const outputScale = window.devicePixelRatio || 1;

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;

          canvas.width = viewport.width * outputScale;
          canvas.height = viewport.height * outputScale;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const transform =
            outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

          page.render({ canvasContext: ctx, viewport, transform });

          const pageDiv = document.createElement("div");
          pageDiv.className = "page-container";
          pageDiv.dataset.pageNumber = String(num);
          pageDiv.appendChild(canvas);

          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "textLayer";
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;
          pageDiv.appendChild(textLayerDiv);

          container.appendChild(pageDiv);

          page.getTextContent().then((textContent: any) => {
            const task = window.pdfjsLib.renderTextLayer({
              textContent,
              container: textLayerDiv,
              viewport,
              textDivs: [],
            });

            Promise.resolve(task).then(() => {
              const saved = persisted[num] || {};
              for (const s in saved) {
                highlightSentenceInLayer(
                  textLayerDiv,
                  saved[s].sentence,
                  num,
                  saved[s].note || "",
                );
              }
            });
          });
        });
      }

      function rerenderAll() {
        container.innerHTML = "";
        window.pdfjsLib.getDocument(url).promise.then((pdf: any) => {
          pdfDoc = pdf;
          for (let i = 1; i <= pdf.numPages; i++) renderPage(i);
        });
      }

      window.pdfjsLib.getDocument(url).promise.then((pdf: any) => {
        pdfDoc = pdf;
        for (let i = 1; i <= pdf.numPages; i++) renderPage(i);
      });

      mouseUpHandler = async () => {
        const selection = window.getSelection();
        const text = selection?.toString() || "";
        if (!text || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const selectedSpans: HTMLElement[] = [];
        container.querySelectorAll(".textLayer span").forEach((span) => {
          const spanRange = document.createRange();
          spanRange.selectNodeContents(span);
          // @ts-ignore
          if (range.intersectsNode(span))
            selectedSpans.push(span as HTMLElement);
        });
        const page =
          (range.startContainer as HTMLElement)?.parentElement
            ?.closest(".page-container")
            ?.getAttribute("data-page-number") || "1";
        const pg = parseInt(page, 10) || 1;
        selectedSpans.forEach((span) => {
          const textNode = span.firstChild;
          if (!textNode || textNode.nodeType !== 3) return;
          const spanText = textNode.textContent || "";
          const spanStart =
            range.startContainer === textNode ? range.startOffset || 0 : 0;
          const spanEnd =
            range.endContainer === textNode
              ? range.endOffset || spanText.length
              : spanText.length;
          if (spanStart >= spanEnd) return;
          splitAndWrap(span, spanStart, spanEnd, text, pg);
        });
        if (!persisted[pg]) persisted[pg] = {};
        persisted[pg][text] = { sentence: text, note: "" };
        if (token) {
          await fetch(
            `http://backend:8000/user/highlight?token=${encodeURIComponent(
              token,
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: pg,
                sentence: text,
                pdf: file,
                note: "",
              }),
            },
          );
        }
        selection.removeAllRanges();
      };

      clickHandler = async (ev: MouseEvent) => {
        const target = ev.target as HTMLElement;
        const btn = target.closest(".hl-del") as HTMLElement | null;
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        const mark = btn.closest(".highlighted") as HTMLElement | null;
        if (!mark) return;
        const sentence = mark.dataset.sentence || "";
        const pageNum = parseInt(mark.dataset.page || "1", 10) || 1;
        const tk = localStorage.getItem("token") || "";
        if (!tk || !sentence) return;
        await fetch(
          `http://backend:8000/user/highlight/delete?token=${encodeURIComponent(
            tk,
          )}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page: pageNum, sentence, pdf: file }),
          },
        );
        if (persisted[pageNum]) {
          delete persisted[pageNum][sentence];
        }
        rerenderAll();
      };

      document.addEventListener("mouseup", mouseUpHandler);
      container.addEventListener("click", clickHandler as any);
    };

    document.head.appendChild(script);

    return () => {
      if (mouseUpHandler)
        document.removeEventListener("mouseup", mouseUpHandler);
      if (clickHandler && containerRef.current)
        containerRef.current.removeEventListener("click", clickHandler as any);
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [file]);

  return (
    <div className="flex h-screen flex-col">
      {/* header */}
      <div className="shrink-0 w-full px-8 py-4  border-gray-300 flex justify-between items-center bg-white sticky top-0 z-50">
        <a href="/home" className="text-black font-1001 text-6xl">
          Paperion
        </a>
        <BurgerMenu token={token} />
      </div>

      <style>{`
        body { margin: 0; font-family: sans-serif; }
        #pdf-container { width: 100%; }
        .page-container { position: relative; margin: 10px auto; width: fit-content; }
        canvas { display: block; z-index: 0; }
        .textLayer { position: absolute; top: 0; left: 0; pointer-events: auto; color: transparent; user-select: text; z-index: 1; }
        .textLayer input.hl-note-input { color: black !important; caret-color: black !important; pointer-events: auto !important; }
        .textLayer > span { pointer-events: auto !important; }
        .textLayer span { position: absolute; white-space: pre; transform-origin: 0 0; }
        .highlighted { position: relative; background-color: rgba(255, 255, 0, 0.4); padding-right: 18px; transition: background-color .15s ease; }
        .highlighted:hover { background-color: rgba(255, 165, 0, 0.55); }
        .highlighted .hl-text { background-color: rgba(255, 255, 0, 0.4); color: transparent; }
        .highlighted .hl-del { position: absolute;
            left: -28px;              /* move it to the left side */
            top: 50%;
            transform: translateY(-50%);
            display: block;           /* always visible */
            background: transparent;
            border: 0;
            cursor: pointer;
            opacity: 0.85;
          }
        .highlighted:hover .hl-del { display: inline-block; }
        .hl-del svg { pointer-events: none; }
        .hl-note-input { 
          position: absolute; 
          top: calc(100% + 40px); 
          left: 0; 
          font-size: 14px; 
          padding: 0.8rem 1.2rem;
          width: 430px; 
          z-index: 2; 
          background: rgba(255, 255, 255, 0.2);
          color: black; 
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1),
          0 2px 4px -2px rgba(0,0,0,0.1); 
          background: rgba(255, 255, 255, 0.3); /* translucent background */
          backdrop-filter: blur(8px);           /* glass blur */
          -webkit-backdrop-filter: blur(8px);   /* Safari support */
          border: 1px solid rgba(255, 255, 255, 0.4);
          min-height: 80px;   /* enough room for lines */
          resize: vertical;   /* optional: let user resize */
          line-height: 1.4;
          

        }
      `}</style>

      <div className="flex flex-1 overflow-hidden relative">
        <div
          id="pdf-container"
          ref={containerRef}
          className={`flex-1 overflow-y-scroll p-4 ${summary ? "w-1/2" : "w-full"}`}
        />

        {summary && (
          <div className="w-2/5 p-4 mr-6 border-gray-300 overflow-y-auto  scrollbar-hidden h-full space-y-6">
            <div className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl">
              <h2 className="font-4001 mb-4">Research Problem</h2>
              <p className="font-3003 text-[15px]">
                {summary.summary.research_problem}
              </p>
            </div>
            <div className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl">
              <h2 className="font-4001 mb-4">Method</h2>
              <p className="font-3003 text-[15px]">{summary.summary.method}</p>
            </div>
            <div className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl">
              <h2 className="font-4001 mb-4">Data Collection</h2>
              <p className="font-3003 text-[15px]">
                {summary.summary.data_collection}
              </p>
            </div>
            <div className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl">
              <h2 className="font-4001 mb-4">Data Analysis</h2>
              <p className="font-3003 text-[15px]">
                {summary.summary.data_analysis}
              </p>
            </div>
            <div className="bg-stone-200/40 shadow px-8 py-4 rounded-2xl">
              <h2 className="font-4001 mb-4">Methodological Choices</h2>
              <p className="font-3003 text-[15px]">
                {summary.summary.methodological_choices}
              </p>
            </div>
          </div>
        )}

        {!summary && (
          <button
            onClick={handleSummarizeWithAI}
            disabled={loading}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 font-5002 tracking-wide flex flex-row gap-2 items-center btn-grad px-6 py-3 text-white rounded-full shadow-lg cursor-pointer"
          >
            <img src="/icons/aistar.png" alt="AI Star" className="w-8 h-8" />
            {loading ? "Summarizing..." : "Summarize"}
          </button>
        )}
      </div>
    </div>
  );
}
