-- One picture per announcement (the head, 3 Oct 2026): a JPEG shrunk on the phone (at most 1600 px a side, 240 KB),
-- kept here like profile photos, sent only to people who can see the post and only when it scrolls into view.
CREATE TABLE announcement_images (ann_id INTEGER PRIMARY KEY, jpeg TEXT NOT NULL, bytes INTEGER NOT NULL, w INTEGER NOT NULL, h INTEGER NOT NULL, updated_at TEXT NOT NULL);
