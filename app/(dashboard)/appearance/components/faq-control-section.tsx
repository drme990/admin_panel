'use client';

import { useState } from 'react';
import { FAQ } from '@/types/Appearance';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

import { LuPlus, LuTrash2, LuChevronUp, LuChevronDown } from 'react-icons/lu';

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
          className="flex items-center gap-2"
        >
          <LuPlus size={16} />
          {addLabel}
        </Button>
      </div>

      {faqs.length === 0 ? (
        <p className="text-sm text-secondary py-4 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-3 max-h-150 overflow-y-scroll">
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className="border border-stroke rounded-lg bg-background overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 bg-muted/30">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(faq.id)}
                    className="p-1 hover:bg-muted rounded transition-colors"
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
                  {faq.showOnProductDetails && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Product Details
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
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

              {expandedItems.has(faq.id) && (
                <div className="p-4 space-y-4 border-t border-stroke">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Input
                        type="text"
                        value={faq.question.ar}
                        onChange={(e) =>
                          updateFAQ(faq.id, {
                            question: { ...faq.question, ar: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-stroke rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="السؤال بالعربية"
                        dir="rtl"
                        label={questionLabelAr}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        type="text"
                        value={faq.question.en}
                        onChange={(e) =>
                          updateFAQ(faq.id, {
                            question: { ...faq.question, en: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-stroke rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Question in English"
                        label={questionLabelEn}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Textarea
                      value={faq.answer.ar}
                      onChange={(value) =>
                        updateFAQ(faq.id, {
                          answer: { ...faq.answer, ar: value },
                        })
                      }
                      placeholder="الإجابة بالعربية"
                      label={answerLabelAr}
                      rows={3}
                    />
                    <Textarea
                      value={faq.answer.en}
                      onChange={(value) =>
                        updateFAQ(faq.id, {
                          answer: { ...faq.answer, en: value },
                        })
                      }
                      placeholder="Answer in English"
                      label={answerLabelEn}
                      rows={3}
                    />
                  </div>

                 <select
                    value={faq.platform}
                    onChange={(e) =>
                      updateFAQ(faq.id, {
                        platform: e.target.value as 'ghadaq' | 'manasik' | 'shared',
                      })
                    }
                    className="w-full px-3 py-2 border border-stroke rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                      <option value="shared">Shared</option>
                      <option value="ghadaq">Ghadaq</option>
                      <option value="manasik">Manasik</option>
                  </select>

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
          ))}
        </div>
      )}
    </section>
  );
}
