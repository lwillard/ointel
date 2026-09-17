# Ointel

A local Electron mind-map workspace with Markdown notes, version history, and semantic vector search. The interface uses a warm paper canvas, muted color palettes, and a persistent note inspector.

## Run

Requires **Node.js 22.12 or later** (Node 24 LTS recommended).

```sh
npm install
npm start
```

Electron downloads its runtime on first launch. For live development, run `npm run electron:dev`. `npm run dev` opens a browser development server; that preview uses browser storage and exact-text search. Local files and vector search run in the Electron app.

```sh
npm run package       # Installer for the current platform in release/
npm run package:mac   # Apple Silicon DMG + ZIP; run on an Apple Silicon Mac
npm test              # Data, history, layout, persistence, and vector ranking tests
npm run test:vectors  # Real model retrieval, long-note coverage, and revision search
npm run test:offline  # After test:vectors: fresh model load with network blocked
npm run test:package  # Smoke-test the packaged executable after packaging
npm run test:speech   # Download speech models/sample and exercise real local recognition
npm run build
npm run test:e2e      # Full desktop workflow; requires the built renderer
```

## Working with the map

- Select a card and drag a corner to resize it. Pinned cards expose only the bottom-right corner, keeping their position fixed. Sizes autosave, survive export/import and duplication, and support undo/redo. Layouts account for each card's dimensions. Small cards temporarily expand for editing; resizing while editing saves the new dimensions.

- Add standalone ideas or connected child ideas. Drag nodes manually and connect the dots on their edges. Select a connector to edit it.
- Select a single card and press **Ctrl+C / Cmd+C** to copy its titled node link, or right-click it and choose **Copy node link**. Paste into another card's note with **Ctrl+V / Cmd+V** to insert the clickable link at the caret (or replace selected text). Clicking a node link, including while editing, finishes editing and centers, selects, and focuses the linked card on the canvas. Links survive renaming and moving the source card; they target its ID within the current map. Copying selected text inside a note or input continues to copy that text normally.
- **Multi-select cards** with Ctrl/Cmd-click, Shift-drag an area, or Ctrl/Cmd+A (outside text fields). The Card themes toolbar also has Select all and Clear selection buttons. Drag a group to move its unlocked cards together; pinned cards stay in place. Delete removes the selection and its connections in one undoable action. Right-click a selected group to pin, unpin, theme, or delete it.
- The **Card themes toolbar** includes eight complete presets: Sage, Editorial, Blueprint, Orchid, Sunset, Graphite, Confetti, and Minimal. A theme applies background, border color/style/width, rounding, shadow, and title font/color/size/bold/italic to every selected card in one undoable action. The right panel also supports changing individual style settings across a selection. Note text retains its separate formatting.
- Open **Theme editor** to start from a selected card or an existing theme, adjust all card styles with a live preview, and save a named custom theme. Use Save and apply to update the selection immediately. Custom themes can be edited, duplicated, or deleted and travel with workspace exports. Built-ins are copied when customized. Cards keep a snapshot of applied styles: editing or deleting a theme does not retroactively change cards; apply the updated theme to change them. Up to 100 custom themes can be saved per workspace.
- Each card has an editable **Type** (Idea, Task, Question, or your own label) and **#tags**. Add tags with Enter, comma, or by leaving the field. Tags are case-insensitive and accept letters, numbers, hyphens, and underscores; up to 32 per node. Tags and card types are included in saved versions and portable workspace exports. Existing maps receive empty tags and the Idea type automatically.
- Right-click a card to edit, add a child, duplicate, pin, delete the node, or delete its branch. Branches follow source → target connections. Shared descendants with parents outside the branch, and their descendants, are preserved. Undo restores deleted nodes and connections. Right-click the canvas to add a node at that location.
- Select a connection and drag either endpoint to another node, or choose source/target nodes and attachment sides in the connection panel. Right-click a line to edit, reverse, or delete it; Delete also removes a selected connection. Source and target terminators are independent: solid/white/open arrows, solid/hollow dots, diamonds, one bars, and many crow’s feet. One-to-many and many-to-many presets are included. These are visual relationship labels, not database constraints.
- Arrange using Dagre hierarchy, a breadth-first radial layout, or a D3 force-directed simulation. Pinned nodes cannot be dragged and retain their exact coordinates during all layouts. Unlocked nodes are moved away from reserved pinned rectangles; overlapping pinned nodes remain where you placed them.
- Double-click a card to edit its title and formatted note **in place on the canvas**. The card expands while editing. Click **Done** or press Escape to finish; changes autosave. You can also choose **Edit on card** from the read-only note preview.
- The **top Note Text toolbar** formats the highlighted text, or the next characters typed at the caret when no text is selected. It supports bold, italic, underline, strike, code, font family, size, text color, highlight, headings, lists, quotes, links, images, and note undo/redo. Selections remain intact when using toolbar controls.
- Each idea has a title, creation date, Markdown body, and saved revisions. **Save version** creates a meaningful history entry; restoring a revision first preserves any unsnapshotted work. The History tab supports previous/next and direct selection. Note bodies remain Markdown; font/color/highlight formatting uses safe inline HTML spans, and underline uses `<u>`, preserved in history and exports.
- In the card editor, paste a screenshot at the caret or use the top image button. Images become local files and render inline. Paste Markdown to insert formatted content. Use the top node-link button to insert a `node://ID` link or link selected text; clicking links in the note preview selects and centers their target. Missing targets show a message.
- The **right Style panel** controls the entire card: background, border, rounding, shadow, and title typography. It does not format the note body. Connector styling remains in the right panel, with Bézier, angular, and straight paths; solid, dashed, and dotted strokes; color, width, and arrowheads.
- Export/import a complete `.ointel.json` backup, including images and saved history. Individual notes can be exported as Markdown with embedded image data. The current workspace is a single map; export before switching maps. Undo/redo covers edits, movement, arrangements, styles, and deletion within the current session.

