# Sadhana Record — the real-phone check before release

**IYF Delhi · for whoever does the check · Phase 9, 10 Oct 2026 · about 30 minutes**

The automatic tests have passed: 1,799 browser checks, plus Safari and Chrome on phone simulators. What a computer cannot judge is how the app feels with a **screen reader** (TalkBack, VoiceOver) and on a **real, slow Android phone**. This check covers that.

You use the **new version with practice data**. Nothing you do reaches the live app or anyone's real account.

---

## 1. Before you start

- Ask the app team to start the practice version. They will give you an address like `http://192.168.1.20:5195`.
- Your phone must be on the **same Wi-Fi** as the team's laptop.
- Open the address in **Chrome** (Android) or **Safari** (iPhone).
- Practice logins:

| Who | Login | Password |
|---|---|---|
| Devotee (also a group leader) | 6000000001 | pass-12345 |
| Coordinator (SPS) | sps | sps-pass-12 |
| IYF head | master | master-pass-1 |

## 2. Turn on the screen reader

- **Android, TalkBack:** Settings › Accessibility › TalkBack › On. Swipe right or left to move between items; double-tap to press.
- **iPhone, VoiceOver:** Settings › Accessibility › VoiceOver › On. Swipe right or left to move; double-tap to press.

## 3. The five things to do

For each one, write **OK**, or what went wrong: something not read out, read out wrongly, a button you could not reach, or a step where you got lost.

| # | Do this | It is OK when… |
|---|---|---|
| 1 | **Sign in** as the devotee. | Each field and the Sign in button are read out with their names; a wrong password is read out. |
| 2 | **Fill today**: sleep and wake time, rounds, hearing, reading, service; Save. | Every question is read out; the time wheel can be set and closed; "Saved" is announced. |
| 3 | **Submit the week** (open the week; if Submit is not open yet, note what is read out instead). | The checklist of what is missing is read out; Submit (when open) works. |
| 4 | Sign out; sign in as the **coordinator**; **approve a sign-up** under Requests. | The request is read out with the name and batch; Approve works and is announced. |
| 5 | As the coordinator, **mark attendance** for two devotees. | Each devotee's name and Present / Absent are read out; the change is announced. |

Also try once:

- Open any pop-up sheet (for example "How your day is scored"), then close it with the phone's **Back** (Android) or the **two-finger scrub** (iPhone).
- Turn the screen reader off and **double the text size** in the phone's settings. Check that nothing overlaps or is cut off on Home, the day form and the week.

## 4. The slow phone

On the oldest, cheapest Android phone you have (2–3 GB of memory), **without** the screen reader:

- Open the app; sign in as the devotee; fill a day; open the week; open Report.
- Note anything that takes **more than 3 seconds**, or any screen that stutters while scrolling.

## 5. Send back

A photo or a message with the results of the five steps (OK, or what went wrong), the two "also try" checks, and the slow phone. The team fixes anything found, runs the full automatic test again, and only then releases.
