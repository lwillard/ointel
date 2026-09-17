# Local speech models

Offline installers include these models under the application's Resources/models/speech directory. **Prepare local speech** verifies and loads them without downloads. Source development builds download them to Ointel's `speech-models` directory once. No meeting audio or transcript is transmitted to a model provider. Downloads use HTTPS, pinned model revisions where available, expected byte sizes, and SHA-256 checks (`electron/speech-models.mjs`). Failed/incomplete downloads are never loaded.

| Component | Model / source | Purpose |
| --- | --- | --- |
| Speech recognition | [Whisper Tiny English, int8 ONNX conversion](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en) | Local English transcription |
| Speech / speaker segmentation | [Pyannote segmentation 3.0 ONNX conversion](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0) | Speech intervals and within-batch speaker turns |
| Speaker embeddings | [3D-Speaker CAMPPlus English VoxCeleb 16 kHz](https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models) | Session-local voice matching |
| Runtime | [Sherpa ONNX](https://github.com/k2-fsa/sherpa-onnx) | Native CPU inference in an isolated Electron helper |

Upstream licenses and notices: [Whisper MIT](https://github.com/openai/whisper/blob/main/LICENSE), [segmentation MIT](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/blob/main/LICENSE), [3D-Speaker Apache 2.0](https://github.com/modelscope/3D-Speaker/blob/main/LICENSE), [Sherpa ONNX Apache 2.0](https://github.com/k2-fsa/sherpa-onnx/blob/master/LICENSE). The offline installer bundles these weights and their license texts. Downloads happen on the build machine, not on the destination Mac.

Voice embeddings are temporary and reset between calls. They are used to match labels within a session, not to establish a person's identity. No reusable voice profiles are saved. Recognized text and user-edited labels are retained in the local draft; saved meeting cards follow the normal Markdown and vector-index storage rules.

The developer speech test downloads an upstream [two-speaker English sample](https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/1-two-speakers-en.wav) into `.test-data/speech/`. Test audio is never included in the application package.
