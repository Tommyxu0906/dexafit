# What each profession must upload — Massachusetts

Researched 23 September 2026 against the Massachusetts statutes and the CMRs,
not from memory. Every rule below cites where it came from, so when a rule
changes the citation is where to check rather than a guess.

Massachusetts is the only researched jurisdiction. Every other state falls
through to generic labelling and manual review, which is deliberate: asserting
unverified rules is worse than admitting we have not checked.

The rules themselves live in `src/lib/domain/requirements.ts` and are asserted
in `src/lib/domain/__tests__/requirements.test.ts`. This document explains
*why*; that code is what actually runs.

---

## First, what Massachusetts licenses at all

The claim "Massachusetts does not license personal trainers" is a negative, and
negatives are the easy thing to get wrong by assumption. It was checked by
enumerating the state's own list of health-care licences rather than by failing
to find one.

The Bureau of Health Professions Licensure and the Board of Registration in
Medicine license: nursing, pharmacy, dentistry, chiropractic, **dietitians and
nutritionists**, hearing instrument specialists, **physician assistants**,
genetic counsellors, perfusionists, respiratory care, nursing home
administrators, community health workers, podiatry, dispensing opticians,
optometry, psychology, **allied health** (physical therapists, occupational
therapists, **athletic trainers**), social work, speech-language pathology and
audiology, allied mental health, nurse aides, physicians and acupuncturists.

Not on that list, and therefore not licensed in Massachusetts:

- personal trainer
- strength and conditioning coach
- exercise physiologist
- health and wellness coach
- nutrition coach

For these five, every credential DexaFit asks for is **marketplace policy, not
state law**, and the UI must never imply otherwise. That distinction is carried
by the `legalRequirement` / `marketplaceRequirement` pair on every requirement.

---

## The table

`L` = required by Massachusetts law. `M` = required by DexaFit policy only.

| Profession | State licence | Other required uploads | Notes |
| --- | --- | --- | --- |
| Personal trainer | — | National fitness certification (M), CPR/AED (M) | Not licensed in MA |
| Strength & conditioning coach | — | S&C / sports performance certification (M), CPR/AED (M) | Unrecognised certifier → human review, not rejection |
| Exercise physiologist | — | Exercise physiology certification (M), CPR/AED (M) | Not licensed in MA. Louisiana is the only state that licenses these |
| Health & wellness coach | — | Coaching certification (M) | Scope acknowledgement required |
| Nutrition coach | — | Nutrition coaching certification (M) | See the title-protection note below |
| Dietitian / nutritionist | **LDN licence (L)** | — | RD/RDN is asked separately; it is not the licence |
| Physical therapist | **PT licence (L)** | — | Direct access; no referral or supervision required |
| Athletic trainer | **AT licence (L)** | BOC certification (**L**), Emergency Cardiac Care / CPR (**L**), **directing physician or dentist agreement (L)** | **Practice-setting restriction — see below** |
| Physician | **Full licence (L)** | — | Malpractice insurance is a licensure condition, see below |
| Nurse practitioner | **RN licence (L) + APRN authorization (L)** | National APRN certification (L) | Independent practice after 2 years supervised |
| Physician assistant | **PA licence (L)** | NCCPA certification (L), **supervising physician guidelines (L)** | Supervision is continuous but not physically present |
| Other | — | Any relevant credential | Always human review |

---

## The findings that changed the code

### 1. Athletic trainers cannot take the general public

This is the sharpest conflict between Massachusetts law and an open
marketplace, and the previous rules missed it entirely.

**M.G.L. c. 112, § 23A** defines an athletic trainer as one

> "who limits his practice to schools, teams or organizations with whom he is
> associated and who is under the direction of a physician or dentist duly
> registered in the commonwealth"

**259 CMR 4.02(2)** says the same thing operationally:

> "An athletic trainer renders service or treatment under the Direction of a
> Physician or Dentist with respect to the Athletes involved with the schools,
> teams or organizations with whom the Athletic Trainer is Associated"

259 CMR 4.01 defines *Associated* as "Professionally recognized, contracted,
employed or partnered with a school, team, or organization for the delivery of
Athletic Training services", and *Athlete* as "An individual who prepares for or
participates in sports activities".

So a Massachusetts AT cannot simply accept a member of the public who walked in
after a DEXA scan. Whether DexaFit lists athletic trainers at all — and under
what framing — is a **product and legal decision, not one this codebase should
make**. The rules therefore state the restriction and route every AT
application to a human. `independentListingAllowed` is deliberately left `true`:
barring them outright would be inventing policy just as much as ignoring the
statute would be.

**Open question for DexaFit:** do we list athletic trainers in Massachusetts,
and if so how does a marketplace customer become an "athlete of an associated
organization"?

### 2. An athletic trainer's BOC and CPR are law, not our preference

**259 CMR 4.03(2)** — as a condition of renewal the licensee must

> "provide proof of the following certifications in effect for the entire
> renewal period: (a) Emergency Cardiac Care certification; and (b) BOC
> Certification."

The previous rules marked BOC as a marketplace requirement and did not ask
athletic trainers for CPR at all. Both are now legal requirements.

### 3. A written directing-clinician agreement is an uploadable document

**259 CMR 4.02(3)**:

> "An athletic trainer must establish an agreed upon relationship with a
> Physician or Dentist that provides Direction for the Athletic Trainer's
> actions and responsibilities and must be able to provide written proof thereof
> upon request."

That written proof is a credentialing artefact and is now collected as one
(`SUPERVISION_AGREEMENT`).

### 4. Physician assistants practise under signed written guidelines

**263 CMR 5.00**: all professional activities of a PA are supervised by a
supervising physician; supervision is continuous but does not require physical
presence; the guidelines must be "in writing and must be signed by both the
supervising physician and the physician assistant" and "reviewed annually and
dated and initialed by both".

