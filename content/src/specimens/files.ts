import { buildPe, type PeFile } from "../pe/build";

/*
 * Files the learner only reads, never runs: the three travelers of the Module 2 challenge and the
 * export side of user32.dll. Their code bytes are filler shaped like compiler output; the headers,
 * sections, imports, and exports are what the lessons look at.
 */

/** Deterministic filler that looks like compiled functions: prologues, calls, epilogues, int3 padding. */
function code(size: number, seed: number, bits: 32 | 64): number[] {
  const x64 = [
    "4883EC28", "488D0D", "FF15", "33C9", "E8", "4883C428", "C3", "48895C2408", "57", "4883EC20", "488BD9",
    "85C0", "7412", "8BC3", "488B5C2430", "5F", "4C8D05", "BA01000000", "33D2",
  ];
  const x86 = ["55", "8BEC", "83EC10", "68", "FF15", "83C404", "33C0", "8BE5", "5D", "C3", "6A00", "8B4508", "50", "E8", "85C0", "7410"];
  const parts = bits === 64 ? x64 : x86;
  const out: number[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s);
  while (out.length < size) {
    const fnLen = 24 + (rnd() % 80);
    const start = out.length;
    while (out.length - start < fnLen) {
      const p = parts[rnd() % parts.length]!;
      for (const b of p.match(/../g)!) out.push(Number.parseInt(b, 16));
      if (["488D0D", "FF15", "E8", "68", "4C8D05"].includes(p)) for (let i = 0; i < 4; i++) out.push(rnd() & 0xff);
    }
    out.push(0xc3);
    while (out.length % 16) out.push(0xcc);
  }
  return out.slice(0, size);
}

function strings(at: number, list: [number, string, "a" | "w"][]): number[] {
  const out: number[] = [];
  for (const [rva, s, kind] of list) {
    const off = rva - at;
    [...s].forEach((c, i) => {
      if (kind === "a") out[off + i] = c.charCodeAt(0);
      else {
        out[off + i * 2] = c.charCodeAt(0);
        out[off + i * 2 + 1] = 0;
      }
    });
  }
  for (let i = 0; i < out.length; i++) out[i] ??= 0;
  return out;
}

const pdata = (fns: [number, number][]) =>
  fns.flatMap(([a, b], i) => [a, b, 0x2400 + i * 8].flatMap((v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, 0]));

/** traveler-a: a 64-bit GUI program with ASLR on that opens a window. */
export function travelerA(): PeFile {
  return buildPe({
    id: "traveler-a",
    name: "traveler-a.exe",
    bits: 64,
    imageBase: 0x140000000n,
    entry: 0x1490,
    subsystem: 2,
    dllChars: 0x8160,
    timestamp: 0x66f3c410,
    sections: [
      { name: ".text", va: 0x1000, bytes: code(0x5c0, 11, 64), chars: 0x60000020 },
      { name: ".rdata", va: 0x2000, bytes: strings(0x2000, [[0x2200, "PireWindow", "w"], [0x2220, "Hello from traveler-a", "w"], [0x2250, "traveler-a", "w"]]), chars: 0x40000040 },
      { name: ".data", va: 0x3000, bytes: [0, 0, 0, 0, 0, 0, 0, 0, 0x00, 0x22, 0x00, 0x40, 0x01], vsize: 0x240, chars: 0xc0000040 },
      { name: ".pdata", va: 0x4000, bytes: pdata([[0x1000, 0x10c4], [0x10d0, 0x1230], [0x1490, 0x1560]]), chars: 0x40000040 },
    ],
    imports: [
      { dll: "KERNEL32.dll", funcs: ["GetModuleHandleW", "GetStartupInfoW", "IsDebuggerPresent", "QueryPerformanceCounter", "GetCurrentProcessId"] },
      {
        dll: "USER32.dll",
        funcs: ["RegisterClassExW", "CreateWindowExW", "ShowWindow", "UpdateWindow", "GetMessageW", "TranslateMessage", "DispatchMessageW", "DefWindowProcW", "PostQuitMessage", "BeginPaint", "EndPaint", "MessageBoxW", "LoadCursorW"],
      },
      { dll: "GDI32.dll", funcs: ["TextOutW", "SetBkMode", "GetStockObject"] },
      { dll: "VCRUNTIME140.dll", funcs: ["memset", "__C_specific_handler"] },
      { dll: "api-ms-win-crt-runtime-l1-1-0.dll", funcs: ["_initterm", "_initterm_e", "exit", "_cexit", "_get_wide_winmain_command_line"] },
    ],
    importAt: { iat: 0x2000, dir: 0x2400 },
    relocs: [0x3008],
  });
}

