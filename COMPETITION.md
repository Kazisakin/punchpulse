# PunchPulse: Meta VR Start Developer Competition 2026

**Deadline: November 18, 2026, 12:00 PM PST (4:00 PM in New Brunswick).** You can't edit your entry after that.
Rules: https://start-developer-competition-26.devpost.com/rules

## Your entry
| Field | Value |
|---|---|
| Track | **Gaming** |
| Division | **New Experience** (PunchPulse was created on Oct 25, 2026, after the Sept 24 start) |
| Special awards it fits | Reason to Come Back · Best First Five Minutes · Accessibility Forward |
| Build link | https://kazisakin.github.io/punchpulse/ (WebXR, opens in the Quest Browser) |

## Checklist
- [ ] **Join Meta VR Start.** You must be a member before you submit (developers.meta.com → VR Start).
- [ ] **Test hands-only on a Quest.** Put the controllers down and play a whole session, including the menus, using only your hands.
- [ ] **Record the video** (under 3 minutes, see the script below) and upload it to YouTube as **Public** or **Unlisted**.
- [ ] **Fill in the Devpost form** with the text below.
- [ ] Optional: create a release channel named **"Competition"**, push build 1.0.0 to it, and include its invite URL as a second way in.
- [ ] Submit at least a day early.

## Devpost form text

**Name:** PunchPulse

**Tagline (140 characters max):**
> A hands-first rhythm boxing workout: punch, uppercut, block and dodge to the beat, in VR or in your own room.

**Description (about 500 words):**

> **PunchPulse turns your living room into a neon boxing ring, and you only need your hands.**
>
> Glowing targets fly toward you on the beat of an original electronic soundtrack. Punch red targets with your left fist and blue targets with your right. Swing upward through arrow targets for uppercuts, raise both fists to block the purple guard bars, and duck or lean to dodge incoming walls. Every move is real exercise, and the game tracks your estimated calories as you go.
>
> **Built hands-first.** PunchPulse is fully playable without controllers, from the first menu to the last punch. Your tracked hands become glossy boxing gloves, and punches are measured from your knuckles with velocity-based detection, so a real jab counts and a resting hand doesn't. Menus can be punched, poked, or pointed at with a pinch. Controllers work too, and you can switch between hands and controllers at any time.
>
> **A great first five minutes.** A one-minute interactive tutorial teaches each move with live hints, then drops you straight into a workout. Timing rings shrink onto each target to show exactly when to strike, and PERFECT / GREAT / GOOD feedback, combo multipliers and haptic hits make every punch feel good.
>
> **A reason to come back every day.**
> - A daily challenge: the same workout for everyone each day, harder on weekends
> - Streaks that reward consistency
> - Guided programs (7-Day Starter, Cardio Blast, Fight Camp) that progress session by session
> - 15 achievements, a weekly calorie chart, and lifetime stats
> - Four difficulty levels, from Easy to Expert
>
> **Accessible by design.** A Seated mode keeps every target within reach and removes dodge walls, so PunchPulse works from a chair or wheelchair. Easy mode slows targets and widens hit zones, menus work with pinch, poke or point, and colour is never the only cue: uppercuts carry arrows, blocks have a distinct shape, and walls are labelled DUCK or LEAN.
>
> **Mixed Reality or full VR.** Play in a glowing synthwave arena with a music-reactive equalizer and a floor that pulses on every beat, or switch to Mixed Reality and fight targets floating in your own room through passthrough. Three arena themes: Synthwave, Ocean and Deep Space.
>
> **Technical highlights**
> - WebXR + Three.js with hand-tracking joints, immersive-ar passthrough, and a fallback to immersive-vr
> - Procedural music generated in real time with the Web Audio API: 6 original tracks, no licensed audio, and the beat drives targets, visuals and the equalizer
> - Seeded, beat-locked chart generation, so daily challenges are identical for every player
> - Pooled objects, instanced meshes and cheap glow shaders, around 70 draw calls for a steady 72+ FPS on Quest 2
> - Works offline after first load; no accounts and no data collection
>
> PunchPulse was designed, built and shipped by a solo developer, a computer science student, and it's already set up for the Meta Horizon Store as a Progressive Web App with an optional one-time Pro upgrade.

## Video script (about 2:30)
You can film it in the **Immersive Web Emulator** if you don't have a Quest yet; the rules allow emulator footage. Real headset footage looks better, though.

| Time | Shot | Voice-over or on-screen text |
|---|---|---|
| 0:00–0:08 | Title, then a fast montage of punches with sparks | "PunchPulse: a hands-first rhythm boxing workout." |
| 0:08–0:25 | Controllers put down, bare hands turn into gloves, poking QUICK PLAY | "No controllers needed. Your hands become the gloves." |
| 0:25–0:50 | The tutorial: hints for punch, uppercut, block, duck, lean | "A one-minute tutorial teaches every move." |
| 0:50–1:20 | Hard-mode gameplay with combos, PERFECT popups and the equalizer | "Every target lands on the beat of an original soundtrack." |
| 1:20–1:40 | Switch to Mixed Reality, targets in your room | "Play in VR, or right in your own room." |
| 1:40–1:55 | Seated mode | "Seated mode makes it accessible to everyone." |
| 1:55–2:15 | Daily challenge, streak, Programs page, Stats page with chart and achievements | "Daily challenges, streaks, programs and achievements keep you coming back." |
| 2:15–2:30 | Results screen with the S grade, then the logo | "PunchPulse. Punch to the beat." |

## Judging criteria and how PunchPulse covers them
- **Innovation and creativity:** a hands-first boxing workout with uppercut, block and dodge mechanics, and procedurally generated music.
- **Experience design:** the tutorial, timing rings, grades, programs and daily loop.
- **Technical implementation:** hand-joint punch detection, Mixed Reality passthrough, seeded charts and Quest-friendly rendering.
- **Polish and presentation:** the neon art direction, 3 themes, music-reactive visuals, haptics and sound design.
