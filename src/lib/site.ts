export const SITE_URL = 'https://wilsoncamposoficial.com.br';
export const WHATSAPP_PHONE = '5531999637470';
export const WHATSAPP_MESSAGE = 'Olá, quero apoiar a campanha do Wilson Campos.';
export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
export const INSTAGRAM_HREF = 'https://www.instagram.com/wilsoncampos2026';
export const TIKTOK_HREF = 'https://www.tiktok.com/@campos3507';
export const FACEBOOK_HREF = 'https://www.facebook.com/share/1LMSnNVq8t/';
export const EMAIL = 'contato@wilsoncamposoficial.com.br';
export const PHONE_DISPLAY = '(31) 99963-7470';
/* Endpoint do formulário de apoio, servido pelo WordPress (mu-plugin apoios.php) */
export const FORM_ENDPOINT = 'https://blog.wilsoncamposoficial.com.br/wp-json/wilson/v1/apoio';
/* Site key do Turnstile: é pública, entra no HTML. A secret fica no
   wp-config.php do WordPress. Vazia = antispam segue com honeypot e limite
   por IP, e o widget não é carregado. */
export const TURNSTILE_SITE_KEY = '';

export const PRIVACY_PATH = '/politica-de-privacidade';
/* atualize esta data sempre que o texto da política mudar */
export const PRIVACY_UPDATED_AT = '2026-08-19';

export function absoluteUrl(path: string, base: string | URL = SITE_URL): string {
  /* imagem hospedada fora (ex.: a capa vinda do WordPress) já é absoluta:
     reescrever para SITE_URL geraria uma og:image quebrada */
  if (/^https?:\/\//i.test(path)) return path;

  const resolved = new URL(path, base);
  return `${SITE_URL}${resolved.pathname}${resolved.search}${resolved.hash}`;
}
