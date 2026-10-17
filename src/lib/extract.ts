// Browser-only: extract text from PDF / EPUB / TXT and split into chunks.
export type Progress = (msg: string, pct: number) => void;

export async function extractText(file: File, onProgress: Progress): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file, onProgress);
  if (name.endsWith(".epub")) return extractEpub(file, onProgress);
  return file.text();
}

async function extractPdf(file: File, onProgress: Progress) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    parts.push(tc.items.map((i) => ("str" in i ? i.str : "")).join(" "));
    page.cleanup();
    if (p % 5 === 0) onProgress(`Reading page ${p} of ${doc.numPages}`, p / doc.numPages);
  }
  return parts.join("\n\n");
}

async function extractEpub(file: File, onProgress: Progress) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await zip.file("META-INF/container.xml")?.async("text");
  if (!container) throw new Error("Not a valid EPUB");
  const parser = new DOMParser();
  const opfPath = parser.parseFromString(container, "application/xml").querySelector("rootfile")?.getAttribute("full-path") ?? "";
  const opf = parser.parseFromString((await zip.file(opfPath)?.async("text")) ?? "", "application/xml");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const manifest = new Map<string, string>();
  opf.querySelectorAll("manifest > item").forEach((it) => manifest.set(it.getAttribute("id")!, it.getAttribute("href")!));
  const spine = [...opf.querySelectorAll("spine > itemref")].map((r) => manifest.get(r.getAttribute("idref")!)).filter(Boolean) as string[];
  const parts: string[] = [];
  for (let i = 0; i < spine.length; i++) {
    const html = await zip.file(decodeURIComponent(base + spine[i]))?.async("text");
    if (html) parts.push(parser.parseFromString(html, "text/html").body?.textContent ?? "");
    onProgress(`Reading section ${i + 1} of ${spine.length}`, (i + 1) / spine.length);
  }
  return parts.join("\n\n");
}

export function chunkText(text: string, size = 6000): string[] {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const brk = clean.lastIndexOf(". ", end);
      if (brk > i + size * 0.6) end = brk + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece.length > 300) out.push(piece);
    i = end;
  }
  return out;
}