/** traveler-b: a 32-bit console program with a fixed base of 0x400000. */
export function travelerB(): PeFile {
  return buildPe({
    id: "traveler-b",
    name: "traveler-b.exe",
    bits: 32,
    imageBase: 0x400000n,
    entry: 0x14d0,
    subsystem: 3,
    dllChars: 0x8100,
    timestamp: 0x66f3c9a2,
    sections: [
      { name: ".text", va: 0x1000, bytes: code(0x7a0, 23, 32), chars: 0x60000020 },
      { name: ".rdata", va: 0x2000, bytes: strings(0x2000, [[0x2200, "traveler-b: counting sheep", "a"], [0x2220, "%d sheep\n", "a"]]), chars: 0x40000040 },
      { name: ".data", va: 0x3000, bytes: [0x4e, 0xe6, 0x40, 0xbb, 0xb1, 0x19, 0xbf, 0x44], vsize: 0x380, chars: 0xc0000040 },
    ],
    imports: [
      { dll: "KERNEL32.dll", funcs: ["GetCurrentProcessId", "GetCurrentThreadId", "GetSystemTimeAsFileTime", "IsDebuggerPresent", "Sleep"] },
      { dll: "VCRUNTIME140.dll", funcs: ["memset", "_except_handler4_common"] },
      { dll: "api-ms-win-crt-stdio-l1-1-0.dll", funcs: ["__acrt_iob_func", "__stdio_common_vfprintf", "puts"] },
      { dll: "api-ms-win-crt-runtime-l1-1-0.dll", funcs: ["_initterm", "_initterm_e", "exit", "_cexit", "__p___argc", "__p___argv"] },
    ],
    importAt: { iat: 0x2000, dir: 0x2300 },
  });
}

/** traveler-c: a 64-bit console program that writes a temp file and a registry value, with an odd .pire section. */
export function travelerC(): PeFile {
  return buildPe({
    id: "traveler-c",
    name: "traveler-c.exe",
    bits: 64,
    imageBase: 0x140000000n,
    entry: 0x1360,
    subsystem: 3,
    dllChars: 0x8160,
    timestamp: 0x66f3d01e,
    sections: [
      { name: ".text", va: 0x1000, bytes: code(0x4e0, 37, 64), chars: 0x60000020 },
      {
        name: ".rdata",
        va: 0x2000,
        bytes: strings(0x2000, [[0x2200, "pire-note.txt", "w"], [0x2220, "Software\\pire", "w"], [0x2240, "LastVisit", "w"], [0x2260, "note written", "a"]]),
        chars: 0x40000040,
      },
      { name: ".data", va: 0x3000, bytes: [0x32, 0xa2, 0xdf, 0x2d, 0x99, 0x2b], vsize: 0x200, chars: 0xc0000040 },
      { name: ".pdata", va: 0x4000, bytes: pdata([[0x1000, 0x1150], [0x1160, 0x1340], [0x1360, 0x1420]]), chars: 0x40000040 },
      { name: ".pire", va: 0x5000, bytes: strings(0x5000, [[0x5000, "pire-flag: border-agent", "a"]]).concat([0]), chars: 0x40000040 },
    ],
    imports: [
      { dll: "KERNEL32.dll", funcs: ["CreateFileW", "WriteFile", "CloseHandle", "GetTempPathW", "lstrcatW", "GetModuleHandleW", "IsDebuggerPresent"] },
      { dll: "ADVAPI32.dll", funcs: ["RegCreateKeyExW", "RegSetValueExW", "RegCloseKey"] },
      { dll: "api-ms-win-crt-stdio-l1-1-0.dll", funcs: ["puts", "__acrt_iob_func"] },
      { dll: "api-ms-win-crt-runtime-l1-1-0.dll", funcs: ["_initterm", "_initterm_e", "exit", "_cexit"] },
    ],
    importAt: { iat: 0x2000, dir: 0x2400 },
    relocs: [0x3010],
  });
}

