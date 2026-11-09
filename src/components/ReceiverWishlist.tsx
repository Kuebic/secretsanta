import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWishlist } from '../api/events';
import { openWishlist, Wishlist, wishlistLinkHref } from '../utils/wishlist';

interface ReceiverWishlistProps {
  eventId: string;
  eventKey: string;
  receiverId: string;
  receiverName: string;
  organizersNote?: string;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; wishlist: Wishlist | null; updatedAt?: string };

// What the giver sees under their receiver's name: the receiver's current
// wishlist, fetched fresh on every visit, and the organizer's note about them.
export function ReceiverWishlist({ eventId, eventKey, receiverId, receiverName, organizersNote }: ReceiverWishlistProps) {
  const { t, i18n } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await fetchWishlist(eventId, receiverId);
        const wishlist = stored ? await openWishlist(eventKey, stored.wishlist) : null;
        if (!cancelled) setLoad({ kind: 'ready', wishlist, updatedAt: stored?.wishlistUpdatedAt });
      } catch (error) {
        console.error('Failed to load the receiver\'s wishlist:', error);
        if (!cancelled) setLoad({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, eventKey, receiverId]);

  const isEmpty = (wishlist: Wishlist | null) => !wishlist || (wishlist.items.length === 0 && !wishlist.notes);

  return (
    <div className="space-y-4">
      <section className="p-4 bg-gray-50 rounded-lg space-y-3" aria-labelledby="receiver-wishlist-title">
        <h2 id="receiver-wishlist-title" className="text-sm font-medium text-gray-700">{t('wishlist.receiverTitle')}</h2>
        {load.kind === 'loading' && <p className="text-gray-600">{t('participant.loading')}</p>}
        {load.kind === 'error' && <p className="text-gray-700">{t('wishlist.receiverLoadError')}</p>}
        {load.kind === 'ready' && isEmpty(load.wishlist) && (
          <p className="text-gray-600">{t('wishlist.receiverEmpty', { name: receiverName })}</p>
        )}
        {load.kind === 'ready' && load.wishlist && !isEmpty(load.wishlist) && (
          <>
            {load.wishlist.items.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {load.wishlist.items.map((item, index) => {
                  const href = wishlistLinkHref(item.url);
                  return (
                    <li key={index} className="text-gray-800 break-words">
                      {item.text}
                      {href && (
                        <>
                          {item.text && ' '}
                          {/* A plain link: no previews or fetches, and the page it opens learns nothing about this one. */}
                          <a href={href} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="text-red-700 underline break-all">
                            {item.url.trim()}
                          </a>
                        </>
                      )}
                      {!href && item.url.trim() && <span className="text-gray-600 break-all"> {item.url.trim()}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {load.wishlist.notes && (
              <p className="text-gray-700 whitespace-pre-wrap break-words">{load.wishlist.notes}</p>
            )}
            {load.updatedAt && (
              <p className="text-xs text-gray-500">
                {t('wishlist.updatedOn', { date: new Date(load.updatedAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) })}
              </p>
            )}
          </>
        )}
      </section>
      {organizersNote && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-1">{t('participant.organizersNote')}</h2>
          <p className="text-gray-700 whitespace-pre-wrap break-words">{organizersNote}</p>
        </div>
      )}
    </div>
  );
}
