/**
 * Generates a random string for the PKCE code verifier.
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

/**
 * Encodes a buffer to Base64URL string.
 */
function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a SHA-256 challenge from the verifier.
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Prepares the PKCE parameters and stores the verifier in sessionStorage.
 */
export async function preparePKCE(): Promise<string> {
  const verifier = generateRandomString(96);
  sessionStorage.setItem('dropbox_code_verifier', verifier);
  return await generateCodeChallenge(verifier);
}

/**
 * Retrieves the stored verifier.
 */
export function getStoredVerifier(): string | null {
  return sessionStorage.getItem('dropbox_code_verifier');
}

/**
 * Clears the stored verifier.
 */
export function clearStoredVerifier(): void {
  sessionStorage.removeItem('dropbox_code_verifier');
}
