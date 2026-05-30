import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openDB, type IDBPDatabase } from "idb";
import { unzipSync, strFromU8 } from "fflate";
import { streamJsonlZip } from "../stream-zip";

interface SyntheticBookmark {
  id: string;
  tweetId: string;
  text: string;
  createdAt: number;
}

async function populate(rowCount: number): Promise<IDBPDatabase> {
  const dbName = `stream-zip-spike-${rowCount}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const db = await openDB(dbName, 1, {
    upgrade(database) {
      database.createObjectStore("bookmarks", { keyPath: "id" });
    },
  });
  const tx = db.transaction("bookmarks", "readwrite");
  for (let i = 0; i < rowCount; i += 1) {
    const row: SyntheticBookmark = {
      id: `row-${i.toString().padStart(6, "0")}`,
      tweetId: `${1_000_000_000_000 + i}`,
      text: `synthetic bookmark body for row ${i} — lorem ipsum dolor sit amet`,
      createdAt: 1_700_000_000_000 + i,
    };
    tx.store.put(row);
  }
  await tx.done;
  return db;
}

interface InFlightTracker {
  iterable: AsyncIterable<SyntheticBookmark>;
  peakInFlight: number;
}

function trackedCursor(db: IDBPDatabase): InFlightTracker {
  const tracker: InFlightTracker = {
    peakInFlight: 0,
    iterable: {
      [Symbol.asyncIterator](): AsyncIterator<SyntheticBookmark> {
        let inFlight = 0;
        let cursorPromise = db
          .transaction("bookmarks", "readonly")
          .store.openCursor();
        return {
          async next() {
            const cursor = await cursorPromise;
            if (!cursor) return { value: undefined, done: true };
            const value = cursor.value as SyntheticBookmark;
            inFlight += 1;
            if (inFlight > tracker.peakInFlight) {
              tracker.peakInFlight = inFlight;
            }
            cursorPromise = cursor.continue();
            // Row is considered consumed once the next `next()` is invoked,
            // which is exactly when the pipeline pulls another value — so the
            // in-flight count drops back to 0 before the next increment.
            inFlight -= 1;
            return { value, done: false };
          },
        };
      },
    },
  };
  return tracker;
}

function collectingSink(): {
  stream: WritableStream<Uint8Array>;
  bytes: () => Uint8Array;
} {
  const chunks: Uint8Array[] = [];
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  return {
    stream,
    bytes() {
      let total = 0;
      for (const c of chunks) total += c.byteLength;
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return out;
    },
  };
}

describe("streamJsonlZip", () => {
  it("streams 10k IDB rows into a ZIP without buffering the whole library", async () => {
    const ROW_COUNT = 10_000;
    const db = await populate(ROW_COUNT);
    const tracker = trackedCursor(db);
    const sink = collectingSink();

    await streamJsonlZip(
      [{ name: "data/bookmarks.jsonl", rows: tracker.iterable }],
      sink.stream,
    );

    const zipBytes = sink.bytes();
    expect(zipBytes.byteLength).toBeGreaterThan(0);

    const unzipped = unzipSync(zipBytes);
    const entries = Object.keys(unzipped);
    expect(entries).toEqual(["data/bookmarks.jsonl"]);

    const jsonl = strFromU8(unzipped["data/bookmarks.jsonl"]);
    const lines = jsonl.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(ROW_COUNT);

    const first = JSON.parse(lines[0]) as SyntheticBookmark;
    expect(first.id).toBe("row-000000");
    const last = JSON.parse(lines[ROW_COUNT - 1]) as SyntheticBookmark;
    expect(last.id).toBe(`row-${(ROW_COUNT - 1).toString().padStart(6, "0")}`);

    // The whole point of the spike: at any moment the cursor adapter only
    // ever has one row materialized between yield and consumption.
    expect(tracker.peakInFlight).toBeLessThanOrEqual(1);

    db.close();
  });

  it("emits a valid empty ZIP entry when the source iterable is empty", async () => {
    const sink = collectingSink();
    async function* empty(): AsyncIterable<SyntheticBookmark> {
      // no rows
    }
    await streamJsonlZip(
      [{ name: "data/bookmarks.jsonl", rows: empty() }],
      sink.stream,
    );
    const unzipped = unzipSync(sink.bytes());
    expect(Object.keys(unzipped)).toEqual(["data/bookmarks.jsonl"]);
    expect(unzipped["data/bookmarks.jsonl"].byteLength).toBe(0);
  });
});
