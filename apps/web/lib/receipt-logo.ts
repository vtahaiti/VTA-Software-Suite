export function isEmbeddedLogo(value?: string | null): value is string {
  return Boolean(value && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value));
}