## Zoom meeting notes

Choose **Zoom notes → Live audio** to transcribe a call as it happens. The primary target is **Apple Silicon, macOS 14.2+**, with Windows system audio capture also wired up. Read [Mac setup and validation status](MAC-SETUP.md) for build, permissions, and usage. Live audio works independently of Zoom's cloud-recording and transcript features: it captures system output, processes English speech locally, separates approximate speaker turns, and checkpoints the live text on disk. Optional microphone capture labels your speech as **You** and is independent of Zoom mute. Use headphones to reduce duplicate speech. All system sounds can be captured; this is not a Zoom-only audio tap and cannot retrieve Zoom participant names.

Download the local models once using **Prepare local speech** (about 135 MB), then choose **Start live notes**. Text arrives in roughly 8–12 second batches plus inference time. The system meter and silence warning help detect missing audio. **Stop capture** flushes remaining audio; rename speaker labels and **Add live notes to map**. The draft remains recoverable until explicitly cleared, and full text can be exported. Completed passages are saved, but in-flight audio can be lost after a crash or overload. No audio files or screen images are saved or uploaded. See [models and notices](SPEECH-MODELS.md).

The older **Transcript file** and **Zoom cloud** tabs are optional import tools and are not needed for live capture. File import accepts Zoom `.vtt`, `.srt`, or speaker-labeled `.txt` (up to 4 MB). Preview timestamps and speakers, correct names, and optionally create one linked card per speaker. Giving two speaker labels the same name merges their speaker cards. Unlabeled imported text remains **Unknown speaker**.

The meeting card includes editable personal notes, opening substantive quotes from each speaker, keyword-matched possible follow-ups, and the complete chronological transcript. Highlights are **extractive quotes, not an AI summary**, and possible follow-ups need review. Speaker cards contain that speaker’s full contributions and a link back to the meeting. All cards get Markdown files, initial history snapshots, `#zoom` tags, and local vector embeddings through the normal note pipeline. Import is a single undoable change. Duplicate transcript files and already-imported cloud recording files are detected within each map.

The **Zoom cloud** tab connects directly to Zoom and retrieves completed audio transcripts from your account’s cloud recordings. Select a date range of up to 30 days, choose **Find recordings**, then preview a transcript before adding its notes. More recordings supports pagination. This is an on-demand, **post-call** integration; it does not join calls, capture live audio, or run automatic background imports. A recording may be ready before Zoom finishes its transcript.

Direct account access requires a one-time Zoom Marketplace setup:

1. Create a user-managed **General app**, enable **Public Client OAuth / PKCE**, and copy its **Public Client ID** (not the confidential client ID or a secret).
2. Register `http://127.0.0.1/zoom/callback` as a native loopback redirect. Zoom’s native/PKCE flow allows an ephemeral port while matching the host and path.
3. Add `cloud_recording:read:list_user_recordings`. Enable cloud recording and audio transcription in Zoom. Add your account to the app’s allowed test users if using development credentials.
4. Enter the Public Client ID in Ointel and choose **Connect Zoom**. Authorize in your system browser, then return to Ointel.

