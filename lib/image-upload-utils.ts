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

export async function uploadInvoiceToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

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
