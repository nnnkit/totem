import { makeZip } from "client-zip";

export interface StreamZipEntry {
  name: string;
  input: Uint8Array | ReadableStream<Uint8Array>;
  lastModified?: Date;
}

export type StreamZipEntrySource =
  | Iterable<StreamZipEntry>
  | AsyncIterable<StreamZipEntry>;

export interface StreamJsonlZipEntry<T> {
  name: string;
  rows: AsyncIterable<T> | Iterable<T>;
  lastModified?: Date;
}

export interface StreamJsonlZipOptions {
  /**
   * Called once per row before it is serialized. The default is `JSON.stringify`,
   * which matches the JSONL contract in the export PRD.
   */
  serialize?: (row: unknown) => string;
}

const DEFAULT_SERIALIZE = (row: unknown): string => JSON.stringify(row);

function jsonlReadableStream<T>(
  rows: AsyncIterable<T> | Iterable<T>,
  serialize: (row: unknown) => string,
): ReadableStream<Uint8Array> {
  const iterator =
    Symbol.asyncIterator in rows
      ? (rows as AsyncIterable<T>)[Symbol.asyncIterator]()
      : asAsyncIterator((rows as Iterable<T>)[Symbol.iterator]());
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`${serialize(value)}\n`));
    },
    async cancel(reason) {
      if (typeof iterator.return === "function") {
        await iterator.return(reason);
      }
    },
  });
}

function asAsyncIterator<T>(iter: Iterator<T>): AsyncIterator<T> {
  return {
    next: async () => iter.next(),
    return: iter.return ? async (v) => iter.return!(v) : undefined,
  };
}

/**
 * Stream one or more JSONL files inside a single ZIP to a `WritableStream`.
 *
 * The pipeline is back-pressured end-to-end: each entry's rows are pulled
 * one at a time from the source iterable as the destination consumes ZIP
 * bytes. Peak memory stays bounded when the caller's entry streams do not
 * retain previously emitted chunks.
 */
export async function streamJsonlZip<T>(
  entries: ReadonlyArray<StreamJsonlZipEntry<T>>,
  destination: WritableStream<Uint8Array>,
  options: StreamJsonlZipOptions = {},
): Promise<void> {
  const serialize = options.serialize ?? DEFAULT_SERIALIZE;
  const inputs = entries.map((entry) => ({
    name: entry.name,
    lastModified: entry.lastModified,
    input: jsonlReadableStream(entry.rows, serialize),
  }));
  await streamZipEntries(inputs, destination);
}

export function makeZipEntriesStream(
  entries: StreamZipEntrySource,
): ReadableStream<Uint8Array> {
  return makeZip(entries);
}

export async function streamZipEntries(
  entries: StreamZipEntrySource,
  destination: WritableStream<Uint8Array>,
): Promise<void> {
  await makeZipEntriesStream(entries).pipeTo(destination);
}
