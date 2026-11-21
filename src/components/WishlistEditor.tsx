import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { deleteWishlist, fetchWishlist, saveWishlist } from '../api/events';
import { ParticipantCredentials } from '../utils/linkCodec';
import { cleanWishlist, EMPTY_WISHLIST, isFilledIn, openWishlist, sealWishlist, Wishlist, wishlistCharactersLeft } from '../utils/wishlist';

interface WishlistEditorProps {
  credentials: ParticipantCredentials;
}

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready' };
type Save = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Typing saves after this much quiet; leaving a field, changing the list's
// shape or hiding the page saves at once. Each save is a KV write, so the
// delay is longer than the organizer's.
const SAVE_DELAY_MS = 2000;

// A participant's own wishlist: items with an optional link, plus notes.
// Sealed with the event key in the browser and saved with the participant
// token as it is edited; the server only sees ciphertext and when it changed.
export function WishlistEditor({ credentials }: WishlistEditorProps) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [wishlist, setWishlist] = useState<Wishlist>(EMPTY_WISHLIST);
  // Stable React keys for items, parallel to wishlist.items, so reordering
  // does not move focus or text between inputs.
  const [itemKeys, setItemKeys] = useState<number[]>([]);
  const nextKey = useRef(0);
  const [save, setSave] = useState<Save>('idle');

  // The newest edit, readable from timers and page events. A save only acts
  // when no newer edit has come in since it was asked for.
  const latest = useRef<Wishlist>(EMPTY_WISHLIST);
  const revision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Whether the server holds a wishlist, so an emptied one is deleted rather
  // than never written.
  const serverHasWishlist = useRef(false);
  // The revision last handed to the queue, so a blur right after the timer
  // fired does not write the same wishlist twice.
  const queuedRevision = useRef(-1);
  const saveState = useRef<Save>('idle');
  saveState.current = save;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await fetchWishlist(credentials.eventId, credentials.participantId);
        const opened = found ? await openWishlist(credentials.eventKey, found.wishlist) : EMPTY_WISHLIST;
        if (cancelled) return;
        serverHasWishlist.current = found !== null;
        latest.current = opened;
        setWishlist(opened);
        setItemKeys(opened.items.map(() => nextKey.current++));
        setLoad({ kind: 'ready' });
      } catch (error) {
        console.error('Failed to load the wishlist:', error);
        if (!cancelled) setLoad({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [credentials]);

  const persist = useCallback(() => {
    clearTimeout(timer.current);
    const askedRevision = revision.current;
    if (askedRevision === queuedRevision.current && saveState.current !== 'error') return;
    queuedRevision.current = askedRevision;
    saveQueue.current = saveQueue.current.then(async () => {
      if (askedRevision !== revision.current) return; // a newer edit will save itself
      const cleaned = cleanWishlist(latest.current);
      if (!isFilledIn(cleaned) && !serverHasWishlist.current) {
        setSave('idle');
        return;
      }
      setSave('saving');
      try {
        const { eventId, participantId, participantToken, eventKey } = credentials;
        if (isFilledIn(cleaned)) {
          await saveWishlist(eventId, participantId, participantToken, await sealWishlist(eventKey, cleaned));
          serverHasWishlist.current = true;
        } else {
          await deleteWishlist(eventId, participantId, participantToken);
          serverHasWishlist.current = false;
        }
        if (askedRevision === revision.current) setSave('saved');
      } catch (error) {
        console.error('Failed to save the wishlist:', error);
        if (askedRevision === revision.current) setSave('error');
      }
    });
  }, [credentials]);

  // Saves now if anything is waiting or failed: on blur, on hide, on leaving the page.
  const flush = useCallback(() => {
    if (saveState.current === 'pending' || saveState.current === 'error') persist();
  }, [persist]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (save !== 'pending' && save !== 'saving' && save !== 'error') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  const left = wishlistCharactersLeft(wishlist);

  // The budget is enforced while typing: a change that would go over it is
  // refused, unless it frees room.
  // Typing waits for a pause; a change to the list's shape saves at once.
  const update = (next: Wishlist, keys = itemKeys, now = false) => {
    const nextLeft = wishlistCharactersLeft(next);
    if (nextLeft < 0 && nextLeft < left) return;
    setWishlist(next);
    setItemKeys(keys);
    latest.current = next;
    revision.current++;
    saveState.current = 'pending';
    setSave('pending');
    if (now) {
      persist();
    } else {
      clearTimeout(timer.current);
      timer.current = setTimeout(persist, SAVE_DELAY_MS);
    }
  };

  const changeItem = (index: number, field: 'text' | 'url', value: string) =>
    update({ ...wishlist, items: wishlist.items.map((item, i) => i === index ? { ...item, [field]: value } : item) });

  const addItem = () =>
    update({ ...wishlist, items: [...wishlist.items, { text: '', url: '' }] }, [...itemKeys, nextKey.current++], true);

  const removeItem = (index: number) =>
    update(
      { ...wishlist, items: wishlist.items.filter((_, i) => i !== index) },
      itemKeys.filter((_, i) => i !== index),
      true,
    );

  const moveItem = (index: number, by: -1 | 1) => {
    const swap = <T,>(list: T[]) => {
      const copy = [...list];
      [copy[index], copy[index + by]] = [copy[index + by], copy[index]];
      return copy;
    };
    update({ ...wishlist, items: swap(wishlist.items) }, swap(itemKeys), true);
  };

  const iconButton = 'p-2 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <section className="p-4 border border-gray-200 rounded-lg space-y-3" aria-labelledby="wishlist-title" onBlur={flush}>
      <h2 id="wishlist-title" className="text-lg font-bold text-red-700">{t('wishlist.title')}</h2>
      <p className="text-xs text-gray-500">{t('wishlist.help')}</p>
      {load.kind === 'loading' && <p className="text-gray-600">{t('participant.loading')}</p>}
      {load.kind === 'error' && <p className="text-gray-700">{t('wishlist.loadError')}</p>}
      {load.kind === 'ready' && (
        <>
          <ol className="space-y-3">
            {wishlist.items.map((item, index) => (
              <li key={itemKeys[index]} className="flex gap-2 items-start">
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => changeItem(index, 'text', e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder={t('wishlist.itemPlaceholder')}
                    aria-label={t('wishlist.itemPlaceholder')}
                  />
                  <input
                    type="url"
                    inputMode="url"
                    value={item.url}
                    onChange={(e) => changeItem(index, 'url', e.target.value)}
                    className="w-full p-2 border rounded text-sm"
                    placeholder={t('wishlist.urlPlaceholder')}
                    aria-label={t('wishlist.urlPlaceholder')}
                  />
                </div>
                <div className="flex flex-col sm:flex-row">
                  <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className={iconButton} aria-label={t('wishlist.moveUp')} title={t('wishlist.moveUp')}>
                    <ArrowUp size={16} weight="bold" />
                  </button>
                  <button type="button" onClick={() => moveItem(index, 1)} disabled={index === wishlist.items.length - 1} className={iconButton} aria-label={t('wishlist.moveDown')} title={t('wishlist.moveDown')}>
                    <ArrowDown size={16} weight="bold" />
                  </button>
                  <button type="button" onClick={() => removeItem(index)} className={`${iconButton} text-red-700`} aria-label={t('wishlist.removeItem')} title={t('wishlist.removeItem')}>
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={addItem}
            className="w-full sm:w-auto px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <Plus size={16} weight="bold" />
            {t('wishlist.addItem')}
          </button>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-2">{t('wishlist.notes')}</span>
            <textarea
              value={wishlist.notes}
              onChange={(e) => update({ ...wishlist, notes: e.target.value })}
              className="w-full p-2 border rounded min-h-[100px]"
              placeholder={t('wishlist.notesPlaceholder')}
            />
          </label>
          <span className={`block text-xs text-right ${left < 500 ? 'text-red-700' : 'text-gray-500'}`} aria-live="polite">
            {t('wishlist.charactersLeft', { count: Math.max(left, 0) })}
          </span>
          <div className="flex items-center justify-end gap-2 min-h-[2rem]">
            <span className={`text-sm ${save === 'error' ? 'text-red-700' : 'text-gray-500'}`} role="status">
              {save === 'saving' && t('wishlist.saving')}
              {save === 'saved' && t('wishlist.saved')}
              {save === 'error' && t('wishlist.saveError')}
            </span>
            {save === 'error' && (
              <button type="button" onClick={persist} className="shrink-0 px-3 py-1 text-sm bg-red-700 text-white rounded hover:bg-red-800">
                {t('wishlist.retry')}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
