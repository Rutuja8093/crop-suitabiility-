/**
 * Reads a File object containing KML data and returns its raw text string.
 */
export async function readKmlFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  // Fallback for older browser environments
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    reader.readAsText(file);
  });
}
