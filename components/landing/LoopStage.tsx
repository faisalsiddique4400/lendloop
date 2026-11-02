import type { CSSProperties } from "react";

const at = (angle: number) => ({ "--a": `${angle}deg` }) as CSSProperties;

const STATES = [
  ["badge badge-accent", "Waiting", "Sara asked for your drill, Nov 5 to 8."],
  ["badge badge-strong", "Approved", "Sara has it. Back Nov 8."],
  ["badge", "Returned", "Back on your shelf. Thanks, Sara."],
];

export function LoopStage({ style }: { style?: CSSProperties }) {
  return (
    <div className="stage rise" style={style} role="img" aria-label="A drill goes from you to Sara and comes back.">
      <div className="ring">
        <div className="node" style={at(0)}>
          <span className="avatar">You</span>
        </div>
        <div className="node" style={at(180)}>
          <span className="avatar">SK</span>
        </div>
        {[
          ["KM", 62],
          ["PN", 118],
          ["LO", 250],
        ].map(([initials, angle]) => (
          <div key={initials} className="node far" style={at(Number(angle))}>
            <span className="avatar">{initials}</span>
          </div>
        ))}
        <div className="arm">
          <div className="carry">
            <span className="carry-in">Drill</span>
          </div>
        </div>
      </div>
      <div className="status" aria-hidden="true">
        {STATES.map(([badge, label, text]) => (
          <div key={label} className="state">
            <span className={badge}>{label}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
