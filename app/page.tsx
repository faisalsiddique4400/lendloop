import { fetchQuery } from "convex/nextjs";
import type { CSSProperties } from "react";
import { LoopStage } from "@/components/landing/LoopStage";
import { SignInCta } from "@/components/landing/SignInCta";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const WORDS = ["drill?", "ladder?", "tent?", "jigsaw?", "mixer?"];
const STEPS = [
  ["List it", "Add the tool and its condition. Takes a minute."],
  ["Ask for dates", "Pick the days. The owner hears about it right away."],
  ["Hand it over", "Meet at the door. We nudge if it's late."],
];
const delay = (step: number) => ({ "--d": step }) as CSSProperties;

export default async function Home() {
  const [tools, recent] = await Promise.all([fetchQuery(api.tools.listPublic), fetchQuery(api.loans.recent)]);

  return (
    <>
      <header className="wrap pub-head rise">
        <span className="logo">
          Lend<span>Loop</span>
        </span>
        <SignInCta label="Sign in" size="sm" />
      </header>

      <main>
        <section className="wrap hero">
          <div className="hero-copy">
            <h1>
              <span className="rise" style={delay(1)}>
                Need a{" "}
                <span className="cycle" aria-hidden="true">
                  <span className="cycle-in">
                    {[...WORDS, WORDS[0]].map((word, i) => (
                      <span key={i}>{word}</span>
                    ))}
                  </span>
                </span>
                <span className="sr">{WORDS[0]}</span>
              </span>
              <span className="rise" style={delay(2)}>
                Your street has one.
              </span>
            </h1>
            <p className="lede muted rise" style={delay(3)}>
              Borrow from neighbors for a few days, then hand it back. No buying, no storing.
            </p>
            <div className="cta-row rise" style={delay(4)}>
              <SignInCta label="Sign in to borrow" size="lg" />
              <a href="#how" className="link">
                How it works
              </a>
            </div>
          </div>
          <LoopStage style={delay(3)} />
        </section>

        {recent.length > 0 && (
          <div className="ticker rise" style={delay(5)} aria-label="Recent activity">
            <div className="ticker-in">
              {[...recent, ...recent].map((item, i) => (
                <span key={i} aria-hidden={i >= recent.length}>
                  <b>{item.toolName}</b> {item.returned ? "came back" : "lent out"}
                </span>
              ))}
            </div>
          </div>
        )}

        <section id="how" className="wrap how" aria-labelledby="how-h">
          <h2 id="how-h" className="reveal">
            Three steps,
            <br />
            no awkward texts.
          </h2>
          <ol className="plain steps">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="step reveal">
                <span className="step-n">{i + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="wrap avail" aria-labelledby="avail-h">
          <div className="avail-head reveal">
            <h2 id="avail-h">Free to borrow today</h2>
            <span className="sub">{tools.length} tools</span>
          </div>
          {tools.length ? (
            <ul className="plain avail-grid stagger">
              {tools.map((tool) => (
                <li key={tool._id} className="pub-row">
                  <span>{tool.name}</span>
                  <span className="badge">{tool.category}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing free right now. Check back soon.</p>
          )}
          <p className="help">Sign in to see who owns each one.</p>
        </section>
      </main>

      <footer className="wrap foot muted">A small demo for neighbors who share tools.</footer>
    </>
  );
}
