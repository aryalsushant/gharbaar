import { useEffect, useMemo, useState } from 'react';

import { Avatar } from '../components/Avatar';
import { BirthdayBanner } from '../components/BirthdayBanner';
import { DayStrip } from '../components/DayStrip';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { birthdaysAround } from '../lib/birthdays';
import {
  useApplySwap,
  useCloseSwapRequest,
  useCompletions,
  useConfirmCompletion,
  useCreateResponsibility,
  useHousehold,
  useIssuePenalty,
  useOverrides,
  usePenalties,
  useRequestSwap,
  useResponsibilities,
  useRoster,
  useRotationMembers,
  useSwapRequests,
  useSyncRotationMembers,
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
  const requests = useSwapRequests(duty?.id);
  const penalties = usePenalties();

  const createDuty = useCreateResponsibility();
  const syncMembers = useSyncRotationMembers(duty?.id);
  const confirm = useConfirmCompletion(duty?.id);
  const applySwap = useApplySwap(duty?.id);
  const requestSwap = useRequestSwap(duty?.id);
  const closeRequest = useCloseSwapRequest(duty?.id);
  const fine = useIssuePenalty();

  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());

  const personOf = (id: string | null) => (id ? house.data?.find((p) => p.id === id) : undefined);
  const nameOf = (id: string | null) => personOf(id)?.display_name ?? (id ? 'Someone' : 'Nobody');
  const seatOf = (id: string | null) => personOf(id)?.roster_key ?? null;
  const photoOf = (id: string | null) => personOf(id)?.avatar_url ?? null;

  // Roster order, always. Nobody gets to reorder the rota.
  const houseInOrder = useMemo(
    () =>
      (roster.data ?? [])
        .map((seat) => house.data?.find((p) => p.roster_key === seat.key))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [roster.data, house.data]
  );

  /**
   * Anyone holding a seat belongs in the rotation, so this happens by itself
   * rather than waiting for somebody to press a button. Existing members keep
   * their order, so nobody who has already cooked is moved back to the front,
   * and the unique constraint on (responsibility, user) makes it safe when
   * several phones notice at the same moment.
   */
  useEffect(() => {
    if (!duty || !members.data || houseInOrder.length === 0) return;
    if (syncMembers.isPending) return;
    const known = new Set(members.data.map((m) => m.user_id));
    if (houseInOrder.every((person) => known.has(person.id))) return;
    syncMembers.mutate(houseInOrder.map((p) => p.id));
  }, [duty, members.data, houseInOrder, syncMembers]);

  /**
   * Open the rota the first time anybody looks at the board, rather than making
   * one person press a button. Six phones can reach this at once, so the unique
   * index on responsibilities.name decides it: the losers fail and re-read
   * rather than creating a second Dinner.
   */
  useEffect(() => {
    if (responsibilities.isLoading || duty) return;
    if (houseInOrder.length === 0 || createDuty.isPending) return;
    createDuty.mutate(
      {
        name: 'Dinner',
        startDate: todayKey,
        memberIds: houseInOrder.map((p) => p.id),
      },
      { onError: () => void responsibilities.refetch() }
    );
  }, [responsibilities, duty, houseInOrder, createDuty, todayKey]);

  const days = useMemo(() => {
    if (!duty || !members.data) return [];
    return buildStrip(duty, members.data, overrides.data ?? [], todayKey, STRIP_DAYS);
  }, [duty, members.data, overrides.data, todayKey]);

  const tonight = days[0];
  const completionFor = (date: string) => completions.data?.find((c) => c.date === date);
  const penaltyFor = (date: string) => penalties.data?.find((p) => p.date === date);
  const requestFor = (date: string) => requests.data?.find((r) => r.date === date);

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

  /** Taking somebody's night: apply the trade, then close the ask. */
  function takeOver(date: string, requestId: string) {
    const plan = planSwap(duty!, members.data ?? [], overrides.data ?? [], date, userId!);
    if (!plan) return;
    run(async () => {
      await applySwap.mutateAsync(plan.rows);
      await closeRequest.mutateAsync(requestId);
      setPicked(null);
    });
  }

  if (responsibilities.isLoading || house.isLoading) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">Reading the house</p>
      </div>
    );
  }

  if (!duty) {
    return (
      <div className="centered">
        <p className="tag rise rise-1">Opening the kitchen</p>
      </div>
    );
  }

  // --- the board -----------------------------------------------------------

  const tonightDone = tonight ? completionFor(tonight.date) : undefined;
  const tonightFined = tonight ? penaltyFor(tonight.date) : undefined;
  const iAmCooking = tonight?.assignee === userId;

  const pickedDay = picked ? days.find((d) => d.date === picked) : null;
  const pickedRequest = pickedDay ? requestFor(pickedDay.date) : undefined;
  const openRequests = (requests.data ?? []).filter((r) => r.date >= todayKey);

  return (
    <div className="centered wide">
      <Nav />
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
          <>
            <p className="lede" style={{ maxWidth: 'none', marginTop: 0 }}>
              Your night. One of the others signs it off, so there is no button here for you.
            </p>
            {tonight && requestFor(tonight.date) ? (
              <p className="notice notice-bad" style={{ margin: '14px 0 0' }}>
                You have asked for cover. Nobody has taken it yet.
              </p>
            ) : (
              <button
                className="btn btn-quiet"
                style={{ marginTop: 14 }}
                disabled={requestSwap.isPending}
                onClick={() =>
                  run(() =>
                    requestSwap.mutateAsync({
                      date: tonight!.date,
                      requestedBy: userId!,
                      note: '',
                    })
                  )
                }
              >
                I cannot cook tonight
              </button>
            )}
          </>
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

      {/* Whoever is asking for cover, and the one tap that answers them. */}
      {openRequests.length > 0 && (
        <section className="panel panel-ask stack-lg rise rise-3">
          <p className="tag">Asking for cover</p>
          <ul className="roster-list">
            {openRequests.map((request) => (
              <li key={request.id}>
                <span className="faced">
                  <Avatar
                    rosterKey={seatOf(request.requested_by)}
                    name={nameOf(request.requested_by)}
                    url={photoOf(request.requested_by)}
                    size={26}
                  />
                  <span>
                    {nameOf(request.requested_by)} cannot cook{' '}
                    <span className="figure">{dayLabel(request.date, todayKey).toLowerCase()}</span>
                  </span>
                </span>

                {request.requested_by === userId ? (
                  <button
                    className="link"
                    disabled={closeRequest.isPending}
                    onClick={() => run(() => closeRequest.mutateAsync(request.id))}
                  >
                    I can after all
                  </button>
                ) : (
                  <button
                    className="btn btn-small"
                    disabled={applySwap.isPending || closeRequest.isPending}
                    onClick={() => takeOver(request.date, request.id)}
                  >
                    I will
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="tag" style={{ marginTop: 12, letterSpacing: '0.08em' }}>
            Taking a night is a trade. They pick up your next turn instead.
          </p>
        </section>
      )}

      <section className="stack-lg rise rise-3">
        <p className="tag">The fortnight</p>
        <DayStrip
          days={days}
          todayKey={todayKey}
          nameOf={nameOf}
          seatOf={seatOf}
          photoOf={photoOf}
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

          {pickedRequest ? (
            pickedDay.assignee === userId ? (
              <p className="lede" style={{ maxWidth: 'none' }}>
                You have asked for cover on this night. It stays in the list above until
                somebody takes it.
              </p>
            ) : (
              <button
                className="btn"
                style={{ marginTop: 14 }}
                disabled={applySwap.isPending}
                onClick={() => takeOver(pickedDay.date, pickedRequest.id)}
              >
                I will take this night
              </button>
            )
          ) : pickedDay.assignee === userId ? (
            <button
              className="btn btn-quiet"
              style={{ marginTop: 14 }}
              disabled={requestSwap.isPending}
              onClick={() =>
                run(() =>
                  requestSwap.mutateAsync({
                    date: pickedDay.date,
                    requestedBy: userId!,
                    note: '',
                  })
                )
              }
            >
              I cannot cook this night
            </button>
          ) : (
            <p className="lede" style={{ maxWidth: 'none' }}>
              Only {nameOf(pickedDay.assignee)} can give this night away. Nobody gets
              volunteered.
            </p>
          )}
        </section>
      )}

      <footer className="rise rise-5 footer-row">
        <button className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </footer>
    </div>
  );
}
