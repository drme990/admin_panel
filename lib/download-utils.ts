export async function downloadFile(url: string, filename: string): Promise<void> {
    const proxyUrl = `/api/download/file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const response = await fetch(proxyUrl, { credentials: 'include' });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to download: ${response.status}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}

export interface DesignDownloadItem {
    url: string;
    filename: string;
}

/** Sanitize + build a filename for a design image inside a zip or a single download */
export function buildDesignFilename(orderNumber: string, productLabel: string, itemIndex: number): string {
    const base = `${orderNumber}${productLabel ? `-${productLabel}` : ''}${itemIndex > 1 ? `-${itemIndex}` : ''}`;
    const safe = base.replace(/[^a-zA-Z0-9-_. \u0600-\u06FF]/g, '_').trim() || 'design';
    return `${safe}.jpg`;
}

/** Download each item as a separate file via the proxy */
export async function downloadItemsIndividually(items: DesignDownloadItem[]): Promise<void> {
    for (const item of items) {
        await downloadFile(item.url, item.filename);
    }
}

/** Bundle items into a single ZIP on the backend and save it locally */
export async function downloadItemsAsZip(items: DesignDownloadItem[], zipBaseName = 'order-designs'): Promise<void> {
    const res = await fetch('/api/order-designs/download-zip', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const dateTime = new Date().toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${zipBaseName}-${dateTime}.zip`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}
