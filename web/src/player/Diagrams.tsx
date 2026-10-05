import { getFile, type PeFile } from "@pire/content";
import { cx } from "../ui/bits";

const h = (n: number | bigint) => n.toString(16).toUpperCase();
const COLORS: Record<string, string> = { headers: "#948D81", ".text": "#E58A4E", ".rdata": "#5EB0EF", ".data": "#7DD181", ".pdata": "#B58CF0", ".reloc": "#F06BA8" };

/** Drawn explanations the guide shows for Module 2. They read vault.exe's real layout. */
export function Diagram({ id }: { id: "rulers" | "alignment" | "mapping" | "timeline" }) {
  const file = getFile("vault");
  return (
    <div className="rounded-md border border-line bg-ink p-3 text-[11px]" data-testid={"diagram-" + id}>
      {id === "rulers" && <Rulers file={file} />}
      {id === "alignment" && <Alignment file={file} />}
      {id === "mapping" && <Mapping file={file} />}
      {id === "timeline" && <Timeline />}
    </div>
  );
}

function secString(file: PeFile) {
  const s = file.sections.find((x) => x.name === ".rdata")!;
  const rva = 0x3250;
  return { rva, off: rva - s.va + s.rawPtr, va: file.imageBase + BigInt(rva) };
}

function Rulers({ file }: { file: PeFile }) {
  const str = secString(file);
  const rows: [string, string, string][] = [
    ["File offset", "from the start of vault.exe on disk", "0x" + h(str.off)],
    ["RVA", "from the start of the loaded image", "0x" + h(str.rva)],
    ["VA", "the full address x64dbg shows", "0x" + h(str.va)],
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-muted">One string, "opensesame", three addresses:</p>
      {rows.map(([name, , value]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-fg">{name}</span>
          <span className="relative h-5 grow rounded-xs bg-raised">
            <span className="absolute inset-y-0 w-1 rounded-xs bg-amber" style={{ left: name === "File offset" ? "38%" : name === "RVA" ? "52%" : "74%" }} />
          </span>
          <span className="w-24 shrink-0 text-right font-mono text-amber">{value}</span>
        </div>
      ))}
      <p className="text-faint">{rows.map(([n, w]) => n + ": " + w).join(". ") + "."}</p>
    </div>
  );
}

function Alignment({ file }: { file: PeFile }) {
  const end = file.bytes.length;
  const img = Number(file.sections.reduce((m, s) => Math.max(m, s.va + Math.ceil(s.vsize / 0x1000) * 0x1000), 0));
  const bar = (label: string, total: number, parts: { name: string; from: number; size: number }[]) => (
    <div>
      <p className="mb-1 text-muted">{label}</p>
      <div className="relative h-7 rounded-xs bg-raised">
        {parts.map((p) => (
          <span
            key={p.name}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-ink font-mono text-[10px] text-ink"
            style={{ left: (p.from / total) * 100 + "%", width: (p.size / total) * 100 + "%", backgroundColor: COLORS[p.name] ?? "#6C8AA9" }}
          >
            {p.size / total > 0.07 ? p.name : ""}
          </span>
        ))}
      </div>
      <p className="mt-0.5 flex justify-between font-mono text-[10px] text-faint">
        <span>0</span>
        <span>{"0x" + h(total)}</span>
      </p>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      {bar("On disk: packed, aligned to 0x200 (FileAlignment)", end, [
        { name: "headers", from: 0, size: file.sections[0]!.rawPtr },
        ...file.sections.map((s) => ({ name: s.name, from: s.rawPtr, size: s.rawSize })),
      ])}
      {bar("In memory: each section on its own 0x1000 page (SectionAlignment)", img, [
        { name: "headers", from: 0, size: 0x1000 },
        ...file.sections.map((s) => ({ name: s.name, from: s.va, size: Math.ceil(s.vsize / 0x1000) * 0x1000 })),
      ])}
    </div>
  );
}

function Mapping({ file }: { file: PeFile }) {
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-28 flex-col gap-0.5">
        <p className="mb-1 text-muted">vault.exe on disk</p>
        <Block name="headers" text="0x0" />
        {file.sections.map((s) => (
          <Block key={s.name} name={s.name} text={"0x" + h(s.rawPtr)} />
        ))}
      </div>
      <div className="flex flex-col justify-center text-amber">→</div>
      <div className="flex grow flex-col gap-0.5">
        <p className="mb-1 text-muted">the new process's memory</p>
        <Block name="headers" text={"0x" + h(file.imageBase)} />
        {file.sections.map((s) => (
          <Block key={s.name} name={s.name} text={"0x" + h(file.imageBase + BigInt(s.va))} tall />
        ))}
        <div className="mt-2 rounded-xs border border-dashed border-line px-2 py-1 text-muted">ntdll.dll, mapped into every process</div>
      </div>
    </div>
  );
}

function Block({ name, text, tall }: { name: string; text: string; tall?: boolean }) {
  return (
    <div className={cx("flex items-center justify-between rounded-xs px-2 font-mono text-[10px] text-ink", tall ? "h-6" : "h-4.5")} style={{ backgroundColor: COLORS[name] ?? "#6C8AA9" }}>
      <span>{name}</span>
      <span>{text}</span>
    </div>
  );
}

const TIMELINE: [string, string][] = [
  ["Kernel", "creates the process, maps vault.exe and ntdll.dll"],
  ["Loader (ntdll)", "loads DLLs, fills the IAT"],
  ["System breakpoint", "x64dbg's first stop"],
  ["TLS callbacks", "if the program has any"],
  ["RtlUserThreadStart", "ntdll starts the main thread"],
  ["BaseThreadInitThunk", "kernel32 calls the entry point"],
  ["Entry point", "mainCRTStartup, the C runtime startup"],
  ["main", "your code"],
  ["exit", "main's return value becomes the exit code"],
];

function Timeline() {
  return (
    <ol className="relative flex flex-col gap-1.5 pl-4">
      <span className="absolute top-1 bottom-1 left-1 w-px bg-line" />
      {TIMELINE.map(([name, what]) => (
        <li key={name} className="relative">
          <span className="absolute top-1.5 -left-3.75 size-2 rounded-full bg-amber" />
          <span className="text-fg">{name}</span> <span className="text-muted">{what}</span>
        </li>
      ))}
    </ol>
  );
}
