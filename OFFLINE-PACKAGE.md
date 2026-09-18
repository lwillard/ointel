# Ointel offline package for Apple Silicon

Version 0.6.8 replaces filtered type suggestions with a complete dropdown containing every predefined icon type and alias, plus No type. Both the inspector and inline editor retain custom type entry.

Download the **arm64 DMG** from this release, open it, and drag **Ointel.app** to Applications. Launch the installed app. The ZIP contains the same app for transfer or extraction without a disk image.

No Node.js, npm install, dependency downloads, account, or model downloads are required on the destination Mac. The installer includes Electron, native Apple Silicon inference libraries, the vector-search model, English speech recognition, and speaker-separation models. You can transfer it to the Mac using an approved file-sharing method or removable drive.

Requires Apple Silicon and macOS 14.2 or newer. The app is ad-hoc signed, **not Apple Developer notarized**. macOS may block its first launch; follow your organization's application approval process. Where permitted, use System Settings → Privacy & Security → Open Anyway. No signing or security settings need to be disabled system-wide.

In Zoom notes → Live audio, **Prepare local speech** verifies and loads the included models. It does not download them. Microphone and system-audio permissions remain necessary for live capture. Speaker labels are approximate, and native call capture should be checked on your Mac. The build's automated checks exercise local speech recognition and two-speaker separation using a test recording, not a real Zoom call.

Mind maps, Markdown notes, pasted images, history, vector search, and local transcription work offline. Optional Zoom cloud imports, external web links, and externally hosted images still need their respective network access. Paste images into notes to store them locally.

SHA256SUMS.txt provides checksums for the installers. Model licenses and notices are included under Ointel.app/Contents/Resources/models/licenses.

The release includes npm and OSV dependency-advisory reports, registry-signature verification results, and a CycloneDX dependency inventory. Publication stops if those checks fail or either advisory database reports a vulnerability. These checks cover known advisories at build time; they cannot guarantee the absence of undiscovered vulnerabilities.
