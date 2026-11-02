# Links to check (for the IYF head)

Made 3 Oct 2026 from the hearing journals and the IYF Drive folders, read-only. Everything else is linked to its own file:
- **895 of 972 lectures** open their own recording (325 were already file links; 570 were folder links matched to the one file in that folder whose number equals the lecture number).
- **75 of 76 books** open their own PDF (97 files; multi-volume books list each volume).

Nothing below was guessed. Fixing a row: put the lecture's own Drive file link in the journal Excel (or tell the developer), then run `node setup/match-lectures.mjs && node setup/build-links-sql.mjs` and apply the new migration.

## Book with no PDF in the IYF folder

| Book | Note |
|---|---|
| B57 Teachings of Lord Chaitanya (BSS/BVS) | No such PDF in the Online Book Link folder; the closest file is *Teachings of Lord Kapila*, a different book. Add the PDF to the folder. |

## Lectures that open a folder (53)

The app shows **Open folder** with a hint to pick the file by name.

| Lecture | Week | Title | Why |
|---|---|---|---|
| SD-W002-LOW1 | SPS/DPS wk 2 LOW 1 | Dealing with Parents, Relative and Friends 2 | title has no lecture number |
| SD-W018-LOW1 | SPS/DPS wk 18 LOW 1 | Peace and Greed are Incompatible (English) | title has no lecture number |
| SD-W021-LOW1 | SPS/DPS wk 21 LOW 1 | 41. Importance of Chanting Hare Krishna Mahamantra - Part 1 | no file starts with 1 |
| SD-W022-LOW1 | SPS/DPS wk 22 LOW 1 | 41. Importance of Chanting Hare Krishna Mahamantra - Part 3 | no file starts with 3 |
| SD-W061-LOW1 | SPS/DPS wk 61 LOW 1 | Ayodhya Camp_2017_Lecture 4 | no file starts with 4 |
| SD-W071-LOW1 | SPS/DPS wk 71 LOW 1 | Janmashtami Bhagavat Katha_Hg SGP Ji_Aug 2018_Lecture 2 | no file starts with 2 |
| SD-W076-LOW1 | SPS/DPS wk 76 LOW 1 | Udupi Yatra_13 to 21 Jan 2019_Lecture 4 | no file starts with 4 |
| SD-W079-LOW1 | SPS/DPS wk 79 LOW 1 | Mayapur Yatra_22 to 28 Jan 2018_Lecture 6 | no file starts with 6 |
| SD-W081-LOW1 | SPS/DPS wk 81 LOW 1 | Kurukshetra, Mayapur, Jaipur and Jagganath Puri Lila Sthalis_1 | 4 files start with 1 |
| SD-W001-LOW2 | SPS/DPS wk 1 LOW 2 | Dealing with Parents, Relative and Friends 1 | title has no lecture number |
| SD-W020-LOW2 | SPS/DPS wk 20 LOW 2 | 40. Advantages and challenges in BACE | title has no lecture number |
| SD-W021-LOW2 | SPS/DPS wk 21 LOW 2 | 41. Importance of Chanting Hare Krishna Mahamantra - Part 2 | no file starts with 2 |
| SD-W022-LOW2 | SPS/DPS wk 22 LOW 2 | 41. Importance of Chanting Hare Krishna Mahamantra - Part 4 | no file starts with 4 |
| SD-W060-LOW2 | SPS/DPS wk 60 LOW 2 | Ayodhya Camp_2017_Lecture 3 | no file starts with 3 |
| SD-W070-LOW2 | SPS/DPS wk 70 LOW 2 | Janmashtami Bhagavat Katha_Hg SGP Ji_Aug 2018_Lecture 1 | no file starts with 1 |
| SD-W071-LOW2 | SPS/DPS wk 71 LOW 2 | Janmashtami Bhagavat Katha_Hg SGP Ji_Aug 2018_Lecture 3 | no file starts with 3 |
| SD-W075-LOW2 | SPS/DPS wk 75 LOW 2 | Udupi Yatra_13 to 21 Jan 2019_Lecture 3 | 2 files start with 3 |
| SD-W079-LOW2 | SPS/DPS wk 79 LOW 2 | Mayapur Yatra_22 to 28 Jan 2018_Lecture 7 | no file starts with 7 |
| SD-W081-LOW2 | SPS/DPS wk 81 LOW 2 | Kurukshetra, Mayapur, Jaipur and Jagganath Puri Lila Sthalis_2 | 5 files start with 2 |
| BSS-W020-SPL | BSS wk 20 SPL | BG Ch 4_Lecture 6 | no file starts with 6 |
| BSS-W010-LOW1 | BSS wk 10 LOW 1 | Vraja Dhama Lila Sthalis_Lecture 1 to 8 | title has no lecture number |
| BSS-W021-LOW1 | BSS wk 21 LOW 1 | Braja Lila Sthalis_Lecture 1 to 4 | title has no lecture number |
| BSS-W032-LOW1 | BSS wk 32 LOW 1 | Vraja Dhama Lila Sthalis_Lecture 9 to 16 | title has no lecture number |
| BSS-W043-LOW1 | BSS wk 43 LOW 1 | Vraja Dhama Lila Sthalis_17 to 24 | title has no lecture number |
| BSS-W055-LOW1 | BSS wk 55 LOW 1 | Braja Lila Sthalis_Lecture 25 to 35 | title has no lecture number |
| BSS-W065-LOW1 | BSS wk 65 LOW 1 | Mayapur Yatra _ 22 to 28 jan 2018_Lila Sthali Glorification 1 | title has no lecture number |
| BSS-W081-LOW1 | BSS wk 81 LOW 1 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 19 | no file starts with 19 |
| BSS-W010-LOW2 | BSS wk 10 LOW 2 | Vraja Dhama Lila Sthalis_Lecture 1 to 8 | title has no lecture number |
| BSS-W021-LOW2 | BSS wk 21 LOW 2 | Braja Lila Sthalis_Lecture 1 to 4 | title has no lecture number |
| BSS-W032-LOW2 | BSS wk 32 LOW 2 | Vraja Dhama Lila Sthalis_Lecture 9 to 16 | title has no lecture number |
| BSS-W043-LOW2 | BSS wk 43 LOW 2 | Vraja Dhama Lila Sthalis_17 to 24 | title has no lecture number |
| BSS-W054-LOW2 | BSS wk 54 LOW 2 | Braja Lila Sthalis_Lecture 25 to 35 | title has no lecture number |
| BSS-W065-LOW2 | BSS wk 65 LOW 2 | Mayapur Yatra _ 22 to 28 jan 2018_Lila Sthali Glorification 2 | title has no lecture number |
| BSS-W080-LOW2 | BSS wk 80 LOW 2 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 18 | no file starts with 18 |
| BSS-W081-LOW2 | BSS wk 81 LOW 2 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 20 | no file starts with 20 |
| BVS-W020-SPL | BVS wk 20 SPL | BG Ch 4_Lecture 6 | no file starts with 6 |
| BVS-W010-LOW1 | BVS wk 10 LOW 1 | Vraja Dhama Lila Sthalis_Lecture 1 to 8 | title has no lecture number |
| BVS-W021-LOW1 | BVS wk 21 LOW 1 | Braja Lila Sthalis_Lecture 1 to 4 | title has no lecture number |
| BVS-W032-LOW1 | BVS wk 32 LOW 1 | Vraja Dhama Lila Sthalis_Lecture 9 to 16 | title has no lecture number |
| BVS-W043-LOW1 | BVS wk 43 LOW 1 | Vraja Dhama Lila Sthalis_17 to 24 | title has no lecture number |
| BVS-W055-LOW1 | BVS wk 55 LOW 1 | Braja Lila Sthalis_Lecture 25 to 35 | title has no lecture number |
| BVS-W065-LOW1 | BVS wk 65 LOW 1 | Mayapur Yatra _ 22 to 28 jan 2018_Lila Sthali Glorification 1 | title has no lecture number |
| BVS-W081-LOW1 | BVS wk 81 LOW 1 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 19 | no file starts with 19 |
| BVS-W010-LOW2 | BVS wk 10 LOW 2 | Vraja Dhama Lila Sthalis_Lecture 1 to 8 | title has no lecture number |
| BVS-W021-LOW2 | BVS wk 21 LOW 2 | Braja Lila Sthalis_Lecture 1 to 4 | title has no lecture number |
| BVS-W029-LOW2 | BVS wk 29 LOW 2 | Congregation Folder_Lecture 25 | no file starts with 25 |
| BVS-W032-LOW2 | BVS wk 32 LOW 2 | Vraja Dhama Lila Sthalis_Lecture 9 to 16 | title has no lecture number |
| BVS-W038-LOW2 | BVS wk 38 LOW 2 | Sri Chaitanya Bhagavat Video Series_Lecture 2 | no file starts with 2 |
| BVS-W043-LOW2 | BVS wk 43 LOW 2 | Vraja Dhama Lila Sthalis_17 to 24 | title has no lecture number |
| BVS-W054-LOW2 | BVS wk 54 LOW 2 | Braja Lila Sthalis_Lecture 25 to 35 | title has no lecture number |
| BVS-W065-LOW2 | BVS wk 65 LOW 2 | Mayapur Yatra _ 22 to 28 jan 2018_Lila Sthali Glorification 2 | title has no lecture number |
| BVS-W080-LOW2 | BVS wk 80 LOW 2 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 18 | no file starts with 18 |
| BVS-W081-LOW2 | BVS wk 81 LOW 2 | Ram Katha Video Series_Hg Sundar Gopal Prabhuji_Lecture 20 | no file starts with 20 |

