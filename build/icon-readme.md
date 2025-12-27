# 应用图标说明

打包前请准备以下图标文件并放置在此 `build` 目录中：

## Windows 图标
- **icon.ico** - Windows 应用图标
  - 推荐尺寸：256x256px 或包含多个尺寸（16, 32, 48, 64, 128, 256）
  - 格式：ICO
  - 工具：可使用在线工具如 https://www.icoconverter.com/ 转换

## macOS 图标
- **icon.icns** - macOS 应用图标
  - 推荐尺寸：512x512px 和 1024x1024px
  - 格式：ICNS
  - 创建方法：
    1. 准备 1024x1024px 的 PNG 图片
    2. 在 macOS 上使用以下命令转换：
    ```bash
    mkdir icon.iconset
    sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
    sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
    sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
    sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
    sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
    sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
    sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
    sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
    sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
    sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
    iconutil -c icns icon.iconset
    ```
    或使用在线工具：https://cloudconvert.com/png-to-icns

## Linux 图标（可选）
- **icon.png** - Linux 应用图标
  - 推荐尺寸：512x512px
  - 格式：PNG

## 临时方案

如果暂时没有图标，可以先不放置这些文件，electron-builder 会使用默认的 Electron 图标。

