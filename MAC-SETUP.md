# Ointel on Apple Silicon

Target: **Apple Silicon, macOS 14.2 or newer**. Live notes use Electron 44's native CoreAudio system-audio capture, local Whisper speech recognition, and local speaker separation. Zoom cloud recordings, Zoom transcripts, and a Zoom account connection are not required.

## Build and open on your Mac

Install an **arm64 Node.js 22.12+** runtime (Node 24 recommended). Copy this project to the Mac, without `node_modules`, `dist`, `.test-data`, or `release`. In Terminal, from the project folder:

```sh
npm ci
npm run package:mac
open release
```

Open the generated arm64 DMG, copy **Ointel.app** to Applications, and launch that app directly. The package includes the microphone and system-audio usage descriptions required by macOS. `npm start` launches the generic development Electron bundle; its parent Terminal/IDE may lack the audio usage description, resulting in a silent stream. Use the packaged app to test real Mac capture.

This is a development build. Without your Apple Developer signing identity and notarization credentials, it is not a signed/notarized distribution release. No signing credentials are included in this project. Electron Builder can use your configured signing identity when available. Native speech libraries and their runtime are unpacked outside ASAR; a separate speech helper prevents conflicts with the vector-search runtime.

## Take live notes

1. Join the call normally in Zoom and use headphones.
2. In Ointel, select **Zoom notes → Live audio → Prepare local speech**. The first setup downloads about 135 MB of verified model files. Subsequent recognition works offline.
3. Set a meeting title. Optionally enable **Include my microphone as “You”**. This microphone is independent of Zoom's mute button.
4. Select **Start live notes**. Approve Ointel's system-audio / screen-recording permission and, if enabled, microphone permission in macOS. Restart Ointel if macOS requests it.
5. Check the System audio meter while someone speaks. Text arrives in roughly 8–12 second batches plus processing time. Rename speaker labels as needed; identical names merge speaker cards.
6. **Stop capture** flushes the remaining audio and finishes recognition. Choose **Add live notes to map** for a Markdown meeting card and optional linked speaker cards. Notes enter the existing history and local vector-search pipeline. You can also export the complete text.

The capture API provides all system output, including sounds from other applications. It does not expose Zoom participant names, Zoom mute state, or isolated participant audio tracks. The required screen stream is disabled; no screen images or audio recordings are written. Only recognized text is saved. In-flight audio lives in bounded memory and is discarded after processing.

Speaker separation is approximate: short/overlapping turns and similar voices can be mislabeled. English Whisper Tiny favors speed over maximum accuracy. Review the notes, particularly names, numbers, short interjections, and sentences crossing a batch boundary. This is live transcription with quoted highlights and possible follow-up phrases, not a generated meeting summary.

## Recovery and troubleshooting

- Completed passages are atomically checkpointed to `workspace/.meetings/live-meeting.json` inside Ointel's local data folder, normally `~/Library/Application Support/ointel/`. Reopen Live audio to recover a draft. This text is stored without application-level encryption and is separate from map exports until added to the map.
- Adding a draft retains the recovery copy. **Clear draft for next call** removes it after import; **Discard this draft** removes an unimported draft. Export the text first if you want an independent copy.
- If a permission is denied, open **System Settings → Privacy & Security** and allow Ointel under the applicable screen/system-audio or microphone entry, then restart the packaged app. No sound for 15 seconds produces a visible diagnostic message.
- A lost source, recognition error, or processing backlog stops capture visibly. Finished text remains recoverable; audio still being processed can be lost on a crash. The app does not automatically restart capture.
- Closing Ointel normally stops capture, flushes pending audio, and saves the draft. Closing the live-notes dialog requires stopping capture first.

## Validation status

Development and automated verification were performed on Windows. Real English speech samples were processed locally, including two-speaker separation, repeated speaker matching, silence rejection, microphone labeling, and the full Electron AudioWorklet → native helper → draft → mind-map flow. The OS audio source was substituted with a real-audio MediaStream during automation, so no developer microphone or meeting was recorded.

**Mac hardware capture, Apple permission prompts, signing, and the arm64 DMG require validation on a Mac.** The project is configured for this target but a Mac binary has not been built or run on this Windows machine. On your Mac, run `npm run test:speech` before `npm run test:e2e`, then follow the live-call steps above to verify native capture.

Reference: [Electron native system audio requirements](https://www.electronjs.org/docs/latest/api/desktop-capturer).
