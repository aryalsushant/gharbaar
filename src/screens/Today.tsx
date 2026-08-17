import { useMemo, useState } from 'react';

import { BirthdayBanner } from '../components/BirthdayBanner';
import { DayStrip } from '../components/DayStrip';
import { useAuth } from '../lib/auth';
import { birthdaysAround } from '../lib/birthdays';
import {
  useApplySwap,
  useClearOverride,
  useCompletions,
  useConfirmCompletion,
  useCreateResponsibility,
  useHousehold,
  useIssuePenalty,
  usePenalties,
  useResetRotation,
  useResponsibilities,
  useRotationMembers,
  useRoster,
  useOverrides,
} from '../lib/db';
import { buildStrip, dayLabel, planSwap } from '../lib/duty';
import { toDateKey } from '../lib/rotation';

const STRIP_DAYS = 14;

export function Today() {
  const { userId, signOut } = useAuth();
  const house = useHousehold();
  const roster = useRoster();
  const responsibilities = useResponsibilities();

  const duty = responsibilities.data?.[0];
  const members = useRotationMembers(duty?.id);
  const overrides = useOverrides(duty?.id);
  const completions = useCompletions(duty?.id);
  const penalties = usePenalties();

  const createDuty = useCreateResponsibility();
  const confirm = useConfirmCompletion(duty?.id);
  const applySwap = useApplySwap(duty?.id);
  const clearOverride = useClearOverride(duty?.id);
  const fine = useIssuePenalty();
  const resetRotation = useResetRotation();

  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const todayKey = toDateKey(new Date());

  const nameOf = (id: string | null) =>
    id ? (house.data?.find((p) => p.id === id)?.display_name ?? 'Someone') : 'Nobody';

  const days = useMemo(() => {
    if (!duty || !members.data) return [];
    return buildStrip(duty, members.data, overrides.data ?? [], todayKey, STRIP_DAYS);
  }, [duty, members.data, overrides.data, todayKey]);

  const tonight = days[0];
  const completionFor = (date: string) => completions.data?.find((c) => c.date === date);
  const penaltyFor = (date: string) => penalties.data?.find((p) => p.date === date);

  const notices = useMemo(
    () => birthdaysAround(house.data ?? [], todayKey),
    [house.data, todayKey]
  );

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    }
  }

  // --- first run: nobody has set up the rotation yet ------------------------

  if (responsibilities.isLoading || house.isLoading) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">Reading the house</p>
      </div>
    );
  }

  if (!duty) {
    const order = (roster.data ?? [])
      .map((seat) => house.data?.find((p) => p.roster_key === seat.key))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return (
      <div className="centered">
        <header className="rise rise-1">
          <p className="tag">First run</p>
          <h1 className="wordmark">Start the rotation</h1>
          <p className="lede">
            One person cooks and cleans each night, in roster order, starting today.
          </p>
        </header>

        <section className="panel stack-lg rise rise-2">
          {error && <p className="notice notice-bad">{error}</p>}

          <p className="tag">The order</p>
          <ol className="roster-list">
            {order.map((person, i) => (
              <li key={person.id}>
                <span>{person.display_name}</span>
                <span className="tag figure">{dayLabel(days[i]?.date ?? todayKey, todayKey)}</span>
              </li>
            ))}
          </ol>

          <button
            className="btn"
            style={{ marginTop: 18 }}
            disabled={order.length === 0 || createDuty.isPending}
            onClick={() =>
              run(() =>
                createDuty.mutateAsync({
                  name: 'Dinner',
                  startDate: todayKey,
                  memberIds: order.map((p) => p.id),
                })
              )
            }
          >
            {createDuty.isPending ? 'Setting the rota' : 'Start it today'}
          </button>

          {order.length < 2 && (
            <p className="lede" style={{ maxWidth: 'none' }}>
              Worth waiting until everyone has taken a seat, otherwise the rotation starts
              with whoever is here and the order will not match the house.
            </p>
          )}
        </section>
      </div>
    );
  }

  // --- the board -----------------------------------------------------------

  const tonightDone = tonight ? completionFor(tonight.date) : undefined;
  const tonightFined = tonight ? penaltyFor(tonight.date) : undefined;
  const iAmCooking = tonight?.assignee === userId;

  const pickedDay = picked ? days.find((d) => d.date === picked) : null;

  return (
    <div className="centered wide">
      <BirthdayBanner notices={notices} />

      <header className="rise rise-1">
        <p className="tag figure">{todayKey}</p>
        <h1 className="wordmark">
          {iAmCooking ? 'You cook tonight' : `${nameOf(tonight?.assignee ?? null)} cooks tonight`}
        </h1>
        <p className="lede">Whoever cooks also cleans. Someone else signs it off.</p>
      </header>

      {error && <p className="notice notice-bad rise rise-2">{error}</p>}

      <section className="panel stack-lg rise rise-2">
        {tonightDone ? (
          <p className="notice notice-good" style={{ marginBottom: 0 }}>
            Signed off by {nameOf(tonightDone.marked_by)}.
          </p>
        ) : tonightFined ? (
          <p className="notice notice-bad" style={{ marginBottom: 0 }}>
            Missed. <span className="figure">$10</span> charged by {nameOf(tonightFined.issued_by)}.
          </p>
        ) : iAmCooking ? (
          <p className="lede" style={{ maxWidth: 'none', margin: 0 }}>
            Your night. One of the others confirms it once it is done, and you cannot sign
            off your own, so do not go looking for the button.
          </p>
        ) : (
          <>
            <p className="tag">Did {nameOf(tonight?.assignee ?? null)} cook and clean?</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn"
                disabled={confirm.isPending}
                onClick={() =>
                  run(() =>
                    confirm.mutateAsync({
                      date: tonight!.date,
                      assignee: tonight!.assignee!,
                      markedBy: userId!,
                    })
                  )
                }
              >
                Yes, done
              </button>
              <button
                className="btn btn-danger"
                disabled={fine.isPending}
                onClick={() =>
                  run(() =>
                    fine.mutateAsync({
                      userId: tonight!.assignee!,
                      issuedBy: userId!,
                      responsibilityId: duty.id,
                      date: tonight!.date,
                      reason: 'Dinner not done',
                    })
                  )
                }
              >
                No, charge $10
              </button>
            </div>
          </>
        )}
      </section>

      <section className="stack-lg rise rise-3">
        <p className="tag">The fortnight</p>
        <DayStrip
          days={days}
          todayKey={todayKey}
          nameOf={nameOf}
          doneOn={(date) => !!completionFor(date)}
          finedOn={(date) => !!penaltyFor(date)}
          onPick={(date) => setPicked(date === picked ? null : date)}
        />
      </section>

      {pickedDay && (
        <section className="panel stack-lg rise rise-1">
          <div className="spread">
            <div>
              <p className="tag">{dayLabel(pickedDay.date, todayKey)}</p>
              <h2 style={{ margin: 0 }}>{nameOf(pickedDay.assignee)}</h2>
            </div>
            <button className="link" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>

          <p className="tag" style={{ marginTop: 16 }}>
            Someone else covers, and takes this day in trade
          </p>

          <div className="cover-choices">
            {house.data
              ?.filter((person) => person.id !== pickedDay.assignee)
              .map((person) => (
                <button
                  key={person.id}
                  className="btn btn-quiet"
                  disabled={applySwap.isPending}
                  onClick={() => {
                    const plan = planSwap(
                      duty,
                      members.data ?? [],
                      overrides.data ?? [],
                      pickedDay.date,
                      person.id
                    );
                    if (!plan) return;
                    run(async () => {
                      await applySwap.mutateAsync(plan.rows);
                      setPicked(null);
                    });
                  }}
                >
                  {person.display_name}
                </button>
              ))}
          </div>

          {pickedDay.swapped && (
            <button
              className="btn btn-quiet"
              style={{ marginTop: 12 }}
              disabled={clearOverride.isPending}
              onClick={() => run(() => clearOverride.mutateAsync(pickedDay.date))}
            >
              Undo the swap on this day
            </button>
          )}
        </section>
      )}

      <footer className="rise rise-5 footer-row">
        {confirmingReset ? (
          <>
            <span className="tag">
              Wipes the order, the swaps and every sign-off. Fines stay owed.
            </span>
            <button
              className="link link-danger"
              disabled={resetRotation.isPending}
              onClick={() =>
                run(async () => {
                  await resetRotation.mutateAsync(duty.id);
                  setConfirmingReset(false);
                  setPicked(null);
                })
              }
            >
              Yes, restart it
            </button>
            <button className="link" onClick={() => setConfirmingReset(false)}>
              Keep it
            </button>
          </>
        ) : (
          <>
            <button className="link" onClick={() => setConfirmingReset(true)}>
              Restart the rotation
            </button>
            <button className="link" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
