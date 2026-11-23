#!/usr/bin/env bash
# Video kurgu araçlarını kurar ve kontrol eder (Linux / bulut oturumu).
# Kullanım: bash video-kurgu/kurulum.sh
set -e
command -v ffmpeg >/dev/null || { apt-get update -qq && apt-get install -y -qq ffmpeg; }
pip3 install --break-system-packages -q -U yt-dlp openai-whisper
command -v hyperframes >/dev/null || npm i -g hyperframes
echo "--- kontrol ---"
ffmpeg -version | head -1
yt-dlp --version
whisper --help >/dev/null && echo "whisper OK"
hyperframes doctor | grep -E "Version|Node|FFmpeg|Chrome" || true
