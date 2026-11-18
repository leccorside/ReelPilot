# syntax=docker/dockerfile:1.7
# ComfyUI + ComfyUI-GGUF for the scene images (Passo 8), on the RTX 3060 through the NVIDIA runtime.
# The models are NOT in the image: they live in the "comfy-models" volume, filled by
# download-models.sh (service "comfy-models-init"), with every file's SHA-256 checked.
#
# No CUDA base image: the PyTorch wheels ship their own CUDA libraries, and the NVIDIA container
# runtime injects the driver. Versions are pinned (each at least two weeks old when chosen):
#   ComfyUI v0.43.0 (2026-10-27), ComfyUI-GGUF 6ea2651 (2026-01-12), PyTorch 2.14.1+cu130 (2026-09-30).

FROM python:3.12.12-slim-bookworm

ARG COMFYUI_VERSION=v0.43.0
ARG GGUF_COMMIT=6ea2651e7df66d7585f6ffee804b20e92fb38b8a
ARG TORCH_VERSION=2.14.1
ARG TORCH_INDEX=https://download.pytorch.org/whl/cu130

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git curl ca-certificates libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -m -u 1001 comfy

WORKDIR /opt
RUN git clone --depth 1 --branch ${COMFYUI_VERSION} https://github.com/Comfy-Org/ComfyUI.git comfyui \
 && git clone https://github.com/city96/ComfyUI-GGUF.git comfyui/custom_nodes/ComfyUI-GGUF \
 && git -C comfyui/custom_nodes/ComfyUI-GGUF checkout ${GGUF_COMMIT} \
 && rm -rf comfyui/.git comfyui/custom_nodes/ComfyUI-GGUF/.git

# PyTorch first, from its CUDA index; ComfyUI's own "torch" requirement is then already satisfied.
RUN pip install torch==${TORCH_VERSION} torchvision --index-url ${TORCH_INDEX} \
 && pip install -r comfyui/requirements.txt -r comfyui/custom_nodes/ComfyUI-GGUF/requirements.txt

COPY extra_model_paths.yaml /opt/comfyui/extra_model_paths.yaml
COPY download-models.sh /usr/local/bin/download-models.sh
RUN chmod +x /usr/local/bin/download-models.sh \
 && mkdir -p /models /opt/comfyui/output /opt/comfyui/input /opt/comfyui/temp /opt/comfyui/user \
 && chown -R comfy:comfy /models /opt/comfyui

USER comfy
WORKDIR /opt/comfyui
EXPOSE 8188
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 \
  CMD curl -sf http://127.0.0.1:8188/system_stats > /dev/null || exit 1
# --listen 0.0.0.0: reachable inside the Docker network only (no published port in compose).
# --disable-auto-launch: no browser; images come back over the websocket, nothing is kept on disk.
CMD ["python", "main.py", "--listen", "0.0.0.0", "--port", "8188", "--disable-auto-launch", "--preview-method", "none"]
