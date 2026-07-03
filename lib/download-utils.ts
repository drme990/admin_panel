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
