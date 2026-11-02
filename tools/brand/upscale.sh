#!/bin/sh
# AI-upscale an image 4× with Real-ESRGAN (ncnn/Vulkan build for macOS, kept here: no download needed).
#   sh tools/brand/upscale.sh <in.png> <out.png> [anime|photo]
# "anime" (realesrgan-x4plus-anime) keeps logos' clean edges; "photo" (realesrgan-x4plus) for photographs.
# Never redraw the IYF logo: always upscale the official file (brand/iyf-logo-full-original-885x280.png).
D=$(cd "$(dirname "$0")/esr" && pwd)
M=realesrgan-x4plus-anime; [ "$3" = "photo" ] && M=realesrgan-x4plus
xattr -d com.apple.quarantine "$D/realesrgan-ncnn-vulkan" 2>/dev/null
"$D/realesrgan-ncnn-vulkan" -i "$1" -o "$2" -n $M -m "$D/models"
