let rendererBaseUrl: string | undefined;

export function setRendererBaseUrl(url: string | undefined): void {
  rendererBaseUrl = url;
}

export function getRendererBaseUrl(): string | undefined {
  return rendererBaseUrl;
}