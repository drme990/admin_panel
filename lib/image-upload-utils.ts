export async function uploadImageToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'customers');

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.data?.url) {
    throw new Error(data.error || 'Failed to upload image to R2');
  }
  return data.data.url as string;
}

export async function deleteOldImage(url: string): Promise<void> {
  if (!url || url.startsWith('data:')) return;
  const res = await fetch(`/api/upload/image?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete old image');
  }
}

/**
 * Upload an invoice file to R2. When `oldUrl` is provided, the previous
 * invoice file is deleted from R2 after the new upload succeeds — this
 * prevents orphaned files from accumulating when invoices are replaced.
 */
export async function uploadInvoiceToR2(file: File, oldUrl?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  if (oldUrl) {
    formData.append('oldUrl', oldUrl);
  }

  const res = await fetch('/api/upload/invoice', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.data?.url) {
    throw new Error(data.error || 'Failed to upload invoice to R2');
  }
  return data.data.url as string;
}

/**
 * Delete an invoice file from R2 by its public URL.
 *
 * Uses the invoice upload route's DELETE endpoint (which requires
 * suppliers/execution/orders access) rather than the image DELETE
 * endpoint (which requires 'appearance' access) — invoice managers
 * may not have appearance permissions.
 */
export async function deleteInvoiceFromR2(url: string): Promise<void> {
  if (!url || url.startsWith('data:')) return;
  const res = await fetch('/api/upload/invoice', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete invoice file');
  }
}
