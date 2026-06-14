'use client';

import { useState } from 'react';
import { FAQ } from '@/types/Appearance';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dropdown from '@/components/ui/dropdown';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

import { LuPlus, LuTrash2, LuChevronUp, LuChevronDown } from 'react-icons/lu';

type FAQPlatform = 'ghadaq' | 'manasik' | 'shared';

const PLATFORM_OPTIONS: Array<{ value: FAQPlatform; label: string }> = [
  { value: 'shared', label: 'Shared' },
  { value: 'ghadaq', label: 'Ghadaq' },
  { value: 'manasik', label: 'Manasik' },
];

const PLATFORM_BADGE_COLORS: Record<FAQPlatform, string> = {
  shared: 'bg-secondary/15 text-secondary',
  ghadaq: 'bg-blue-500/10 text-blue-500',
  manasik: 'bg-emerald-500/10 text-emerald-500',
};

interface FAQControlSectionProps {
  faqs: FAQ[];
  onChange: (faqs: FAQ[]) => void;
  title: string;
  description: string;
  questionLabelAr: string;
  questionLabelEn: string;
  answerLabelAr: string;
  answerLabelEn: string;
  platformLabel: string;
  showOnProductDetailsLabel: string;
  addLabel: string;
  deleteLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  emptyText: string;
}

export default function FAQControlSection({
  faqs,
  onChange,
  title,
  description,
  questionLabelAr,
  questionLabelEn,
  answerLabelAr,
  answerLabelEn,
  platformLabel,
  showOnProductDetailsLabel,
  addLabel,
  deleteLabel,
  moveUpLabel,
  moveDownLabel,
  emptyText,
}: FAQControlSectionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addFAQ = () => {
    const newFAQ: FAQ = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      question: { ar: '', en: '' },
      answer: { ar: '', en: '' },
      platform: 'shared',
      showOnProductDetails: false,
    };
    onChange([...faqs, newFAQ]);
    setExpandedItems((prev) => new Set(prev).add(newFAQ.id));
  };

  const updateFAQ = (id: string, updates: Partial<FAQ>) => {
    onChange(faqs.map((faq) => (faq.id === id ? { ...faq, ...updates } : faq)));
  };

  const deleteFAQ = (id: string) => {
    onChange(faqs.filter((faq) => faq.id !== id));
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const moveFAQ = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= faqs.length) return;

    const newFAQs = [...faqs];
    const [moved] = newFAQs.splice(index, 1);
    newFAQs.splice(newIndex, 0, moved);
    onChange(newFAQs);
  };

  return (
    <section className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-secondary">{description}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={addFAQ}
          size="sm"
          className="flex items-center gap-2 shrink-0"
        >
          <LuPlus size={16} />
          {addLabel}
        </Button>
      </div>

      {faqs.length === 0 ? (
        <p className="text-sm text-secondary py-4 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-3 max-h-150 overflow-y-scroll">
          {faqs.map((faq, index) => {
            const platform = (faq.platform ?? 'shared') as FAQPlatform;
            const platformOption = PLATFORM_OPTIONS.find(
              (o) => o.value === platform,
            );
            const badgeColor = PLATFORM_BADGE_COLORS[platform];

            return (
              <div
                key={faq.id}
                className="border border-stroke rounded-lg bg-background overflow-hidden"
              >
                {/* Item Header */}
                <div className="flex items-center justify-between p-3 bg-muted/30">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(faq.id)}
                      className="p-1 hover:bg-muted rounded transition-colors shrink-0"
                      aria-label={
                        expandedItems.has(faq.id) ? 'Collapse' : 'Expand'
                      }
                    >
                      {expandedItems.has(faq.id) ? (
                        <LuChevronUp size={18} className="text-foreground" />
                      ) : (
                        <LuChevronDown size={18} className="text-foreground" />
                      )}
                    </button>

                    <span className="text-sm font-medium text-foreground truncate">
                      {faq.question.ar || faq.question.en || `FAQ ${index + 1}`}
                    </span>

                    {/* Platform badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${badgeColor}`}
                    >
                      {platformOption?.label ?? platform}
                    </span>

                    {faq.showOnProductDetails && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded shrink-0">
                        Product Details
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="custom"
                      className="p-1.5 hover:bg-muted rounded transition-colors"
                      onClick={() => moveFAQ(index, 'up')}
                      disabled={index === 0}
                      title={moveUpLabel}
                    >
                      <LuChevronUp size={16} className="text-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="custom"
                      className="p-1.5 hover:bg-muted rounded transition-colors"
                      onClick={() => moveFAQ(index, 'down')}
                      disabled={index === faqs.length - 1}
                      title={moveDownLabel}
                    >
                      <LuChevronDown size={16} className="text-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="custom"
                      className="p-1.5 hover:bg-error/10 hover:text-error rounded transition-colors"
                      onClick={() => deleteFAQ(faq.id)}
                      title={deleteLabel}
                    >
                      <LuTrash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Expanded content */}
                {expandedItems.has(faq.id) && (
                  <div className="p-4 space-y-4 border-t border-stroke">
                    {/* Questions */}
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="text"
                        value={faq.question.ar}
                        onChange={(e) =>
                          updateFAQ(faq.id, {
                            question: { ...faq.question, ar: e.target.value },
                          })
                        }
                        placeholder="السؤال بالعربية"
                        dir="rtl"
                        label={questionLabelAr}
                      />
                      <Input
                        type="text"
                        value={faq.question.en}
                        onChange={(e) =>
                          updateFAQ(faq.id, {
                            question: { ...faq.question, en: e.target.value },
                          })
                        }
                        placeholder="Question in English"
                        label={questionLabelEn}
                      />
                    </div>

                    {/* Answers */}
                    <div className="grid grid-cols-2 gap-4">
                      <Textarea
                        value={faq.answer.ar}
                        onChange={(newValue) =>
                          updateFAQ(faq.id, {
                            answer: { ...faq.answer, ar: newValue },
                          })
                        }
                        placeholder="الإجابة بالعربية"
                        label={answerLabelAr}
                        rows={3}
                      />
                      <Textarea
                        value={faq.answer.en}
                        onChange={(newValue) =>
                          updateFAQ(faq.id, {
                            answer: { ...faq.answer, en: newValue },
                          })
                        }
                        placeholder="Answer in English"
                        label={answerLabelEn}
                        rows={3}
                      />
                    </div>

                    <div className='h-52'>
                      {/* Platform Dropdown */}
                      <Dropdown<FAQPlatform>
                        label={platformLabel}
                        value={platform}
                        options={PLATFORM_OPTIONS}
                        onChange={(newPlatform) =>
                          updateFAQ(faq.id, { platform: newPlatform })
                        }
                      />
                    </div>

                    {/* Show on product details checkbox */}
                    <Checkbox
                      label={showOnProductDetailsLabel}
                      checked={faq.showOnProductDetails}
                      onChange={(checked) =>
                        updateFAQ(faq.id, { showOnProductDetails: checked })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
