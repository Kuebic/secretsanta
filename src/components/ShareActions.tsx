import { ShareNetwork } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from './CopyButton';

interface ShareActionsProps {
  name: string;
  link: string;
  eventTitle: string;
}

const buttonClass = 'flex-1 p-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2 text-sm';

// Detected once: the Web Share API does not appear or disappear at runtime.
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export function ShareActions({ name, link, eventTitle }: ShareActionsProps) {
  const { t } = useTranslation();

  const message = eventTitle
    ? t('share.message', { name, title: eventTitle, link })
    : t('share.messageUntitled', { name, link });

  const handleShare = async () => {
    try {
      await navigator.share({ title: eventTitle || t('events.untitled'), url: link });
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError; nothing to report.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Failed to share:', error);
      }
    }
  };

  return (
    <div className="space-y-1">
      <p className="font-medium text-gray-800 break-words">{name}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton textToCopy={link} className={buttonClass}>
          {t('share.copyLink')}
        </CopyButton>
        <CopyButton textToCopy={message} className={buttonClass}>
          {t('share.copyMessage')}
        </CopyButton>
        {canShare && (
          <button type="button" onClick={handleShare} className={buttonClass}>
            <ShareNetwork size={20} weight="bold" />
            {t('share.share')}
          </button>
        )}
      </div>
    </div>
  );
}
