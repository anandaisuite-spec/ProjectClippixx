/**
 * Client-side upload guards.
 *
 * Uploads in this app go directly from the browser to Firebase Storage (there is
 * no backend file route), so validation has to happen here before uploadBytes.
 * These checks stop the common attack surface: wrong file types (incl. an .exe
 * renamed to .jpg — the browser's File.type reflects sniffed content, not the
 * extension), oversized files, and path-traversal/clobbering via the original
 * filename (we never reuse it — every upload gets a random name).
 *
 * NOTE: a true malware scan needs a scanning engine (ClamAV / VirusTotal) and is
 * intentionally out of scope here — that's separate infrastructure.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate a File against an allow-list of MIME types and the size cap.
 * Throws an Error with a user-facing message on failure.
 */
export function validateUpload(
  file: File,
  allowedTypes: string[] = ALLOWED_IMAGE_TYPES
): void {
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Unsupported file type. Please upload a valid image.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
}

/**
 * Build a safe, collision-resistant storage filename. The original name is never
 * trusted or stored — only its lowercased extension is carried over, and only if
 * it matches a known-safe set.
 */
export function safeFilename(originalName: string, prefix = ''): string {
  const rawExt = originalName.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase()
    : '';
  const SAFE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = SAFE_EXTS.includes(rawExt) ? rawExt : '';
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${prefix}${id}${ext}`;
}