## Lectures with no link in the journal (20)

| Lecture | Week | Title | Why |
|---|---|---|---|
| SD-W015-GKGML | SPS/DPS wk 15 GKGML | N/A | no link in the journal |
| SD-W016-GKGML | SPS/DPS wk 16 GKGML | N/A | no link in the journal |
| SD-W021-GKGML | SPS/DPS wk 21 GKGML | N/A | no link in the journal |
| SD-W023-GKGML | SPS/DPS wk 23 GKGML | N/A | no link in the journal |
| SD-W024-GKGML | SPS/DPS wk 24 GKGML | N/A | no link in the journal |
| SD-W026-GKGML | SPS/DPS wk 26 GKGML | N/A | no link in the journal |
| SD-W029-GKGML | SPS/DPS wk 29 GKGML | N/A | no link in the journal |
| SD-W032-GKGML | SPS/DPS wk 32 GKGML | N/A | no link in the journal |
| SD-W034-GKGML | SPS/DPS wk 34 GKGML | N/A | no link in the journal |
| SD-W056-GKGML | SPS/DPS wk 56 GKGML | N/A | no link in the journal |
| SD-W060-GKGML | SPS/DPS wk 60 GKGML | N/A | no link in the journal |
| SD-W067-GKGML | SPS/DPS wk 67 GKGML | N/A | no link in the journal |
| SD-W076-GKGML | SPS/DPS wk 76 GKGML | N/A | no link in the journal |
| SD-W078-GKGML | SPS/DPS wk 78 GKGML | N/A | no link in the journal |
| SD-W079-GKGML | SPS/DPS wk 79 GKGML | N/A | no link in the journal |
| SD-W080-GKGML | SPS/DPS wk 80 GKGML | N/A | no link in the journal |
| SD-W081-GKGML | SPS/DPS wk 81 GKGML | N/A | no link in the journal |
| BSS-W045-SPL | BSS wk 45 SPL | Bg Ch 16_Lecture 1 | no link in the journal |
| BSS-W066-LOW2 | BSS wk 66 LOW 2 | BSS Braja Camp_2017_Lecture 2 | no link in the journal |
| BVS-W045-SPL | BVS wk 45 SPL | Bg Ch 16_Lecture 1 | no link in the journal |

