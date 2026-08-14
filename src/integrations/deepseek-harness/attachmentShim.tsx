export type AttachmentRailItem = { id: string; previewUrl?: string; [key: string]: unknown };

export function AttachmentRail<T extends AttachmentRailItem>({ items, onOpen, onRemove }: {
  items: T[];
  labels?: unknown;
  onOpen: (item: T) => void;
  onRemove: (item: T) => void;
}) {
  return <div className="opl-dsh-attachment-rail">{items.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)} onContextMenu={(event) => { event.preventDefault(); onRemove(item); }}>{item.id}</button>)}</div>;
}

export function DropOverlay({ labels }: { labels?: { title?: string }; disabled?: boolean }) {
  return <div className="opl-dsh-drop-overlay">{labels?.title ?? "Drop files"}</div>;
}

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; labels?: unknown; onClose: () => void }) {
  return <button type="button" className="opl-dsh-lightbox" aria-label={alt} onClick={onClose}><img src={src} alt={alt} /></button>;
}

export type AttachmentRailLabels = Record<string, string>;
export type DropOverlayLabels = Record<string, string>;
export type ImageLightboxLabels = Record<string, string>;
