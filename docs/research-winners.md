# HackMIT winners research

Plain-English research on past HackMIT winners (2021-2025) and Cognition/Devin sponsor-prize winners at other hackathons (2025-2026), done for the "warm" CLI project. Public records of HackMIT winners are thin for 2021 and 2022; see section 5 for what was checked and came up empty.

## 1. Winners table

| Year | Project | What it did | Prize | Why it won (if stated) | Source |
|---|---|---|---|---|---|
| 2023 | Muse | AI search over MIT OpenCourseWare video lectures, returns timestamped clips for a question | Grand Prize, 1st overall | Not stated | https://devpost.com/software/muse-z8e04y |
| 2023 | lettuce | Scans grocery receipts, tracks expiration dates, cuts food waste | Grand Prize, 2nd overall | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2023 | BeeMovr | Predicts best relocation sites for beehives using weather data and a honey-yield model | Grand Prize, 3rd overall | Not stated | https://github.com/ericfly02/BeeMovr |
| 2023 | Echo | Biometric multi-factor authentication tool; also pitched as a gamified dashboard of internet history | 1st place, Interactive Media track | Not stated | https://engineering.ucsc.edu/news/cs-student-places-first-at-hackmit/ |
| 2023 | Fluxus | LLM-driven text-to-SQL workspace for healthcare data (InterSystems IRIS backend) | Winner, Health & Accessibility track | Not stated | https://devpost.com/software/fluxus-a4bgv1 |
| 2023 | Handwriting Teacher | AI feedback tool to improve handwriting | Track/beginner winner (exact track not confirmed) | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2023 | Pathosense | Brings emotion recognition into technology | Track/beginner winner (exact track not confirmed) | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2023 | PantryPuzzle | Food sustainability tool | Track/beginner winner (exact track not confirmed) | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2023 | Catmosphere | Cozy multiplayer cat-themed game | Track/beginner winner (exact track not confirmed) | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2023 | InSightAI | Tool to help users follow their curiosity / research assistant | Track/beginner winner (exact track not confirmed) | Not stated | https://hack-mit-2023.devpost.com/project-gallery |
| 2025 | EyeCraft | Minecraft mod letting players with mobility impairments play using facial-feature tracking | Winner, Entertainment track | Not stated | https://www.khoury.northeastern.edu/khoury-undergrads-win-three-categories-at-prestigious-mit-hackathon (article covers 2025 wins) |
| 2025 | Kava | AI tool that generates insurance claims for disaster victims from uploaded documents | Sponsor prize, EigenCloud | Not stated | same as above |
| 2025 | Griddy | Micro-grid powered by homemade iron-air batteries | Winner, Sustainability track | Not stated | same as above |
| 2025 | RAREPATH | Matches rare-disease patients to clinical trials by reading ClinicalTrials.gov and PubMed eligibility criteria and explaining them in plain language | Sponsor prize, Cognition "Best Agent Hack" ($9,000 value: cash + Devin Team + Windsurf Pro), AI Agent & Infra Hackathon (not HackMIT; Lux Capital/Modal/Cognition/AWS event, Aug 12-14 2025) | Not stated | https://devpost.com/software/rarepath |
| 2025 | Code Canary | Dependency/supply-chain vulnerability scanner using SBOM analysis and threat intel | Winner, Best Overall Hack + 2nd, Best Use of Modal, AI Agent & Infra Hackathon (not HackMIT) | Not stated | https://devpost.com/software/code-canary |
| 2025 | Distillery | CLI tool to distill a large model's outputs into a small cheap fine-tuned model for agent workloads | Winner, Best Use of Modal, AI Agent & Infra Hackathon (not HackMIT) | Not stated | https://ai-agent-infra.devpost.com/project-gallery |
| 2024 | Get Away | Web app for cyclists/pedestrians: mark unsafe areas, calculates and shares safer routes | Winner, Best Beginner Hack, 1st place | Team mostly first-time hackers; judges cited the app addressing a problem the team had personally lived ("faced vulnerable situations as pedestrians or cyclists") | https://conecta.tec.mx/en/news/monterrey/education/tec-student-wins-award-road-safety-project-hackmit-2024 |
| 2024 | (team not identified in public sources) | Sustainability-track project built on Palantir Foundry as its backend | Sustainability Grand Prize + 3 separate sponsor challenge prizes | Not stated (Palantir CTO noted only that they used Foundry as the backend) | https://x.com/ssankar/status/1836076339691999679 |
| 2025 | Marvis | AI handyman assistant for smart glasses: scans a barcode, gives step-by-step AR assembly/repair instructions, built across two different smart-glasses models at once | 1st place, Mentra (sponsor) track | Team quote: "Using both of the glasses together really separated us from the crowd, along with being able to pitch really well"; judges are described as rewarding practical, demoed utility over "impressive technology but questionable real-world utility" | https://experience.mcintire.virginia.edu/news/pierce-brookins-earns-top-spot-hackmit-event/ |

