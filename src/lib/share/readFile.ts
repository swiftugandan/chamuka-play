/** A file's text. Uses Blob.text() where it exists and FileReader elsewhere
 *  (older Safari has no Blob.text()). */
export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsText(file);
  });
}
