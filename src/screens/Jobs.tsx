import { useMemo, useState, type FormEvent } from 'react';

import { Avatar } from '../components/Avatar';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';
import { APARTMENTS } from '../lib/categories';
import { shortDate } from '../lib/dates';
import {
  DINNER,
  jobsOf,
  useAllCompletions,
  useAllRotationMembers,
  useConfirmJob,
  useCreateResponsibility,
  useDeleteResponsibility,
  useHousehold,
  useResponsibilities,
  useRoster,
  type Responsibility,
} from '../lib/db';
import { getAssignee, periodDays, shiftDays, toDateKey, turnStart } from '../lib/rotation';

type Frequency = 'daily' | 'weekly';

/**
 * Everything that is not dinner.
 *
 * A job is a name, the people who share it, and how often it turns. That is
 * the whole of it: the same computed rotation as dinner, so there is no
 * schedule to maintain and every phone agrees on whose week it is. The people
 * are chosen per job because the bins are the whole house and a bathroom is
 * one flat, and a job that assumed either would be wrong half the time.
 *
 * No swaps here, at least for now. Dinner needed cover because a missed night
 * is a missed meal; a bathroom cleaned on Thursday instead of Tuesday is fine.
 */
export function Jobs() {
  const { userId } = useAuth();
  const house = useHousehold();
  const roster = useRoster();
  const responsibilities = useResponsibilities();
  const members = useAllRotationMembers();
  const completions = useAllCompletions();

  const create = useCreateResponsibility();
  const remove = useDeleteResponsibility();
  const confirm = useConfirmJob();

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [chosen, setChosen] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());
  const jobs = jobsOf(responsibilities.data);

  const personOf = (id: string | null) => (id ? house.data?.find((p) => p.id === id) : undefined);
  const nameOf = (id: string | null) => personOf(id)?.display_name ?? (id ? 'Someone' : 'Nobody');

  /** The house in seat order, which is the order a job turns in. */
  const houseInOrder = useMemo(() => {
    const rank = new Map((roster.data ?? []).map((seat) => [seat.key, seat.sort_order]));
    return [...(house.data ?? [])].sort(
      (a, b) => (rank.get(a.roster_key ?? '') ?? 99) - (rank.get(b.roster_key ?? '') ?? 99)
    );
  }, [house.data, roster.data]);

  const membersOf = (jobId: string) =>
    (members.data ?? []).filter((m) => m.responsibility_id === jobId);

  const doneFor = (jobId: string, date: string) =>
    (completions.data ?? []).find((c) => c.responsibility_id === jobId && c.date === date);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(readable(err));
    }
  }

  function pickGroup(group: 'house' | (typeof APARTMENTS)[number]) {
    setChosen(
      houseInOrder.filter((p) => group === 'house' || p.apartment === group).map((p) => p.id)
    );
  }

  function toggle(personId: string) {
    setChosen((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );
  }

  const ready = name.trim().length > 0 && chosen.length > 0;

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    if (name.trim().toLowerCase() === DINNER.toLowerCase()) {
      setError('Dinner has its own board.');
      return;
    }
    await run(async () => {
      // Seat order, not tap order, so the rotation reads the same way the
      // house does and does not depend on who was ticked first.
      const slots = houseInOrder
        .filter((p) => chosen.includes(p.id))
        .map((p, i) => ({ userId: p.id, order: i }));
      await create.mutateAsync({ name, startDate: todayKey, slots, frequency });
      setName('');
      setChosen([]);
    });
  }

  const loading = responsibilities.isLoading || house.isLoading || members.isLoading;

  return (
    <div className="centered wide">
      <Nav />

      <header className="rise rise-1">
        <p className="tag">Everything else</p>
        <h1 className="wordmark">Jobs</h1>
        <p className="lede">
          Dinner has its own board. This is for the rest: the bins, a bathroom, the hallway.
          Pick who shares a job and how often it turns, and it runs itself from there.
        </p>
      </header>

      {error && <p className="notice notice-bad rise rise-2">{error}</p>}

      {loading ? (
        <p className="tag rise rise-2">Reading the house</p>
      ) : jobs.length === 0 ? (
        <p className="lede rise rise-2" style={{ maxWidth: 'none' }}>
          Nothing yet. Add the first one below.
        </p>
      ) : (
        jobs.map((job, i) => (
          <JobCard
            key={job.id}
            job={job}
            index={i}
            todayKey={todayKey}
            members={membersOf(job.id)}
            done={doneFor(job.id, turnStart(job, todayKey))}
            userId={userId}
            nameOf={nameOf}
            personOf={personOf}
            confirming={confirm.isPending}
            onConfirm={(date, assignee) =>
              run(() =>
                confirm.mutateAsync({ responsibilityId: job.id, date, assignee, markedBy: userId! })
              )
            }
            removing={removing === job.id}
            onAskRemove={() => setRemoving(job.id)}
            onKeep={() => setRemoving(null)}
            onRemove={() =>
              run(async () => {
                await remove.mutateAsync(job.id);
                setRemoving(null);
              })
            }
            removePending={remove.isPending}
          />
        ))
      )}

      <form className="panel stack-lg rise rise-4" onSubmit={onCreate}>
        <p className="tag">New job</p>

        <label className="field">
          <span className="tag">What</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bins, bathroom, hallway"
            maxLength={40}
            required
          />
        </label>

        <p className="tag">How often it turns</p>
        <div className="chips" style={{ marginBottom: 18 }}>
          {(['weekly', 'daily'] as Frequency[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${frequency === option ? ' is-on' : ''}`}
              onClick={() => setFrequency(option)}
            >
              {option === 'weekly' ? 'Every week' : 'Every day'}
            </button>
          ))}
        </div>

        <p className="tag">Who shares it</p>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button type="button" className="chip" onClick={() => pickGroup('house')}>
            Everyone
          </button>
          {APARTMENTS.map((flat) => (
            <button key={flat} type="button" className="chip" onClick={() => pickGroup(flat)}>
              {flat}
            </button>
          ))}
        </div>
        <div className="chips" style={{ marginBottom: 16 }}>
          {houseInOrder.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`chip chip-face${chosen.includes(person.id) ? ' is-on' : ''}`}
              onClick={() => toggle(person.id)}
            >
              <Avatar
                rosterKey={person.roster_key}
                name={person.display_name}
                url={person.avatar_url}
                size={22}
              />
              {person.display_name}
            </button>
          ))}
        </div>

        <p className="tag" style={{ marginBottom: 14, letterSpacing: '0.08em' }}>
          {chosen.length === 0
            ? 'Pick at least one person.'
            : `${chosen.length} ${chosen.length === 1 ? 'person takes' : 'people take'} turns, starting today, in seat order.`}
        </p>

        <button className="btn" type="submit" disabled={!ready || create.isPending}>
          {create.isPending ? 'Saving' : 'Add it'}
        </button>
      </form>
    </div>
  );
}

type CardProps = {
  job: Responsibility;
  index: number;
  todayKey: string;
  members: { user_id: string; rotation_order: number; is_active: boolean }[];
  done: { marked_by: string | null } | undefined;
  userId: string | null;
  nameOf: (id: string | null) => string;
  personOf: (id: string | null) => { roster_key: string | null; avatar_url: string | null } | undefined;
  confirming: boolean;
  onConfirm: (date: string, assignee: string) => void;
  removing: boolean;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
  removePending: boolean;
};

function JobCard({
  job,
  index,
  todayKey,
  members,
  done,
  userId,
  nameOf,
  personOf,
  confirming,
  onConfirm,
  removing,
  onAskRemove,
  onKeep,
  onRemove,
  removePending,
}: CardProps) {
  const period = periodDays(job);
  const start = turnStart(job, todayKey);
  const holder = getAssignee(job, members, [], todayKey);
  const mine = holder === userId;

  // The two turns after this one, so people can see it coming.
  const next = [1, 2]
    .map((n) => getAssignee(job, members, [], shiftDays(start, n * period)))
    .filter((id): id is string => !!id);

  const until = period > 1 ? shiftDays(start, period - 1) : null;

  return (
    <section className="panel stack-lg rise" style={{ animationDelay: `${0.16 + index * 0.06}s` }}>
      <div className="spread">
        <div>
          <p className="tag">{period > 1 ? 'Every week' : 'Every day'}</p>
          <h2 className="wordmark" style={{ fontSize: 'clamp(1.6rem, 6vw, 2rem)', margin: '2px 0 0' }}>
            {job.name}
          </h2>
        </div>
        {removing ? (
          <span className="row" style={{ gap: 10 }}>
            <button className="link link-danger" disabled={removePending} onClick={onRemove}>
              Yes, remove
            </button>
            <button className="link" onClick={onKeep}>
              Keep it
            </button>
          </span>
        ) : (
          <button className="link" onClick={onAskRemove}>
            remove
          </button>
        )}
      </div>

      <div className="faced" style={{ marginTop: 16 }}>
        <Avatar
          rosterKey={personOf(holder)?.roster_key ?? null}
          name={nameOf(holder)}
          url={personOf(holder)?.avatar_url ?? null}
          size={44}
        />
        <span>
          <span className="headline-name">{mine ? 'You' : nameOf(holder)}</span>
          <br />
          <span className="tag">
            {until ? `until ${shortDate(until)}` : 'today'}
            {next.length > 0 ? ` · then ${next.map(nameOf).join(', then ')}` : ''}
          </span>
        </span>
      </div>

      {done ? (
        <p className="notice notice-good" style={{ marginTop: 14, marginBottom: 0 }}>
          Done. Signed off by {nameOf(done.marked_by)}.
        </p>
      ) : mine ? (
        <p className="tag" style={{ marginTop: 14, letterSpacing: '0.08em' }}>
          Yours. Someone else signs it off.
        </p>
      ) : holder ? (
        <button
          className="btn btn-small"
          style={{ marginTop: 14 }}
          disabled={confirming}
          onClick={() => onConfirm(start, holder)}
        >
          {nameOf(holder)} did it
        </button>
      ) : (
        <p className="tag" style={{ marginTop: 14 }}>Nobody is on this job.</p>
      )}
    </section>
  );
}

/** Postgres error codes are not sentences. */
function readable(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/duplicate key|already exists/i.test(message)) {
    return 'There is already a job called that.';
  }
  if (/frequency/i.test(message)) {
    return 'Weekly jobs need the latest database migration. Run supabase db push and try again.';
  }
  return message;
}