Ointel does not ship with a registered/public Zoom Marketplace application, so **file import works immediately; direct sign-in requires your own app registration**. Zoom approval or admin restrictions may apply to your account. See [Zoom OAuth and native loopback setup](https://developers.zoom.us/docs/integrations/oauth/), [Public Client OAuth](https://developers.zoom.us/blog/public-pkce/), and [Zoom audio transcripts](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064927).

OAuth uses S256 PKCE with a random state and a temporary localhost callback. Access/refresh tokens are stored through Electron OS encryption in the app-data `connections/zoom-connection.enc`, outside workspace exports. Tokens stay in Electron’s main process; only transcript text and recording metadata reach the renderer. Downloads are size-limited and redirects are restricted to HTTPS Zoom domains. **Disconnect** clears local credentials and cancels pending authorization; it does not revoke the Zoom Marketplace grant. Remove the app in Zoom Marketplace to revoke that grant. Existing imported notes remain in the map.

## Local vector search

**Titles, complete note bodies, and all saved revisions are vectorized.** This is model-based semantic retrieval, not a keyword or hash-vector approximation.

Tags are vectorized separately as well. Search a single `#tag` in the search window, then choose **Show matches on map**. Exact normalized tag matches get glowing green borders. Related tags get a temporary green-yellow fill: farther matches are more yellow. Untagged nodes and nodes beyond the cutoff retain their original appearance. These highlights never overwrite saved card styles. The map legend can clear highlights or adjust the hard distance cutoff (default **0.55**, range **0–0.80**). Distance is `1 − cosine similarity` to the node's nearest tag; it is not a probability. Tag queries highlight current nodes only, ignore the saved-version checkbox, and return all qualifying matches rather than the normal 20-result limit. Exact matches work even while the model loads or is unavailable. General vector searches include tag vectors alongside title/body vectors.

**Search history** retains the 50 most recent distinct queries in the workspace, including mode, saved-version preference, timestamp, and tag cutoff. Expand Search history to repeat a query or clear the list. It survives restarts and travels with exported workspace backups. Repeated queries move to the top. Active map highlights are temporary and clear on restart.

- Model: [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2), quantized Q8, 384 dimensions, mean pooling and normalization, through [Transformers.js](https://huggingface.co/docs/transformers.js).
- Inference runs on the CPU in a Node worker thread, so the editor remains responsive. The model downloads from Hugging Face once (roughly 23 MB of weights plus tokenizer/configuration) into the local model cache. Notes and queries are never sent to an embedding service. The initial download needs internet access; subsequent use works from the cache.
- Titles get a dedicated vector. Bodies are converted to plain visible text, then split into 180-token windows with 36-token overlap, with title context added to each window. All windows are indexed, including the end of long notes. Image alt text is indexed; screenshot pixels are **not OCR'd**.
- Content hashes avoid recomputing unchanged text and reuse embeddings for matching revisions. Edits and restores refresh the index; removed nodes disappear from retrieval. Persisted caches are validated and corrupt entries are rebuilt.
- Search ranks by maximum cosine similarity across each document's chunks. The displayed similarity is a cosine score, not a probability. Current notes are searched by default; **Include saved versions** extends the search to history. Historical results open a read-only version preview.
- Exact-text search remains available. Progress and retry controls cover initial model download and indexing failures. The JSON vector index is disposable and can be rebuilt from the workspace.

## Files and recovery

Use the folder button beside **Personal workspace** to open the data directory. By default it is Electron's user-data directory under `workspace` (normally `%APPDATA%/ointel/workspace` on Windows).

```text
workspace/
  workspace.json           # Atomic authoritative snapshot: metadata, notes, assets, history
  workspace.backup.json    # Previous successfully written snapshot
  notes/
    <node-id>.md            # Plain Markdown body for each node
    assets/                # Pasted and uploaded images
    .history/<node-id>/     # Markdown copies of saved revisions
  vector-index.json        # Content-addressed chunk embeddings
  models/                  # Downloaded local embedding model
  .meetings/live-meeting.json # Recoverable live transcript, separate from map exports
```

The JSON snapshot is the recovery source; the Markdown files are portable projections generated by the app. Edit notes inside Ointel; external edits to the projections are not imported automatically. Files belonging to deleted nodes may remain on disk as recovery material, but are removed from the active map and vector index. Workspaces are stored locally without application-level encryption.

Writes are serialized and use an atomic manifest replacement; a previous snapshot is retained. Close waits for the latest save. A corrupt workspace opens an error screen without overwriting data. To recover, close Ointel and replace `workspace.json` with your backup, or restore an exported map through Import. Images have an 8 MB upload limit; workspace snapshots have a 100 MB limit. Very large maps and long histories increase memory and indexing costs.

## Architecture

- `src/`: React + TypeScript renderer, React Flow canvas, Markdown rendering, layout logic.
- `electron/`: isolated preload bridge, validated file persistence, background vector indexing and search.
- `shared/schema.mjs`: Zod schema shared by imports and Electron storage; validates IDs, styles, graph references, and asset paths.
- `tests/`: unit/integration tests and Playwright Electron end-to-end workflow.

Electron uses context isolation, sandboxing, disabled Node integration, narrow validated IPC, navigation restrictions, and a Content Security Policy. Markdown previews sanitize HTML and allow only a small whitelist of text-style properties on spans; scripts, handlers, and arbitrary CSS are removed. External links only open through allowed `https:`, `http:`, or `mailto:` protocols. See [Electron's context-isolation guidance](https://www.electronjs.org/docs/latest/tutorial/context-isolation).

Developer/test overrides: `OINTEL_DATA_DIR` sets a separate workspace directory; `OINTEL_MODEL_CACHE` sets a shared embedding-model cache; `OINTEL_SPEECH_MODELS` sets the local speech-model directory. `OINTEL_TEST_MODE=1` starts the window hidden for automated tests. Run `npm run test:speech` before the live desktop workflow to fetch its public speech sample and models.

Packages are development builds; no signing/notarization credentials or automatic updates are configured. Mac packaging is configured for Apple Silicon and must be built and validated on a Mac. Windows automated tests do not establish native Mac capture compatibility.
