'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useCallback } from 'react';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

/**
 * Clean Quill HTML output:
 * - Replace &nbsp; with normal spaces (prevents non-breaking space wrapping issues)
 */
function cleanQuillHtml(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
}

interface RichTextEditorProps {
  label?: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
}

export default function RichTextEditor({
  label,
  helperText,
  value,
  onChange,
  placeholder,
  dir = 'rtl',
}: RichTextEditorProps) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef(value);

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ['link'],
        ['clean'],
      ],
    }),
    [],
  );

  const formats = useMemo(
    () => [
      'header',
      'bold',
      'italic',
      'underline',
      'strike',
      'list',
      'color',
      'background',
      'align',
      'link',
    ],
    [],
  );

  // Debounced onChange: cleans HTML & batches rapid changes (e.g. paste)
  const handleChange = useCallback(
    (newValue: string) => {
      latestValue.current = newValue;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        const cleaned = cleanQuillHtml(latestValue.current);
        onChange(cleaned);
      }, 300);
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {helperText && <p className="text-xs text-secondary">{helperText}</p>}
      <div className="quill-wrapper" dir={dir}>
        <ReactQuill
          theme="snow"
          defaultValue={value}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
