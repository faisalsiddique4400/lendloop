const encoder = new TextEncoder();

function importKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sign(secret: string, body: string) {
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(body));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verify(secret: string, body: string, signature: string | null) {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const bytes = new Uint8Array(signature.match(/../g)!.map((pair) => parseInt(pair, 16)));
  return crypto.subtle.verify("HMAC", await importKey(secret), bytes, encoder.encode(body));
}