## Lectures whose link is not a Drive link (4)

A file path from someone's computer or a broken address was pasted into the Excel.

| Lecture | Week | Title | Why |
|---|---|---|---|
| SD-W069-SPL | SPS/DPS wk 69 SPL | BG 2.14__The Skin Disease__20aug73_LO | link is not a Drive link: ../AppData/Roaming/Microsoft/Excel/BG%202.14__The%20Skin%20Disea |
| SD-W033-GKGML | SPS/DPS wk 33 GKGML | 5. Hari Naam-Saare Vaidik stroton kaa ek hi udgam bindu, Adi Lila- CC, (07-03-2004) | link is not a Drive link: 5.%20Hari%20Naam-Saare%20Vaidik%20stroton%20kaa%20ek%20hi%20udga |
| SD-W034-LOW1 | SPS/DPS wk 34 LOW 1 | 78. DPS_Shobha Yatra_HGSGP and HGMRP (06Aug17) | link is not a Drive link: IYF%20Book%20Reading%20Sequence_Draft%202.xlsx |
| SD-W048-LOW2 | SPS/DPS wk 48 LOW 2 | 04. Ghz_SLF_BG 10.11_Constant devotion with Love_HGSGP (30Dec18) | link is not a Drive link: 04.%20Ghz_SLF_BG%2010.11_Constant%20devotion%20with%20Love_HGSGP |
