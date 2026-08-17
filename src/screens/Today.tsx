import { useEffect, useMemo, useState } from 'react';

import { Avatar } from '../components/Avatar';
import { DayStrip } from '../components/DayStrip';
import { Nav } from '../components/Nav';
import { PushSetup } from '../components/PushSetup';
import { useAuth } from '../lib/auth';
import {
  useApplySwap,
  useCloseSwapRequest,
  useCompletions,
  useConfirmCompletion,
  useCreateResponsibility,
  useHousehold,
  useOverrides,
  useRequestSwap,
  useResponsibilities,
  useRoster,
  useRotationMembers,
  useSwapRequests,
  useSyncRotationMembers,
} from '../lib/db';
import { longDate } from '../lib/dates';
import { buildStrip, dayLabel, planSwap } from '../lib/duty';
import { toDateKey } from '../lib/rotation';

// A week. The strip is computed from today, so it rolls forward by itself.
const STRIP_DAYS = 7;

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

  const createDuty = useCreateResponsibility();
  const syncMembers = useSyncRotationMembers(duty?.id);
  const confirm = useConfirmCompletion(duty?.id);
  const applySwap = useApplySwap(duty?.id);
  const requestSwap = useRequestSwap(duty?.id);
  const closeRequest = useCloseSwapRequest(duty?.id);

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
  const seatsTotal = roster.data?.length ?? 6;
  const everybodyIn = houseInOrder.length >= seatsTotal;

  useEffect(() => {
    if (responsibilities.isLoading || duty) return;
    if (!everybodyIn || createDuty.isPending) return;
    createDuty.mutate(
      {
        name: 'Dinner',
        startDate: todayKey,
        memberIds: houseInOrder.map((p) => p.id),
      },
      { onError: () => void responsibilities.refetch() }
    );
  }, [responsibilities, duty, houseInOrder, everybodyIn, createDuty, todayKey]);

  const days = useMemo(() => {
    if (!duty || !members.data) return [];
    return buildStrip(duty, members.data, overrides.data ?? [], todayKey, STRIP_DAYS);
  }, [duty, members.data, overrides.data, todayKey]);

  const tonight = days[0];
  const completionFor = (date: string) => completions.data?.find((c) => c.date === date);
  const requestFor = (date: string) => requests.data?.find((r) => r.date === date);

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
    const waiting = (roster.data ?? []).filter(
      (seat) => !houseInOrder.some((person) => person.roster_key === seat.key)
    );

    return (
      <div className="centered wide">
        <Nav />

        <header className="rise rise-1">
          <p className="tag figure">
            {houseInOrder.length} of {seatsTotal} in
          </p>
          <h1 className="wordmark">
            {everybodyIn ? 'Opening the kitchen' : 'Waiting for the house'}
          </h1>
          <p className="lede">
            The rota starts once everyone has a seat, so the order matches the house
            instead of whoever arrived first.
          </p>
        </header>

        <section className="panel stack-lg rise rise-2">
          <p className="tag">Here</p>
          <ul className="roster-list">
            {houseInOrder.map((person) => (
              <li key={person.id}>
                <span className="faced">
                  <Avatar
                    rosterKey={person.roster_key}
                    name={person.display_name}
                    url={person.avatar_url}
                    size={26}
                  />
                  {person.display_name}
                </span>
                <span className="flag flag-done">in</span>
              </li>
            ))}
          </ul>

          {waiting.length > 0 && (
            <>
              <p className="tag" style={{ marginTop: 18 }}>Still to join</p>
              <ul className="roster-list">
                {waiting.map((seat) => (
                  <li key={seat.key}>
                    <span className="faced" style={{ opacity: 0.55 }}>
                      <Avatar rosterKey={seat.key} name={seat.display_name} size={26} />
                      {seat.display_name}
                    </span>
                    <span className="tag">waiting</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <p className="lede rise rise-3" style={{ maxWidth: 'none', marginTop: 20 }}>
          The ledger works now. Log groceries, split them, settle up. Only the cooking
          rota is waiting.
        </p>
      </div>
    );
  }

  // --- the board -----------------------------------------------------------

  const tonightDone = tonight ? completionFor(tonight.date) : undefined;
  const iAmCooking = tonight?.assignee === userId;

  const pickedDay = picked ? days.find((d) => d.date === picked) : null;
  const pickedRequest = pickedDay ? requestFor(pickedDay.date) : undefined;
  const openRequests = (requests.data ?? []).filter((r) => r.date >= todayKey);

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">{longDate(todayKey)}</p>
        <h1 className="wordmark">
          {iAmCooking ? 'You cook tonight' : `${nameOf(tonight?.assignee ?? null)} cooks tonight`}
        </h1>
        <p className="lede">Whoever cooks also cleans. Someone else signs it off.</p>
      </header>

      <section className="panel stack-lg rise rise-2">
        {error && <p className="notice notice-bad">{error}</p>}
        {tonightDone ? (
          <p className="notice notice-good" style={{ marginBottom: 0 }}>
            Signed off by {nameOf(tonightDone.marked_by)}.
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
            <button
              className="btn"
              style={{ marginTop: 12 }}
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
            <p className="tag" style={{ marginTop: 12, letterSpacing: '0.08em' }}>
              If they did not, leave it. Nothing is charged and nothing is recorded.
            </p>
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
        <p className="tag">This week</p>
        <DayStrip
          days={days}
          todayKey={todayKey}
          nameOf={nameOf}
          seatOf={seatOf}
          photoOf={photoOf}
          askedOn={(date) => !!requestFor(date)}
          doneOn={(date) => !!completionFor(date)}
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

      <div className="stack-lg">{userId && <PushSetup userId={userId} />}</div>

      <footer className="rise rise-5 footer-row">
        <button className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </footer>
    </div>
  );
}
