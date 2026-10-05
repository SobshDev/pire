/*
 * Builds real PE file bytes for the course's specimens, plus a map of every field the lessons talk
 * about. The hex viewer draws its structure overlay from the map, and the PE viewer reads the same
 * map, so the two always agree with the bytes.
 */

export interface PeField {
  /** Stable id lessons refer to, such as "dos.e_lfanew" or "opt.AddressOfEntryPoint". */
  id: string;
  /** Structure id, such as "dos", "file", "opt", "dd", "sec.text", "iat.USER32.dll". */
  group: string;
  name: string;
  offset: number;
  size: number;
  /** The value as a tool would print it, such as "0x8664". */
  value: string;
  /** What the value means, such as "x64" or "console". */
  meaning?: string;
}

export interface PeGroup {
  id: string;
  label: string;
  offset: number;
  size: number;
}

export interface PeSection {
  name: string;
  va: number;
  vsize: number;
  rawPtr: number;
  rawSize: number;
  chars: number;
}

export interface PeImportFunc {
  name: string;
  hint: number;
  /** RVA of the IAT slot. */
  slot: number;
  /** RVA of the hint/name record the slot points to on disk. */
  hintName: number;
}

export interface PeImport {
  dll: string;
  /** File offset of the import descriptor. */
  descriptor: number;
  /** RVAs of the lookup table and the IAT. */
  ilt: number;
  iat: number;
  funcs: PeImportFunc[];
}

export interface PeExport {
  ordinal: number;
  name: string;
  rva: number;
}

export interface PeFile {
  id: string;
  name: string;
  bits: 32 | 64;
  bytes: Uint8Array;
  imageBase: bigint;
  entry: number;
  machine: number;
  subsystem: number;
  dllChars: number;
  lfanew: number;
  sections: PeSection[];
  imports: PeImport[];
  exports: PeExport[];
  dataDirs: { index: number; name: string; rva: number; size: number }[];
  fields: PeField[];
  groups: PeGroup[];
}

export interface PeSectionSpec {
  name: string;
  va: number;
  /** Bytes from the start of the section. The builder may add import or export tables to them. */
  bytes: number[];
  /** Virtual size when it is bigger than the bytes, such as .data with uninitialized globals. */
  vsize?: number;
  chars: number;
}

export interface PeSpec {
  id: string;
  name: string;
  bits: 32 | 64;
  imageBase: bigint;
  entry: number;
  subsystem: 2 | 3;
  dllChars: number;
  timestamp: number;
  dll?: boolean;
  sections: PeSectionSpec[];
  imports?: { dll: string; funcs: string[] }[];
  /** RVAs for the IAT and the import directory. The rest of the import tables follow the directory. */
  importAt?: { iat: number; dir: number };
  exports?: { at: number; dllName: string; names: [string, number][] };
  /** RVAs of absolute addresses the loader must fix if the image moves. Adds a .reloc section. */
  relocs?: number[];
}

const FILE_ALIGN = 0x200;
const SECTION_ALIGN = 0x1000;
const LFANEW = 0xf8;
const align = (n: number, a: number) => Math.ceil(n / a) * a;
const h = (n: number | bigint, w = 0) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");

export const SECTION_FLAGS: [number, string][] = [
  [0x20, "code"],
  [0x40, "initialized data"],
  [0x80, "uninitialized data"],
  [0x02000000, "discardable"],
  [0x20000000, "execute"],
  [0x40000000, "read"],
  [0x80000000, "write"],
];
export const DLL_CHAR_FLAGS: [number, string][] = [
  [0x20, "HIGH_ENTROPY_VA"],
  [0x40, "DYNAMIC_BASE"],
  [0x100, "NX_COMPAT"],
  [0x8000, "TERMINAL_SERVER_AWARE"],
];
export const DATA_DIRS = [
  "Export", "Import", "Resource", "Exception", "Security", "Base Relocation", "Debug", "Architecture",
  "Global Ptr", "TLS", "Load Config", "Bound Import", "IAT", "Delay Import", "COM Descriptor", "Reserved",
];
const flagNames = (v: number, table: [number, string][]) => table.filter(([bit]) => (v & bit) !== 0).map(([, n]) => n).join(", ");
const MACHINES: Record<number, string> = { 0x8664: "x64", 0x14c: "x86 (32-bit)", 0xaa64: "ARM64" };
const SUBSYSTEMS: Record<number, string> = { 2: "Windows GUI", 3: "Windows console" };

