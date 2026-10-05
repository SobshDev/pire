// Writes api/tutor/lessons.json, the lesson text the AI tutor sees. Run: bun run export:tutor
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tutorLessonsJson } from "../src/tutor";

const out = join(import.meta.dir, "../../api/tutor/lessons.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, tutorLessonsJson());
console.log("wrote " + out);
