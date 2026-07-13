import { mkdir, readFile, rename, writeFile, appendFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const appDataDirectory = process.env.OPL_NATIVE_WORKBENCH_DATA_DIR
  ?? (process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "One Person Lab")
    : path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "one-person-lab"));
const defaultPath = path.join(appDataDirectory, "coordination-ledger.jsonl");

export class CoordinationLedger {
  constructor({ filePath = process.env.OPL_COORDINATION_LEDGER ?? defaultPath, maxEntries = 2_000 } = {}) {
    this.filePath = filePath;
    this.maxEntries = maxEntries;
    this.entries = [];
    this.writeChain = Promise.resolve();
  }

  async load() {
    let source = "";
    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    this.entries = source.split("\n").filter(Boolean).flatMap((line) => {
      try {
        const entry = JSON.parse(line);
        return entry && typeof entry === "object" ? [entry] : [];
      } catch {
        return [];
      }
    }).slice(-this.maxEntries);
    return this.entries;
  }

  async append(entry) {
    const record = { ledgerVersion: 1, recordedAt: new Date().toISOString(), ...entry };
    this.entries.push(record);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      if (this.entries.length > this.maxEntries) await this.#compact();
    });
    await this.writeChain;
    return record;
  }

  async #compact() {
    this.entries = this.entries.slice(-this.maxEntries);
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    const body = this.entries.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFile(temporaryPath, `${body}${body ? "\n" : ""}`, { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  latestBy(kind, key, value) {
    return [...this.entries].reverse().find((entry) => entry.kind === kind && entry[key] === value);
  }
}
