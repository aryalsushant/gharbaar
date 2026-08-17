import type { BirthdayNotice } from '../lib/birthdays';

/**
 * Amber, not aqua. Money is aqua and fines are coral, so a birthday needs its
 * own register or it reads as another thing somebody owes.
 */
export function BirthdayBanner({ notices }: { notices: BirthdayNotice[] }) {
  if (notices.length === 0) return null;

  return (
    <div className="birthday rise rise-1">
      {notices.map((notice) => (
        <p key={notice.userId}>
          <span className="birthday-mark" aria-hidden="true">
            ✦
          </span>
          {notice.daysAway === 0 ? (
            <>
              <strong>{notice.name}</strong> turns{' '}
              <span className="figure">{notice.turning}</span> today
            </>
          ) : (
            <>
              <strong>{notice.name}</strong> turns{' '}
              <span className="figure">{notice.turning}</span> tomorrow
            </>
          )}
        </p>
      ))}
    </div>
  );
}
