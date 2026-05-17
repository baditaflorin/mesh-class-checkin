import { useEffect, useMemo, useState } from "react";
import { MeshNameInput, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Entry = { name: string; ts: number };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const DEFAULT_CAPACITY = 12;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="cls-screen">
        <h1>class check-in</h1>
        <p className="cls-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [classNameDraft, setClassNameDraft] = useState("");
  const [capacityDraft, setCapacityDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const entries = room.doc.getMap<Entry>("entries");
    const meta = room.doc.getMap<string | number>("meta");
    const onChange = () => rerender((n) => n + 1);
    entries.observe(onChange);
    meta.observe(onChange);
    return () => {
      entries.unobserve(onChange);
      meta.unobserve(onChange);
    };
  }, [room]);

  const entriesMap = room.doc.getMap<Entry>("entries");
  const meta = room.doc.getMap<string | number>("meta");
  const className = String(meta.get("className") ?? "");
  const capacity = Math.max(1, Number(meta.get("capacity") ?? DEFAULT_CAPACITY));

  const allEntries = useMemo(() => {
    const arr: Array<Entry & { id: string }> = [];
    entriesMap.forEach((v, k) => arr.push({ ...v, id: k }));
    arr.sort((a, b) => a.ts - b.ts);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, entriesMap.size]);

  const checkedIn = allEntries.slice(0, capacity);
  const waitlist = allEntries.slice(capacity);
  const myEntry = entriesMap.get(room.peerId);
  const myIndex = allEntries.findIndex((e) => e.id === room.peerId);
  const myStatus = myIndex === -1 ? "out" : myIndex < capacity ? "checked-in" : "waitlist";

  const checkIn = () => {
    if (!name.trim() || myEntry) return;
    entriesMap.set(room.peerId, { name: name.trim(), ts: Date.now() });
  };

  const undo = () => entriesMap.delete(room.peerId);

  const saveMeta = () => {
    const cap = Number(capacityDraft);
    room.doc.transact(() => {
      meta.set("className", classNameDraft.trim());
      if (Number.isFinite(cap) && cap > 0) meta.set("capacity", Math.floor(cap));
    });
    setEditing(false);
  };

  const startEdit = () => {
    setClassNameDraft(className);
    setCapacityDraft(String(capacity));
    setEditing(true);
  };

  const exportCsv = () => {
    const header = "status,timestamp_iso,name,peer_id\n";
    const rows = allEntries
      .map((e, i) => {
        const status = i < capacity ? "checked-in" : "waitlist";
        return `${status},"${new Date(e.ts).toISOString()}","${e.name.replace(/"/g, '""')}","${e.id}"`;
      })
      .join("\n");
    const blob = new Blob([header + rows + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (className || "class").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cls-screen">
      <header className="cls-header">
        <h1>class check-in</h1>
        <p className="cls-status">
          {checkedIn.length}/{capacity} in class · {waitlist.length} waiting
        </p>
      </header>

      <div className="cls-meta">
        {editing ? (
          <form
            className="cls-edit"
            onSubmit={(e) => {
              e.preventDefault();
              saveMeta();
            }}
          >
            <input
              value={classNameDraft}
              onChange={(e) => setClassNameDraft(e.target.value)}
              placeholder="class name (e.g. yoga 6pm)"
              autoFocus
              maxLength={80}
            />
            <input
              type="number"
              min="1"
              step="1"
              value={capacityDraft}
              onChange={(e) => setCapacityDraft(e.target.value)}
              placeholder="capacity"
              aria-label="capacity"
            />
            <button type="submit">save</button>
            <button type="button" onClick={() => setEditing(false)}>
              cancel
            </button>
          </form>
        ) : (
          <button type="button" className="cls-meta-display" onClick={startEdit}>
            <strong>{className || "untitled class"}</strong>
            <span>capacity {capacity}</span>
          </button>
        )}
      </div>

      {myStatus === "out" ? (
        <form
          className="cls-form"
          onSubmit={(e) => {
            e.preventDefault();
            checkIn();
          }}
        >
          <MeshNameInput
            value={name}
            onChange={setName}
            placeholder="your name"
            autoFocus
            maxLength={48}
          />
          <button type="submit" disabled={!name.trim()}>
            ✓ check in
          </button>
        </form>
      ) : (
        <div className={`cls-confirmed cls-${myStatus}`}>
          {myStatus === "checked-in" ? (
            <p>
              ✓ <strong>{myEntry?.name}</strong> · you're in
            </p>
          ) : (
            <p>
              ⏳ <strong>{myEntry?.name}</strong> · waitlist #{myIndex - capacity + 1}
            </p>
          )}
          <button type="button" className="cls-undo" onClick={undo}>
            undo
          </button>
        </div>
      )}

      <section className="cls-section" aria-label="checked in">
        <h2 className="cls-section-title">in class</h2>
        {checkedIn.length === 0 ? (
          <p className="cls-empty">empty</p>
        ) : (
          <ul className="cls-list">
            {checkedIn.map((e, i) => (
              <li key={e.id} className={`cls-entry ${e.id === room.peerId ? "is-me" : ""}`}>
                <span className="cls-pos">{i + 1}.</span>
                <span className="cls-name">{e.name}</span>
                <span className="cls-time">{new Date(e.ts).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {waitlist.length > 0 && (
        <section className="cls-section" aria-label="waitlist">
          <h2 className="cls-section-title">waitlist</h2>
          <ul className="cls-list">
            {waitlist.map((e, i) => (
              <li
                key={e.id}
                className={`cls-entry cls-wait ${e.id === room.peerId ? "is-me" : ""}`}
              >
                <span className="cls-pos">#{i + 1}</span>
                <span className="cls-name">{e.name}</span>
                <span className="cls-time">{new Date(e.ts).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="cls-export"
        onClick={exportCsv}
        disabled={allEntries.length === 0}
      >
        export CSV ({allEntries.length})
      </button>
    </div>
  );
}