class Bytes {
  a: number[] = [];
  at(off: number) {
    while (this.a.length < off) this.a.push(0);
  }
  put(off: number, size: number, v: number | bigint) {
    this.at(off + size);
    let x = BigInt(v);
    for (let i = 0; i < size; i++) {
      this.a[off + i] = Number(x & 0xffn);
      x >>= 8n;
    }
  }
  raw(off: number, bytes: number[]) {
    this.at(off + bytes.length);
    bytes.forEach((b, i) => (this.a[off + i] = b));
  }
  ascii(off: number, s: string, terminator = true) {
    this.raw(off, [...s].map((c) => c.charCodeAt(0)).concat(terminator ? [0] : []));
  }
}

const ascii = (s: string, terminator = true) => [...s].map((c) => c.charCodeAt(0)).concat(terminator ? [0] : []);

/** A fake but well-formed Rich header: the linker's record of the tools that built the file. */
function richHeader(): number[] {
  const key = 0x8f1c2a63;
  const entries: [number, number][] = [
    [0x01047a2e, 12], [0x01037a2e, 9], [0x01057a2e, 4], [0x00937a2e, 22],
    [0x00017a2e, 3], [0x01027a2e, 1], [0x00ff7a2e, 1], [0x01017a2e, 1],
  ];
  const words = [0x536e6144 ^ key, key, key, key, ...entries.flatMap(([id, n]) => [(id ^ key) >>> 0, (n ^ key) >>> 0]), 0x68636952, key];
  return words.flatMap((w) => [w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, (w >>> 24) & 0xff]);
}

const DOS_STUB = [0x0e, 0x1f, 0xba, 0x0e, 0x00, 0xb4, 0x09, 0xcd, 0x21, 0xb8, 0x01, 0x4c, 0xcd, 0x21, ...ascii("This program cannot be run in DOS mode.\r\r\n$", false)];

/** Lays out the import tables (descriptors, lookup tables, hint/name records, DLL names) in a section. */
function layoutImports(spec: PeSpec, sec: (rva: number) => PeSectionSpec): PeImport[] {
  if (!spec.imports || !spec.importAt) return [];
  const ptr = spec.bits === 64 ? 8 : 4;
  const put = (rva: number, size: number, v: number) => {
    const s = sec(rva);
    const off = rva - s.va;
    while (s.bytes.length < off + size) s.bytes.push(0);
    // Values here are 32-bit RVAs; the upper half of a 64-bit thunk is zero.
    for (let i = 0; i < size; i++) s.bytes[off + i] = i < 4 ? (v >>> (8 * i)) & 0xff : 0;
  };
  const putBytes = (rva: number, bytes: number[]) => bytes.forEach((b, i) => put(rva + i, 1, b));
  const dir = spec.importAt.dir;
  const n = spec.imports.length;
  let ilt = dir + (n + 1) * 20;
  const slots = spec.imports.reduce((t, d) => t + d.funcs.length + 1, 0);
  let names = ilt + slots * ptr;
  let iat = spec.importAt.iat;
  const out: PeImport[] = [];
  const hintNames: { rva: number; name: string; hint: number }[] = [];
  spec.imports.forEach((d, i) => {
    const imp: PeImport = { dll: d.dll, descriptor: dir + i * 20, ilt, iat, funcs: [] };
    for (const f of d.funcs) {
      const hint = (f.length * 37 + f.charCodeAt(0) * 11) % 0x4c0;
      const rec = { rva: 0, name: f, hint };
      hintNames.push(rec);
      imp.funcs.push({ name: f, hint, slot: iat, hintName: 0 });
      iat += ptr;
      ilt += ptr;
    }
    iat += ptr;
    ilt += ptr;
    out.push(imp);
  });
  for (const rec of hintNames) {
    rec.rva = names;
    putBytes(names, [rec.hint & 0xff, rec.hint >> 8, ...ascii(rec.name)]);
    names = align(names + 2 + rec.name.length + 1, 2);
  }
  let k = 0;
  for (const imp of out) {
    const nameRva = names;
    putBytes(names, ascii(imp.dll));
    names = align(names + imp.dll.length + 1, 2);
    imp.funcs.forEach((f, j) => {
      f.hintName = hintNames[k++]!.rva;
      put(imp.ilt + j * ptr, ptr, f.hintName);
      put(imp.iat + j * ptr, ptr, f.hintName);
    });
    put(imp.ilt + imp.funcs.length * ptr, ptr, 0);
    put(imp.iat + imp.funcs.length * ptr, ptr, 0);
    put(imp.descriptor, 4, imp.ilt);
    put(imp.descriptor + 4, 4, 0);
    put(imp.descriptor + 8, 4, 0);
    put(imp.descriptor + 12, 4, nameRva);
    put(imp.descriptor + 16, 4, imp.iat);
  }
  put(dir + n * 20 + 19, 1, 0);
  return out;
}

