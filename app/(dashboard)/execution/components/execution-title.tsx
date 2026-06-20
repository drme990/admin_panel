'use client';

import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/button';

interface Props {
    date: string;
    locale: string;
    onPrevDay: () => void;
    onNextDay: () => void;
}

function toIsoDateInput(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getRelativeIsoDate(daysOffset: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysOffset);
    return toIsoDateInput(d);
}

export default function ExecutionTitle({ date, locale, onPrevDay, onNextDay }: Props) {
    const t = useTranslations('execution');

    const todayStr = getRelativeIsoDate(0);
    const tomorrowStr = getRelativeIsoDate(1);
    const yesterdayStr = getRelativeIsoDate(-1);

    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'long',
    });

    const [year, month, day] = date.split('-');
    const formattedDate = `${Number(day)}-${Number(month)}-${year}`;

    let relativeLabel: string | null = null;
    if (date === todayStr) relativeLabel = t('header.today');
    else if (date === tomorrowStr) relativeLabel = t('header.tomorrow');
    else if (date === yesterdayStr) relativeLabel = t('header.yesterday');

    return (
        <div className="flex items-center justify-center gap-3">
            <Button
                type="button"
                variant="ghost"
                size="custom"
                onClick={onPrevDay}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stroke hover:bg-background transition-colors"
                aria-label={t('header.prevDay')}
            >
                <LuChevronLeft
                    size={18}
                    className={locale === 'ar' ? 'rotate-180' : undefined}
                />
            </Button>

            <h2 className="text-lg font-semibold text-foreground rounded-site border border-stroke p-2">
                {relativeLabel ? (
                    <>
                        <span className="text-success">
                            {t('header.executions')} {relativeLabel}:
                        </span>
                        {' '}{dayName} - {formattedDate}
                    </>
                ) : (
                    <>
                        {t('header.executions')} {dayName} - {formattedDate}
                    </>
                )}
            </h2>

            <Button
                type="button"
                variant="ghost"
                size="custom"
                onClick={onNextDay}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stroke hover:bg-background transition-colors"
                aria-label={t('header.nextDay')}
            >
                <LuChevronRight
                    size={18}
                    className={locale === 'ar' ? 'rotate-180' : undefined}
                />
            </Button>
        </div>
    );
}
