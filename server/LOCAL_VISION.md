# Local vision engines

The canvas keeps its existing expansion flow. Four toolbar operations now dispatch to dedicated engines:

| Skill | Engine | Output |
| --- | --- | --- |
| `canvas-background` | BiRefNet General via rembg 2.0.69 | Original RGB + alpha, original dimensions |
| `canvas-erase` | Big LaMa TorchScript | Masked repair; pixels outside the mask unchanged |
| `canvas-upscale` | RealESRGAN_x2plus via spandrel | Tiled enhancement; `scale: 1` default, `2` optional |
| `canvas-separate` | Qwen-Image-Layered FP8 through local ComfyUI | Independent RGBA layers; inferred hidden content requires review |

## Installation

Run `scripts/setup-vision.ps1` for CUDA, or `scripts/setup-vision.ps1 -CpuOnly` to test the first three engines on CPU. Qwen is deliberately blocked without a CUDA runtime. The runtime, downloaded weights, intermediate requests and model outputs stay in ignored `.canvas-runtime/`. ComfyUI binds only `127.0.0.1:8189` and starts on demand.

Large downloads use verified HTTP ranges and resumable `.part` files. LaMa and BiRefNet use the upstream MD5 values. The download script returns a failure exit code on any missing/invalid download. There is no runtime automatic fallback to paid generation or the former three-class layer atlas.

The canvas service supports `CANVAS_RUNTIME_DIR` for an alternate runtime directory. Skills are read for each new request and snapshotted on the job. Change `scale`, `layers`, `steps`, or `resolution` in the relevant `SKILL.md`. Model implementation changes still require a compatible engine adapter, not merely a new model name in Markdown.

## Validation

`node --test tests/local-vision.test.mjs tests/canvas-skills.test.mjs tests/expansion.test.mjs`

`node --test tests/skill-api.integration.test.mjs` checks local-task failure when the runtime is absent, deduplication, and that these operations do not submit paid remote generation.

` .canvas-runtime/vision-env/Scripts/python.exe scripts/verify-local-vision.py <sample.png> [background erase upscale]` performs real inference and writes `artifacts/vision-trial/`. It checks alpha, dimensions and preservation outside the erase mask. Visual quality must also be reviewed. A successful smoke test is not a guarantee that every object will be segmented or reconstructed correctly.

`node scripts/verify-layered.mjs <sample.png> "<optional scene description>"` runs four layers at 640 / 20 steps and writes `artifacts/layered-trial/`. This is a real inference test, not a mocked API response.

BiRefNet is automatic salient-foreground segmentation. In our complex interior sample it retained the person and foreground desk fan but omitted the chair and tower fan. It is therefore a trial engine, not an accepted solution for extracting all furniture and products. A targeted selection/matting workflow is still needed for those cases. It preserves original RGB but cannot guarantee the correctness of the alpha mask.

## Upstream sources

- https://github.com/ZhengPeng7/BiRefNet
- https://github.com/danielgatis/rembg (v2.0.69)
- https://github.com/advimman/lama
- https://github.com/Sanster/IOPaint/blob/main/iopaint/model/lama.py (TorchScript checkpoint reference only; archived project)
- https://github.com/xinntao/Real-ESRGAN
- https://github.com/chaiNNer-org/spandrel
- https://github.com/QwenLM/Qwen-Image-Layered
- https://github.com/Comfy-Org/workflow_templates/blob/main/templates/image_qwen_image_layered.json
- ComfyUI checked-out revision: `b1a247c9cf9dbfda4b2c0a0c1d50950667eeaa0c`

Downloaded projects and weights retain their upstream licenses. Qwen decomposition is generative, can change fine details, and does not guarantee that each requested semantic object occupies exactly one layer. Default output resolution is 640; this is not full-resolution pixel-preserving extraction.