## 2. Patterns across overall winners

Coverage note first: public records of HackMIT winners are thin and inconsistent by year. 2023 is well documented (Devpost ran the gallery with winner badges). 2025 is documented through university press releases and one sponsor's X thread. 2024 is documented only in fragments (one sponsor tweet, one student's own university writing it up, sponsor prize-tier pages with no names attached). I could not find any winner names for 2021 or 2022 through Devpost, archive.hackmit.org, Wikipedia, GitHub, or search. HackMIT's own site (archive.hackmit.org) never lists winners at all; it is a marketing splash page per year, plus a client-rendered app with no results baked in.

Within what is documented:

- Every overall/track winner found is a software project. No hardware build won a headline prize in any year I could confirm, though two 2025 winners (Marvis, EyeCraft) build on top of existing hardware (smart glasses, facial-tracking input) rather than being pure software.
- Winners solve a specific, named person's problem, not a generic technical capability. lettuce (food waste from a grocery receipt), BeeMovr (where to relocate a beehive), Kava (insurance claims after a wildfire), RAREPATH (matching a rare-disease patient to a trial), Get Away (a safer bike route), Griddy (a home micro-grid). The track names themselves (Sustainability, Health & Accessibility, Education, Interactive Media, Entertainment) push toward "who does this help" rather than "what technique does this use."
- Where a reason for winning was stated (Marvis, Get Away), it was about the demo and the personal stakes, not the model or architecture. Marvis's team credited combining two hardware devices live on the table and pitching well; the university writeup on Marvis explicitly framed the win as "practical design grounded in actual user needs, distinguishing it from projects with impressive technology but questionable real-world utility." Get Away's writeup credited the team building something they had personally needed.
- Teams are small where team size is documented: Kava (2 people), Fluxus (4 people), RAREPATH and Marvis (multi-person, exact count not given but described as small).
- Dev-tools-for-developers projects (Muse, an OCW search tool; Fluxus, a healthcare data workspace) do appear among HackMIT's own overall/track winners, but they still wrap the "tool" in a specific end-user's workflow (a student searching lecture clips, a hospital worker querying records) rather than presenting as infrastructure for other builders.

## 3. Patterns across sponsor-prize winners

