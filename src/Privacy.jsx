import { useEffect } from "react";
import { T, CSS, applyTheme } from "./theme.js";

/*
 * /privacy: what WordShake keeps about teachers and students, where, for how long, and how it's deleted.
 * Written for teachers and parents. Keep it in step with the server: if a new kind of data is stored
 * (a new collection in server/lib/store.js, a new localStorage key), it belongs here too.
 */
const UPDATED = "26 October 2026";

const Section = ({ title, children }) => (
  <section style={{ display: "grid", gap: 10 }}>
    <h2 className="ws-display" style={{ margin: "10px 0 0", fontSize: 24 }}>{title}</h2>
    {children}
  </section>
);

const List = ({ items }) => (
  <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 6 }}>
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ul>
);

export function Privacy() {
  useEffect(() => { applyTheme(); document.title = "Privacy · WordShake"; }, []);
  return (
    <div className="ws-root" style={{ minHeight: "100vh", background: T.ink, color: "var(--ws-text)", padding: "24px 16px 60px", boxSizing: "border-box" }}>
      <style>{CSS}</style>
      <main style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16, fontSize: 17, lineHeight: 1.55, color: T.mist }}>
        <a href="/" style={{ color: T.mist, fontSize: 15 }}>← WordShake</a>
        <h1 className="ws-display" style={{ margin: 0, fontSize: 36, color: "var(--ws-text)" }}>Privacy</h1>
        <p style={{ margin: 0 }}>For teachers and families: what WordShake keeps, where it's kept, who can see it, and how to delete it. Last updated {UPDATED}.</p>

        <div style={{ background: "rgb(var(--ws-green-rgb) / .08)", border: "1px solid rgb(var(--ws-green-rgb) / .45)", borderRadius: 14, padding: "14px 18px" }}>
          <b style={{ color: "var(--ws-text)" }}>The short version.</b> WordShake keeps students' first names and the words they find, so their teacher can see how
          they're going. Students don't need an email address or an account of their own. There are no ads, no tracking and no analytics, and nothing is sold or shared
          beyond the services that run the app. A teacher can delete a class, and everything about it, at any time.
        </div>

        <Section title="Who runs WordShake">
          <p style={{ margin: 0 }}>WordShake is made and run by Rob's Education Tools, in Melbourne.</p>
        </Section>

        <Section title="What WordShake keeps">
          <p style={{ margin: 0 }}><b style={{ color: "var(--ws-text)" }}>About teachers</b></p>
          <List items={[
            "Your name and email address from Google, when you sign in with Google. WordShake never sees your Google password.",
            "When you first and last signed in, and your game settings.",
          ]} />
          <p style={{ margin: 0 }}><b style={{ color: "var(--ws-text)" }}>About each class</b>, entered by its teacher</p>
          <List items={[
            "The class name, its class code, and each student's name as the teacher types it. First names are all WordShake needs.",
            "Each student's secret pictures (their picture sign-in), so the teacher can look them up if a student forgets.",
            "Every finished round: the board, and the words each student found and their points. Home games are kept the same way.",
            "Each student's progress: stickers, trophies, personal bests, their word jar (every different word they've found), awards from their teacher, and the stars they've spent and what they've chosen in the shop.",
          ]} />
          <p style={{ margin: 0 }}><b style={{ color: "var(--ws-text)" }}>Signed-in devices</b></p>
          <List items={[
            "When a student signs in, their device keeps a sign-in pass so they don't have to sign in every time. The pass is kept in the browser's storage and in a cookie that lasts up to 400 days.",
            "WordShake only stores a scrambled copy of each pass, the kind of device (for example \"iPad\"), and when it was first and last used. Up to 5 devices per student; the oldest makes way for a new one.",
            "The device also remembers a few settings, such as whether sound is on. These stay on the device.",
          ]} />
          <p style={{ margin: 0 }}><b style={{ color: "var(--ws-text)" }}>During a game</b></p>
          <List items={[
            "While a game is open, a copy of it (players' names and the words found so far) is kept so the game can carry on if the server restarts. It's deleted when the game closes, and never kept longer than 12 hours.",
            "Guests (family or friends joining a home game, or anyone joining without signing in) type a name for that game only. Guests' names and words are never saved with the class.",
            "If the app crashes, a short error report is sent so it can be fixed: what went wrong, the app version, the kind of device and which buttons were pressed just before. It doesn't include names, class codes, secret pictures or anything typed.",
          ]} />
        </Section>

        <Section title="What WordShake doesn't do">
          <List items={[
            "No advertising, no tracking, no analytics and no selling or sharing of data.",
            "Students aren't ranked against each other. Their rewards compare them only with their own past. In team games, only team totals are shown.",
            "Students never need an email address, phone number, photo or birthday.",
          ]} />
        </Section>

        <Section title="Where it's kept">
          <List items={[
            "The database is Google Firebase (Cloud Firestore), in Google's Melbourne data centre. Everything about classes and students is stored there, in Australia.",
            "Teachers sign in through Firebase Authentication, a Google service that keeps each teacher's sign-in (name and email) on Google's servers, which may be outside Australia.",
            "The app runs on Render, a hosting service whose servers are overseas. Information passes through them on its way to the database but isn't stored there, apart from short-lived server logs that don't include names.",
            "Crash reports go from WordShake's server to its error tracker, which runs on Cloudflare (servers may be outside Australia), keeps them for up to 180 days, and posts each problem to a private Discord channel so it can be fixed.",
            "Everything a student's device loads, including the lettering, comes from WordShake itself, and crash reports go through WordShake too. Students' devices don't contact Google or anyone else.",
          ]} />
        </Section>

        <Section title="Who can see it">
          <List items={[
            "A class's teacher sees their own classes only: names, secret pictures, rounds and progress. No other teacher can.",
            "A signed-in student sees their own progress, stars and word jar on their own device.",
            "During a lesson, the big screen shows the names of students in the game, the answers, and team or whole-class totals. In \"Class together\" games, the words being found appear live.",
            "Rob's Education Tools can reach the database to keep WordShake working, and only looks when that's needed to fix a problem.",
          ]} />
        </Section>

        <Section title="How long it's kept">
          <List items={[
            "Class lists, rounds and progress are kept until the teacher deletes them.",
            "A copy of an open game: until it closes, or 12 hours at most.",
            "Signed-in devices: until the student signs out, the teacher signs the device out, the student is taken off the class list, or the class is deleted.",
            "A class nobody has played or edited for 360 days is deleted automatically, with everything in it.",
          ]} />
        </Section>

        <Section title="Deleting data">
          <List items={[
            <><b style={{ color: "var(--ws-text)" }}>A whole class:</b> in My classes, press Delete. This removes the class list, secret pictures, every saved round and home game, every student's progress, stars and word jar, signs out every device, closes the class's open game and frees the class code. It can't be undone.</>,
            <><b style={{ color: "var(--ws-text)" }}>One round:</b> on the Progress page, delete it from the round history.</>,
            <><b style={{ color: "var(--ws-text)" }}>One student:</b> taking a student off the class list signs out their devices straight away. Their past rounds and progress stay with the class until the class is deleted.</>,
            <><b style={{ color: "var(--ws-text)" }}>A teacher's whole account:</b> in My classes, press Delete my account. This deletes every class (as above), your settings, your name and email, and your sign-in.</>,
            <><b style={{ color: "var(--ws-text)" }}>Families:</b> ask your child's teacher. They can delete your child's data, or take your child off the class list.</>,
          ]} />
        </Section>

      </main>
    </div>
  );
}