function layoutExports(spec: PeSpec, sec: (rva: number) => PeSectionSpec): { list: PeExport[]; size: number } {
  if (!spec.exports) return { list: [], size: 0 };
  const { at, dllName, names } = spec.exports;
  const sorted = [...names].sort(([a], [b]) => (a < b ? -1 : 1));
  const s = sec(at);
  const w = new Bytes();
  w.a = s.bytes;
  const n = sorted.length;
  const funcs = at + 40;
  const namePtrs = funcs + n * 4;
  const ords = namePtrs + n * 4;
  let str = ords + n * 2;
  const rel = (rva: number) => rva - s.va;
  w.put(rel(at + 4), 4, spec.timestamp);
  w.put(rel(at + 12), 4, str);
  w.ascii(rel(str), dllName);
  str += dllName.length + 1;
  w.put(rel(at + 16), 4, 1500);
  w.put(rel(at + 20), 4, n);
  w.put(rel(at + 24), 4, n);
  w.put(rel(at + 28), 4, funcs);
  w.put(rel(at + 32), 4, namePtrs);
  w.put(rel(at + 36), 4, ords);
  const list: PeExport[] = sorted.map(([name, rva], i) => {
    w.put(rel(funcs + i * 4), 4, rva);
    w.put(rel(namePtrs + i * 4), 4, str);
    w.put(rel(ords + i * 2), 2, i);
    w.ascii(rel(str), name);
    str += name.length + 1;
    return { ordinal: 1500 + i, name, rva };
  });
  return { list, size: str - at };
}

function relocSection(relocs: number[], va: number): PeSectionSpec {
  const pages = new Map<number, number[]>();
  for (const r of [...relocs].sort((a, b) => a - b)) {
    const page = r & ~0xfff;
    pages.set(page, [...(pages.get(page) ?? []), r & 0xfff]);
  }
  const w = new Bytes();
  let off = 0;
  for (const [page, entries] of pages) {
    const list = entries.length % 2 ? [...entries, -1] : entries;
    const size = 8 + list.length * 2;
    w.put(off, 4, page);
    w.put(off + 4, 4, size);
    list.forEach((e, i) => w.put(off + 8 + i * 2, 2, e < 0 ? 0 : (0xa << 12) | e));
    off += size;
  }
  return { name: ".reloc", va, bytes: w.a, chars: 0x42000040 };
}

