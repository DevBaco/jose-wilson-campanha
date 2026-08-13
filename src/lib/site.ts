export const SITE_URL = 'https://wilsoncampos.com.br';
export const WHATSAPP_PHONE = '5531999637470';
export const WHATSAPP_MESSAGE = 'Olá, quero apoiar a campanha do Wilson Campos.';
export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
export const INSTAGRAM_HREF = 'https://www.instagram.com/wilsoncampos2026';
export const TIKTOK_HREF = 'https://www.tiktok.com/@campos3507';
export const EMAIL = 'jwilson.campos@gmail.com';
export const PHONE_DISPLAY = '(31) 99963-7470';

export function absoluteUrl(path: string, base: string | URL = SITE_URL): string {
  const resolved = new URL(path, base);
  return `${SITE_URL}${resolved.pathname}${resolved.search}${resolved.hash}`;
}