- Sponsor prizes go to whoever used that sponsor's product as a real dependency, not to the most original idea in the room. Fluxus won Health & Accessibility partly by choosing InterSystems IRIS as its database, matching InterSystems' own sponsor challenge. The 2024 Sustainability Grand Prize winner is called out by Palantir's own CTO for one reason: they "used Foundry as their backend." Sponsor judging rewards integration depth with the sponsor's stack over novelty.
- Cognition/Devin sponsor prizes were not found at HackMIT itself in any year 2021-2026 in public sources. I checked archive.hackmit.org for each year, HackMIT's partners page, an older HackMIT sponsor-challenge page, and direct search for "Cognition," "Devin," "OpenAI," "Warp," and "The Token Company" as HackMIT sponsors, and found no match. The partners page I could reach is also stale (its sponsor list is Facebook/Nasdaq/DocuSign-era, not current), so this is a gap in what is public, not proof the prizes don't exist for HackMIT 2026 specifically.
- Where Cognition/Devin prizes do show up, at other 2025-2026 hackathons, the pattern is consistent: a modest cash tier ($500-3,000) bundled with a year of Devin Team/Devin credits and a year of Windsurf Pro, explicitly scoped as "make AI coding agents measurably more capable" (LA Hacks 2026 wording) or "Best Agent Hack" (AI Agent & Infra Hackathon, Aug 2025, co-hosted by Lux Capital, Modal, Cognition, and AWS).
- The one confirmed Cognition "Best Agent Hack" winner I found, RAREPATH, is a vertical AI agent (matches rare-disease patients to clinical trials) with a plain-language pitch, not a meta tool about coding agents. But the other finalists at that same event, judged under the same Cognition-adjacent AI-infra panel, were Code Canary (a dependency/supply-chain security scanner) and Distillery (a CLI that distills a large model down to a small one for cheaper agent runs) — both are developer-infrastructure tools with no consumer-facing story, and both won prizes (Code Canary: Best Overall + 2nd Best Use of Modal; Distillery: Best Use of Modal). So a benchmark-and-CLI-shaped submission does win at AI-agent/infra-focused events run by Cognition-adjacent judges, even though it would not fit HackMIT's own general track judging described in section 2.

## 4. Assessment against "warm"

Plainly: warm does not look like what wins HackMIT's own overall or track prizes, and it looks like a strong fit for the AI-coding-agent sponsor prizes specifically.

Every HackMIT overall/track winner found in section 1 is judged on a demoable, personally-felt human problem: food waste, a beehive, a bike route, a wildfire insurance claim, a rare-disease trial. warm's problem (a coding agent re-learns a task it already did, wasting tokens and time) is real, but it is a problem for a person building or running agents, not a problem a track judge experiences directly. warm's own headline evidence, a projection to a fleet of 9,000 sessions, is a business chart, not a demo. Section 2 found that even a stated reason for winning (Marvis) explicitly warned against "impressive technology but questionable real-world utility" — a token/tool-call/time savings percentage, unaccompanied by a felt before/after, reads exactly like that to a general judge.

That same framing is warm's strength in front of the right sponsors. Section 3 found that Cognition's own prize criteria at other 2025-2026 events is close to word-for-word warm's premise: "make AI coding agents measurably more capable" (LA Hacks 2026), and that Cognition-adjacent judges have already rewarded a CLI-shaped, no-consumer-story submission (Distillery, a model-distillation tool) and an overall winner that was pure developer infrastructure (Code Canary, a vulnerability scanner). warm fits that bar directly: it targets Devin CLI as one of its three integrations, measures the exact thing Cognition asks for, and is itself the kind of tool another builder would install, not a thing a disaster victim or a beekeeper would use.

Most likely to win: Cognition's "Best Use of Devin" and The Token Company's LLM-cost-saving prize, roughly tied. Devin CLI is one of warm's three named targets, and Cognition's own public prize language elsewhere rewards exactly this shape of submission. The Token Company's prize is about LLM cost saving, and warm's core reported number, cold-vs-warm token and cost savings, is about as literal a match to that prize's stated criteria as a submission can be.