/** Builds the file. Section raw data is packed from 0x400 on, aligned to 0x200. */
export function buildPe(spec: PeSpec): PeFile {
  const is64 = spec.bits === 64;
  const sections: PeSectionSpec[] = spec.sections.map((s) => ({ ...s, bytes: [...s.bytes] }));
  const sec = (rva: number) => {
    const s = sections.find((x, k) => rva >= x.va && rva < (sections[k + 1]?.va ?? Infinity));
    if (!s) throw new Error(spec.id + ": no section for RVA " + h(rva));
    return s;
  };
  const imports = layoutImports(spec, sec);
  const exp = layoutExports(spec, sec);
  if (spec.relocs?.length) {
    const last = sections[sections.length - 1]!;
    sections.push(relocSection(spec.relocs, align(last.va + Math.max(last.vsize ?? 0, last.bytes.length), SECTION_ALIGN)));
  }

  const optSize = is64 ? 0xf0 : 0xe0;
  const fileHdr = LFANEW + 4;
  const opt = fileHdr + 20;
  const secTable = opt + optSize;
  const headersSize = align(secTable + sections.length * 40, FILE_ALIGN);

  let raw = headersSize;
  const laid: PeSection[] = sections.map((s) => {
    let used = s.bytes.length;
    while (used > 0 && s.bytes[used - 1] === 0) used--;
    const rawSize = align(used, FILE_ALIGN);
    const out: PeSection = { name: s.name, va: s.va, vsize: Math.max(s.vsize ?? 0, s.bytes.length), rawPtr: rawSize ? raw : 0, rawSize, chars: s.chars };
    raw += rawSize;
    return out;
  });
  const lastSec = laid[laid.length - 1]!;
  const sizeOfImage = align(lastSec.va + lastSec.vsize, SECTION_ALIGN);

  const w = new Bytes();
  const fields: PeField[] = [];
  const groups: PeGroup[] = [];
  const field = (group: string, name: string, offset: number, size: number, v: number | bigint, meaning?: string, shown?: string) => {
    w.put(offset, size, v);
    fields.push({ id: group + "." + name, group, name, offset, size, value: shown ?? h(v, size * 2 > 8 ? 0 : 0), ...(meaning ? { meaning } : {}) });
  };

  // DOS header
  groups.push({ id: "dos", label: "DOS header", offset: 0, size: 0x40 });
  const dos: [string, number, number][] = [
    ["e_magic", 2, 0x5a4d], ["e_cblp", 2, 0x90], ["e_cp", 2, 3], ["e_crlc", 2, 0], ["e_cparhdr", 2, 4],
    ["e_minalloc", 2, 0], ["e_maxalloc", 2, 0xffff], ["e_ss", 2, 0], ["e_sp", 2, 0xb8], ["e_csum", 2, 0],
    ["e_ip", 2, 0], ["e_cs", 2, 0], ["e_lfarlc", 2, 0x40], ["e_ovno", 2, 0], ["e_res", 8, 0], ["e_oemid", 2, 0],
    ["e_oeminfo", 2, 0], ["e_res2", 20, 0], ["e_lfanew", 4, LFANEW],
  ];
  let o = 0;
  for (const [name, size, v] of dos) {
    field("dos", name, o, size, v, name === "e_magic" ? '"MZ"' : name === "e_lfanew" ? "offset of the PE header" : undefined);
    o += size;
  }
  groups.push({ id: "stub", label: "DOS stub", offset: 0x40, size: 0x40 });
  w.raw(0x40, DOS_STUB);
  const rich = richHeader();
  groups.push({ id: "rich", label: "Rich header", offset: 0x80, size: rich.length });
  w.raw(0x80, rich);

  // NT headers
  groups.push({ id: "nt", label: "PE signature", offset: LFANEW, size: 4 });
  field("nt", "Signature", LFANEW, 4, 0x4550, '"PE\\0\\0"');
  groups.push({ id: "file", label: "File header", offset: fileHdr, size: 20 });
  const machine = is64 ? 0x8664 : 0x14c;
  const fileChars = (spec.dll ? 0x2000 : 0) | (is64 ? 0x22 : 0x102) | (spec.relocs?.length ? 0 : 0x1);
  const fileFields: [string, number, number, string?][] = [
    ["Machine", 2, machine, MACHINES[machine]],
    ["NumberOfSections", 2, laid.length, String(laid.length)],
    ["TimeDateStamp", 4, spec.timestamp],
    ["PointerToSymbolTable", 4, 0],
    ["NumberOfSymbols", 4, 0],
    ["SizeOfOptionalHeader", 2, optSize],
    ["Characteristics", 2, fileChars, [fileChars & 1 && "relocs stripped", fileChars & 2 && "executable", fileChars & 0x20 && "large address aware", fileChars & 0x100 && "32-bit machine", fileChars & 0x2000 && "DLL"].filter(Boolean).join(", ")],
  ];
  o = fileHdr;
  for (const [name, size, v, meaning] of fileFields) {
    field("file", name, o, size, v, meaning);
    o += size;
  }

  // Optional header
  groups.push({ id: "opt", label: "Optional header", offset: opt, size: optSize - 16 * 8 });
  const code = laid.filter((s) => s.chars & 0x20);
  const init = laid.filter((s) => s.chars & 0x40);
  const ptr = is64 ? 8 : 4;
  const optFields: [string, number, number | bigint, string?][] = [
    ["Magic", 2, is64 ? 0x20b : 0x10b, is64 ? "PE32+ (64-bit)" : "PE32 (32-bit)"],
    ["MajorLinkerVersion", 1, 14],
    ["MinorLinkerVersion", 1, 0x29],
    ["SizeOfCode", 4, code.reduce((t, s) => t + s.rawSize, 0)],
    ["SizeOfInitializedData", 4, init.reduce((t, s) => t + s.rawSize, 0)],
    ["SizeOfUninitializedData", 4, 0],
    ["AddressOfEntryPoint", 4, spec.entry, spec.dll ? "DllMain startup (RVA)" : "RVA"],
    ["BaseOfCode", 4, code[0]?.va ?? 0x1000],
    ...(is64 ? [] : ([["BaseOfData", 4, laid.find((s) => !(s.chars & 0x20))?.va ?? 0]] as [string, number, number][])),
    ["ImageBase", ptr, spec.imageBase],
    ["SectionAlignment", 4, SECTION_ALIGN],
    ["FileAlignment", 4, FILE_ALIGN],
    ["MajorOperatingSystemVersion", 2, 6],
    ["MinorOperatingSystemVersion", 2, 0],
    ["MajorImageVersion", 2, 0],
    ["MinorImageVersion", 2, 0],
    ["MajorSubsystemVersion", 2, 6],
    ["MinorSubsystemVersion", 2, 0],
    ["Win32VersionValue", 4, 0],
    ["SizeOfImage", 4, sizeOfImage],
    ["SizeOfHeaders", 4, headersSize],
    ["CheckSum", 4, 0],
    ["Subsystem", 2, spec.subsystem, SUBSYSTEMS[spec.subsystem]],
    ["DllCharacteristics", 2, spec.dllChars, flagNames(spec.dllChars, DLL_CHAR_FLAGS)],
    ["SizeOfStackReserve", ptr, 0x100000],
    ["SizeOfStackCommit", ptr, 0x1000],
    ["SizeOfHeapReserve", ptr, 0x100000],
    ["SizeOfHeapCommit", ptr, 0x1000],
    ["LoaderFlags", 4, 0],
    ["NumberOfRvaAndSizes", 4, 16],
  ];
  o = opt;
  for (const [name, size, v, meaning] of optFields) {
    field("opt", name, o, size, v, meaning);
    o += size;
  }

  // Data directories
  const iatSize = imports.reduce((t, d) => t + (d.funcs.length + 1) * ptr, 0);
  const pdata = laid.find((s) => s.name === ".pdata");
  const reloc = laid.find((s) => s.name === ".reloc");
  const dirs: Record<number, [number, number]> = {};
  if (exp.list.length) dirs[0] = [spec.exports!.at, exp.size];
  if (imports.length) dirs[1] = [spec.importAt!.dir, (imports.length + 1) * 20];
  if (pdata) dirs[3] = [pdata.va, pdata.vsize];
  if (reloc) dirs[5] = [reloc.va, reloc.vsize];
  if (imports.length) dirs[12] = [spec.importAt!.iat, iatSize];
  groups.push({ id: "dd", label: "Data directories", offset: o, size: 16 * 8 });
  const dataDirs = DATA_DIRS.map((name, i) => {
    const [rva, size] = dirs[i] ?? [0, 0];
    field("dd", name + ".VirtualAddress", o + i * 8, 4, rva, i === 0 && !rva ? "none" : undefined);
    field("dd", name + ".Size", o + i * 8 + 4, 4, size);
    return { index: i, name, rva, size };
  });

  // Section table
  laid.forEach((s, i) => {
    const at = secTable + i * 40;
    const g = "sec" + s.name;
    groups.push({ id: g, label: "Section header " + s.name, offset: at, size: 40 });
    w.ascii(at, s.name, false);
    fields.push({ id: g + ".Name", group: g, name: "Name", offset: at, size: 8, value: '"' + s.name + '"' });
    field(g, "VirtualSize", at + 8, 4, s.vsize);
    field(g, "VirtualAddress", at + 12, 4, s.va);
    field(g, "SizeOfRawData", at + 16, 4, s.rawSize);
    field(g, "PointerToRawData", at + 20, 4, s.rawPtr);
    field(g, "PointerToRelocations", at + 24, 4, 0);
    field(g, "PointerToLinenumbers", at + 28, 4, 0);
    field(g, "NumberOfRelocations", at + 32, 2, 0);
    field(g, "NumberOfLinenumbers", at + 34, 2, 0);
    field(g, "Characteristics", at + 36, 4, s.chars, flagNames(s.chars, SECTION_FLAGS));
  });

  // Section data
  laid.forEach((s, i) => {
    if (!s.rawSize) return;
    w.raw(s.rawPtr, sections[i]!.bytes.slice(0, s.rawSize));
    w.at(s.rawPtr + s.rawSize);
    groups.push({ id: "data" + s.name, label: s.name + " section", offset: s.rawPtr, size: s.rawSize });
  });

  // Import records the lessons point at
  const toOffset = (rva: number) => {
    const s = laid.find((x) => rva >= x.va && rva < x.va + x.vsize)!;
    return rva - s.va + s.rawPtr;
  };
  for (const imp of imports) {
    groups.push({ id: "iat." + imp.dll, label: "IAT " + imp.dll, offset: toOffset(imp.iat), size: (imp.funcs.length + 1) * ptr });
    for (const f of imp.funcs) {
      fields.push({ id: "iat." + f.name, group: "iat." + imp.dll, name: "IAT[" + f.name + "]", offset: toOffset(f.slot), size: ptr, value: h(f.hintName), meaning: "RVA of the name record" });
      fields.push({ id: "name." + f.name, group: "names", name: "hint/name " + f.name, offset: toOffset(f.hintName), size: 2 + f.name.length + 1, value: '"' + f.name + '"', meaning: "hint " + f.hint });
    }
  }

  const bytes = Uint8Array.from(w.a);
  return {
    id: spec.id,
    name: spec.name,
    bits: spec.bits,
    bytes,
    imageBase: spec.imageBase,
    entry: spec.entry,
    machine,
    subsystem: spec.subsystem,
    dllChars: spec.dllChars,
    lfanew: LFANEW,
    sections: laid,
    imports,
    exports: exp.list,
    dataDirs,
    fields,
    groups,
  };
}