Unlike the athletic trainer rule this does not confine a PA to a setting, so it
is a document to collect rather than a reason to send every PA to a human. The
annual review date is collected as the expiration, which means the existing
30-day expiry warning covers it for free.

### 5. Nutrition is title-protected, not practice-protected

**M.G.L. c. 112, § 206**:

> "No person shall hold himself out to be a licensed dietitian/nutritionist
> unless so licensed under the applicable provisions of this chapter."

with exemptions that expressly include "furnishing information regarding food,
food material, or dietary supplements". § 209 makes *acting or purporting to act
as a licensed dietitian/nutritionist* without a licence a misdemeanour.

So an unlicensed nutrition coach is lawful in Massachusetts provided they do
not hold themselves out as licensed. Keeping nutrition coach and dietitian as
separate professions is correct, and the existing scope acknowledgement is the
right shape.

**Two cautions this raises, neither of which is a code change:**

- § 201 defines the regulated field to include "assessing nutritional needs
  using biochemical and clinical data" and "developing and monitoring nutrition
  care plans". DexaFit hands a coach body-composition and metabolic
  measurements. A nutrition coach building a plan *from those numbers* is closer
  to that definition than one giving general food information. Worth a lawyer's
  eye before marketing nutrition coaches as scan-interpreting.
- The "holding out" can be created by the marketplace rather than the coach. If
  DexaFit lists a nutrition coach and an LDN under one "Nutrition" heading with
  matching badges, the presentation is ours. A display distinction between
  licensed and certified providers is a product requirement, not decoration.

### 6. Physicians already have a statutory insurance floor

Massachusetts requires an active licensee in direct or indirect patient care to
carry malpractice cover of at least **$100,000 / $300,000** (Board of
Registration in Medicine, under M.G.L. c. 112, § 2).

Insurance minimums were logged as an undecided DexaFit policy question. For
physicians, part of it is already decided by the state. The code does **not**
enforce this — `src/lib/domain/schemas.ts` still collects amounts without a
minimum — because whether DexaFit enforces a floor, and at what level for
everyone else, remains a policy decision.

### 7. A shared credential must not be downgraded by the laxer profession

Not a Massachusetts finding but surfaced by one. `stricter()` merged two
professions' claims on the same credential but took `legalRequirement` from
whichever profession was read first. Once an athletic trainer's CPR became a
legal requirement, a personal trainer **and** athletic trainer would have been
told their CPR card was DexaFit policy — understating a legal obligation purely
because of array order. Both flags now merge upward.

---

## Renewal cycles, for the expiry warnings

| Licence | Cycle | Anchor |
| --- | --- | --- |
| Physical therapist | Biennial | Licensee's birthday |
| Athletic trainer | Biennial | Licensee's birthday |
| Physician | Biennial | Licensee's birthday |
| Physical therapy facility | Annual | Issue-date anniversary |

Massachusetts anchors these to the licensee's birthday rather than a fixed
state-wide date, so expirations are spread across the year and the daily
expiry-warning job will find work most days rather than in bursts.

---

## What was checked and found correct

Not everything was wrong. These were verified rather than assumed:

- Physical therapists have **direct access** in Massachusetts. 259 CMR 5.00
  contains no referral requirement, and the PT determines their own PT diagnosis
  and plan of care. Independent listing is correct.
- Dietitian licensure sits with its own Board of Registration of Dietitians and
  Nutritionists, and is a separate credential from RD/RDN registration by the
  Commission on Dietetic Registration. Asking them separately is correct.
- Nurse practitioners need an RN licence, APRN authorization, and current
  national certification, and may practise independently after two years of
  supervised practice. Prescriptive authority additionally requires an MCSR —
  deliberately **not** collected, because DexaFit does not involve prescribing.
- Exercise physiologists are not licensed in Massachusetts.

---

## Still open

- **Do we list athletic trainers in Massachusetts at all?** (finding 1)
- Does DexaFit enforce an insurance minimum, and is it the physicians'
  statutory $100k/$300k or something of our own? (finding 6)
- Does a nutrition coach interpreting DEXA output stay inside the § 206
  exemption? (finding 5)
- How are licensed and non-licensed providers visually distinguished on the
  public marketplace? (finding 5)
- What happens when a credential actually expires. Only the 30-day warning is
  decided.

## Sources

- [M.G.L. c. 112, § 23A — allied health definitions](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section23A)
- [M.G.L. c. 112, § 201 — dietetics definitions](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section201)
- [M.G.L. c. 112, § 206 — holding out; exemptions](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section206)
- [M.G.L. c. 112, § 2 — physician registration and insurance](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section2)
- [259 CMR 4.00 — athletic trainers](https://www.mass.gov/regulations/259-CMR-400-athletic-trainers)
- [259 CMR 5.00 — physical therapists](https://www.mass.gov/regulations/259-CMR-500-physical-therapists)
- [263 CMR 5.00 — PA scope of practice](https://www.mass.gov/regulations/263-CMR-500-scope-of-practice-employment-of-physician-assistants-and-standards-of-conduct)
- [244 CMR 4.00 — advanced practice registered nursing](https://www.mass.gov/regulations/244-CMR-400-advanced-practice-registered-nursing)
- [Board of Allied Health advisory on athletic trainer requirements](https://www.mass.gov/policy-statement/advisory-on-massachusetts-requirements-for-being-an-athletic-trainer)
- [Fees and licence renewal schedules, allied health](https://www.mass.gov/info-details/fees-and-license-renewal-schedules-for-allied-health-professionals)
- [Massachusetts health care licences — the full list](https://www.mass.gov/topics/health-care-licenses)