const USER32_EXPORTS = [
  "ActivateKeyboardLayout", "AdjustWindowRect", "AdjustWindowRectEx", "AllowSetForegroundWindow", "AnimateWindow",
  "AppendMenuA", "AppendMenuW", "BeginDeferWindowPos", "BeginPaint", "BlockInput", "BringWindowToTop",
  "CallNextHookEx", "CallWindowProcA", "CallWindowProcW", "ChangeDisplaySettingsW", "CharLowerA", "CharLowerW",
  "CharNextA", "CharNextW", "CharUpperA", "CharUpperW", "CheckDlgButton", "CheckMenuItem", "ChildWindowFromPoint",
  "ClientToScreen", "ClipCursor", "CloseClipboard", "CloseWindow", "CopyIcon", "CopyImage", "CountClipboardFormats",
  "CreateCursor", "CreateDialogParamA", "CreateDialogParamW", "CreateIconIndirect", "CreateMenu", "CreatePopupMenu",
  "CreateWindowExA", "CreateWindowExW", "DefDlgProcW", "DefWindowProcA", "DefWindowProcW", "DeleteMenu",
  "DestroyCursor", "DestroyIcon", "DestroyMenu", "DestroyWindow", "DialogBoxParamA", "DialogBoxParamW",
  "DispatchMessageA", "DispatchMessageW", "DrawIconEx", "DrawMenuBar", "DrawTextA", "DrawTextW", "EmptyClipboard",
  "EnableMenuItem", "EnableWindow", "EndDialog", "EndPaint", "EnumChildWindows", "EnumClipboardFormats",
  "EnumDisplayMonitors", "EnumWindows", "FillRect", "FindWindowA", "FindWindowExA", "FindWindowExW", "FindWindowW",
  "FlashWindow", "GetActiveWindow", "GetAsyncKeyState", "GetCapture", "GetClassNameA", "GetClassNameW",
  "GetClientRect", "GetClipboardData", "GetCursorPos", "GetDC", "GetDesktopWindow", "GetDlgItem", "GetDlgItemTextA",
  "GetDlgItemTextW", "GetFocus", "GetForegroundWindow", "GetKeyState", "GetKeyboardLayout", "GetKeyboardState",
  "GetMenu", "GetMessageA", "GetMessageW", "GetMonitorInfoW", "GetParent", "GetRawInputData", "GetSystemMetrics",
  "GetWindow", "GetWindowDC", "GetWindowLongPtrA", "GetWindowLongPtrW", "GetWindowRect", "GetWindowTextA",
  "GetWindowTextLengthW", "GetWindowTextW", "GetWindowThreadProcessId", "InvalidateRect", "IsDialogMessageW",
  "IsIconic", "IsWindow", "IsWindowVisible", "IsZoomed", "KillTimer", "LoadAcceleratorsW", "LoadCursorA",
  "LoadCursorW", "LoadIconA", "LoadIconW", "LoadImageA", "LoadImageW", "LoadStringA", "LoadStringW",
  "MapVirtualKeyW", "MessageBeep", "MessageBoxA", "MessageBoxExA", "MessageBoxExW", "MessageBoxIndirectA",
  "MessageBoxIndirectW", "MessageBoxW", "MonitorFromWindow", "MoveWindow", "OpenClipboard", "PeekMessageA",
  "PeekMessageW", "PostMessageA", "PostMessageW", "PostQuitMessage", "PtInRect", "RedrawWindow", "RegisterClassA",
  "RegisterClassExA", "RegisterClassExW", "RegisterClassW", "RegisterHotKey", "RegisterWindowMessageW",
  "ReleaseCapture", "ReleaseDC", "RemoveMenu", "ScreenToClient", "SendInput", "SendMessageA", "SendMessageW",
  "SetActiveWindow", "SetCapture", "SetClipboardData", "SetCursor", "SetCursorPos", "SetDlgItemTextW", "SetFocus",
  "SetForegroundWindow", "SetMenu", "SetParent", "SetTimer", "SetWindowLongPtrA", "SetWindowLongPtrW",
  "SetWindowPos", "SetWindowTextA", "SetWindowTextW", "SetWindowsHookExA", "SetWindowsHookExW", "ShowCursor",
  "ShowWindow", "SystemParametersInfoW", "TrackPopupMenu", "TranslateAcceleratorW", "TranslateMessage",
  "UnhookWindowsHookEx", "UnregisterClassW", "UpdateWindow", "WaitForInputIdle", "WindowFromPoint", "wsprintfA",
  "wsprintfW",
];

/** The export side of user32.dll, with MessageBoxA where the recordings put it (base + 0x28F10). */
export function user32(): PeFile {
  const fixed: Record<string, number> = { MessageBoxA: 0x28f10, MessageBoxW: 0x29b20 };
  const names: [string, number][] = USER32_EXPORTS.map((n, i) => [n, fixed[n] ?? 0x1000 + ((i * 0x5a3 + n.length * 0x91) % 0x86000 & ~0xf)]);
  return buildPe({
    id: "user32",
    name: "user32.dll",
    bits: 64,
    imageBase: 0x180000000n,
    entry: 0x1d250,
    subsystem: 2,
    dllChars: 0x4160,
    timestamp: 0x8a2f61c4,
    dll: true,
    sections: [
      { name: ".text", va: 0x1000, bytes: code(0x400, 51, 64), vsize: 0x88000, chars: 0x60000020 },
      { name: ".rdata", va: 0x89000, bytes: [], vsize: 0x2000, chars: 0x40000040 },
      { name: ".data", va: 0x8b000, bytes: [1, 0, 0, 0], vsize: 0x1000, chars: 0xc0000040 },
    ],
    exports: { at: 0x89000, dllName: "USER32.dll", names },
  });
}