/* ------------------------------------------------------------------ */
/* Address conversion                                                  */
/* ------------------------------------------------------------------ */

export function sectionOfRva(pe: PeFile, rva: number): PeSection | undefined {
  return pe.sections.find((s) => rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize));
}

export function sectionOfOffset(pe: PeFile, off: number): PeSection | undefined {
  return pe.sections.find((s) => s.rawSize && off >= s.rawPtr && off < s.rawPtr + s.rawSize);
}

export function rvaToOffset(pe: PeFile, rva: number): number | null {
  const s = sectionOfRva(pe, rva);
  if (!s) return rva < pe.sections[0]!.rawPtr ? rva : null;
  return rva - s.va + s.rawPtr;
}

export function offsetToRva(pe: PeFile, off: number): number | null {
  const s = sectionOfOffset(pe, off);
  if (!s) return off < pe.sections[0]!.rawPtr ? off : null;
  return off - s.rawPtr + s.va;
}

export function fieldOf(pe: PeFile, id: string): PeField {
  const f = pe.fields.find((x) => x.id === id);
  if (!f) throw new Error(pe.id + " has no field " + id);
  return f;
}

export function groupOf(pe: PeFile, id: string): PeGroup {
  const g = pe.groups.find((x) => x.id === id);
  if (!g) throw new Error(pe.id + " has no structure " + id);
  return g;
}

/** Where a field or structure sits in the file, in the forms lessons use: "F8", 4, and the target range "hex:F8-FB". */
export function where(pe: PeFile, id: string): { at: string; offset: number; size: number; range: string; end: string } {
  const f = pe.fields.find((x) => x.id === id) ?? pe.groups.find((x) => x.id === id);
  if (!f) throw new Error(pe.id + " has no field or structure " + id);
  const hx = (n: number) => n.toString(16).toUpperCase();
  return { at: hx(f.offset), offset: f.offset, size: f.size, range: "hex:" + hx(f.offset) + "-" + hx(f.offset + f.size - 1), end: hx(f.offset + f.size) };
}

/** Reads a little-endian number from the file. */
export function readLE(pe: PeFile, off: number, size: number): bigint {
  let v = 0n;
  for (let i = size - 1; i >= 0; i--) v = (v << 8n) | BigInt(pe.bytes[off + i] ?? 0);
  return v;
}