Least likely to win: HackMIT's own general track prizes and overall Grand Prize (1st/2nd/3rd), for the reasons above, and OpenAI's prize specifically. I could not find or confirm OpenAI's actual judging criteria at HackMIT, but Codex is one of three agent backends warm treats as interchangeable, not a showcase of something distinctive to OpenAI's own product the way sponsor prizes historically reward (section 3: sponsor prizes go to whoever leans hardest on that one sponsor's stack). Warp's "Best Developer Tool" sits in between: plausible given warm is, in fact, a developer tool, but Warp's prize has historically gone to something with a visible, clickable interface, and warm's own artifact is closer to a hook and a benchmark log than a tool someone opens and uses by hand.

What past judges wanted to see on the table, based on the evidence above:
- A live, on-the-spot side-by-side: run the same coding task cold, then run it warm, in front of the judge, the way Marvis's team demoed two physical devices together rather than only presenting slides. Nick Singh's hackathon-judging writeup (a general source, not HackMIT-specific, but consistent with what the HackMIT winners above describe) makes the same point: judges reward projects they can interact with, not just watch.
- One sentence a non-developer judge could repeat back, before the token/tool-call numbers: what the agent had to relearn, and what it skipped the second time. Every HackMIT winner found had a one-line human stakes statement (a beehive, a wildfire, a rare disease); warm needs the equivalent for "the agent already knew how to do this."
- The 9,000-session fleet projection belongs on a slide after the live demo, not instead of it. It is exactly the kind of aggregate, unfelt number that section 2's evidence suggests general judges discount, and exactly the kind of evidence a sponsor-prize judge (Cognition, The Token Company) is likely to ask for once the live demo has made the case.
- For Cognition's table specifically: show it actually driving Devin CLI live, since the one confirmed Cognition sponsor-prize winner (RAREPATH) and the general sponsor-prize pattern in section 3 both reward whoever visibly uses the sponsor's own product, not whoever describes supporting it in principle.

## 5. Sources

HackMIT winners:
- https://devpost.com/software/muse-z8e04y
- https://hack-mit-2023.devpost.com/project-gallery
- https://github.com/ericfly02/BeeMovr
- https://engineering.ucsc.edu/news/cs-student-places-first-at-hackmit/
- https://devpost.com/software/fluxus-a4bgv1
- https://community.intersystems.com/post/intersystems-hackmit-2023
- https://conecta.tec.mx/en/news/monterrey/education/tec-student-wins-award-road-safety-project-hackmit-2024
- https://x.com/ssankar/status/1836076339691999679
- https://innovationlab.fetch.ai/events/hack-mit-2024-2 (Fetch.ai's own HackMIT 2024 prize-tier page; no winner names given)
- https://www.khoury.northeastern.edu/khoury-undergrads-win-three-categories-at-prestigious-mit-hackathon (covers HackMIT 2025: EyeCraft, Kava, Griddy)
- https://experience.mcintire.virginia.edu/news/pierce-brookins-earns-top-spot-hackmit-event/ (Marvis, HackMIT 2025)
- https://archive.hackmit.org/2021/, /2022/, /2023/, /2024/, /2025/ (checked for winners; none listed, these are marketing pages only)
- https://partners.hackmit.org/ and http://techx.io/hackmit-dayof/challenges (checked for Cognition/Devin/OpenAI/Warp/Token Company sponsorship; both appear to be stale archives, no match found)

Cognition/Devin sponsor prizes at other hackathons, 2025-2026:
- https://ai-agent-infra.devpost.com/ (AI Agent & Infra Hackathon, Lux Capital/Modal/Cognition/AWS, Aug 12-14 2025; prize tiers)
- https://ai-agent-infra.devpost.com/project-gallery (winner badges)
- https://devpost.com/software/rarepath (Best Agent Hack winner)
- https://devpost.com/software/code-canary (Best Overall + 2nd Best Use of Modal)
- https://devpost.com/software/distillery (Best Use of Modal)
- https://live.calhacks.io/prizes (Cal Hacks 12.0 sponsor list; no Cognition/Devin prize found)
- https://live.hackberkeley.org/ (Hackathons @ Berkeley AI Hackathon, June 20-21 2026; Cognition "Best Use of Cognition" prize listed, not yet run at time of writing)
- LA Hacks 2026 Cognition track: "make AI coding agents measurably more capable," $3,000/$2,000/$1,000 + Devin ACUs + Windsurf Pro (found via search summary of LA Hacks 2026 Devpost/prize pages; specific winner not confirmed)

General hackathon-judging pattern (not HackMIT-specific, used only for the demo-table advice in section 4):
- https://www.nicksingh.com/posts/win-hackathons-a-how-to-guide

Searched but inconclusive or dead ends (listed for transparency): archive.hackmit.org/2021 and /2022 (no winners listed anywhere found), HackMIT Wikipedia page (no year-by-year winners), HackMIT Instagram posts (blocked from fetching without login), devpost.com/software/graphmymind and /software/muse-59c0nl (404), several guessed HackMIT devpost URLs for 2021/2022/2024 (all 404, suggesting those years did not use Devpost).
