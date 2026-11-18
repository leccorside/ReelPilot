#!/bin/sh
# Downloads the image models into /models (the "comfy-models" volume) and checks every SHA-256.
# Run by the "comfy-models-init" service before "comfyui" starts; files already checked are skipped
# (a ".ok" marker holds the verified hash), so later starts take a second.
#
# All files are Apache 2.0 or MIT (FLUX.1-schnell, its VAE, T5 and CLIP-L); FLUX.1-dev is NOT used
# (non-commercial license). The VAE comes from Comfy-Org's open mirror: the Black Forest Labs repo
# needs a Hugging Face login, and the mirror's file has the same size and hash in two Comfy-Org repos.
set -eu

HF=https://huggingface.co
cd /models
mkdir -p diffusion_models text_encoders vae

# path in volume | source | bytes | sha256
FILES="
diffusion_models/flux1-schnell-Q5_K_S.gguf|city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q5_K_S.gguf|8263222304|19f63562d9a20d2123288dddd9abb3d5560554e5694ded951aaf6bfafe46b5df
text_encoders/t5xxl_fp8_e4m3fn.safetensors|comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors|4893934904|7d330da4816157540d6bb7838bf63a0f02f573fc48ca4d8de34bb0cbfd514f09
text_encoders/clip_l.safetensors|comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors|246144152|660c6f5b1abae9dc498ac2d21e1347d2abdb0cf6c0c0c8576cd796491d9a6cdd
vae/ae.safetensors|Comfy-Org/Lumina_Image_2.0_Repackaged/resolve/main/split_files/vae/ae.safetensors|335304388|afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38
"

echo "$FILES" | while IFS='|' read -r path src size sha; do
  [ -z "$path" ] && continue
  if [ -f "$path" ] && [ "$(cat "$path.ok" 2>/dev/null)" = "$sha" ] && [ "$(stat -c %s "$path")" = "$size" ]; then
    echo "ok        $path"
    continue
  fi
  echo "download  $path ($((size / 1048576)) MB)"
  # -C -: resumes an interrupted download.
  curl -fL --retry 5 --retry-delay 10 -C - -o "$path.part" "$HF/$src"
  if [ "$(stat -c %s "$path.part")" != "$size" ]; then echo "ERRO: tamanho errado em $path"; exit 1; fi
  echo "sha256    $path"
  echo "$sha  $path.part" | sha256sum -c - >/dev/null || { echo "ERRO: SHA-256 não confere em $path"; rm -f "$path.part"; exit 1; }
  mv "$path.part" "$path"
  echo "$sha" > "$path.ok"
done
echo "modelos prontos"
