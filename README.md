# 手机拍照识别编号并写入 Word

这个工具用于手机拍照或从相册选择图片，识别图片里的编号，人工确认后上传到电脑，电脑自动写入 Word 文档。

## 功能概览

1. 手机拍照，或从相册/文件选择已有图片。
2. 手机端裁剪编号区域。
3. 浏览器 OCR 识别编号。
4. 人工确认或手动修改编号。
5. 上传编号到电脑。
6. 电脑自动写入 `output/编号记录.doc`。
7. 电脑端可删除指定记录或清空全部记录。

## 使用前准备

1. 电脑安装 Node.js：`https://nodejs.org/`
2. 电脑安装 Microsoft Word，或者安装能打开 `.doc` 文件的软件。
3. 如果使用不依赖局域网的 ntfy 模式，电脑和手机都需要能访问互联网。
4. 手机 OCR 使用 Tesseract.js CDN，手机需要能访问该 CDN。

## 启动电脑端

Windows 用户双击：

```text
start-windows.bat
```

请先完整解压交付包，再双击解压后的脚本；不要在压缩包预览窗口里直接运行。

macOS 用户双击：

```text
start-mac.command
```

如果 macOS 提示没有权限，打开终端进入本文件夹后运行：

```bash
chmod +x start-mac.command
./start-mac.command
```

也可以在终端运行：

```bash
npm start
```

启动成功后，窗口会显示类似内容：

```text
电脑端服务已启动：http://localhost:3000
备用局域网地址：
  http://192.168.1.23:3000
不使用局域网时：
  ntfy topic：ocr-word-xxxxxxxxxxxxxxxxxxxxxxxx
  手机端发布地址：https://ntfy.sh/ocr-word-xxxxxxxxxxxxxxxxxxxxxxxx
Word 文档路径：.../output/编号记录.doc
```

电脑端窗口不要关闭；关闭后电脑就不会继续接收编号。

## 手机网页部署

### 推荐：GitHub Pages

把 `public` 文件夹里的以下 3 个文件上传到 GitHub Pages 仓库根目录：

```text
index.html
app.js
styles.css
```

手机打开 GitHub Pages 生成的网址，例如：

```text
https://你的用户名.github.io/仓库名/
```

### 不要上传到 GitHub Pages 的文件

下面这些是电脑端使用的文件，不需要上传到 GitHub Pages：

```text
server.js
package.json
start-mac.command
start-windows.bat
public/admin.html
public/admin.css
public/admin.js
output/
config.json
```

## 两种上传模式

### 模式一：不使用局域网

使用 ntfy 公网中转。手机和电脑不需要连接同一个 Wi-Fi。

工作方式：

```text
手机网页 -> 拍照 OCR -> 人工确认编号 -> POST 到 ntfy topic
ntfy topic -> 电脑端订阅 -> 写入 output/编号记录.doc
```

使用步骤：

1. 电脑端先启动。
2. 复制电脑窗口里的 `ntfy topic`。
3. 手机打开 GitHub Pages 网页。
4. 确认“不使用局域网上传”已勾选。
5. 填入电脑端显示的 `ntfy topic`。
6. 拍照或选择图片、裁剪、识别、确认并上传。

注意：

- 只发送人工确认后的编号，不发送照片。
- `ntfy topic` 必须使用自动生成的长随机字符串，不要改成简单名字。
- 电脑和手机都需要能访问 `https://ntfy.sh`。

### 模式二：使用局域网

如果要使用局域网上传，不要打开 GitHub Pages 网页。手机必须打开电脑端显示的备用局域网地址，例如：

```text
http://192.168.1.23:3000
```

GitHub Pages 是 HTTPS 页面，不能可靠地直接请求电脑的 HTTP 局域网服务，所以 GitHub Pages 页面会锁定云上传模式。

## 手机端使用流程

1. 手机网页点击“拍照”，或点击“从相册/文件选择”。
2. 拍编号照片，或选择已有编号图片。
3. 拖动裁剪框，只框住编号区域。
4. 需要缩放时拖动裁剪框右下角圆点。
5. 点击“识别裁剪区域”。
6. 在“确认编号”输入框里检查并修改。
7. 确认上传模式和 topic 正确。
8. 点击“确认并上传”。
9. 电脑收到编号后自动写入并打开 `output/编号记录.doc`。

## 电脑端记录管理

电脑端启动后，在电脑浏览器打开：

```text
http://localhost:3000/admin.html
```

可以执行：

- 删除指定编号
- 清空全部记录
- 刷新记录列表

删除或清空后会同步更新：

```text
output/records.json
output/编号记录.doc
```

不建议只手动修改 Word 文档，因为程序保存记录的源文件是 `output/records.json`。

## 输出文件

编号记录会写入：

```text
output/编号记录.doc
```

记录备份保存在：

```text
output/records.json
```

`config.json` 保存电脑端自动生成的 ntfy topic。不要把自己的 `config.json` 发给别人，否则别人会复用同一个 topic。

## 常见问题

### GitHub Pages 页面不能使用局域网上传

这是正常的。GitHub Pages 页面是 HTTPS，不能可靠地直接请求电脑的 HTTP 局域网地址。

需要局域网上传时，请用手机打开电脑端显示的备用局域网地址。

### 手机打不开网页

- 使用 ntfy 模式时，确认手机能访问 GitHub Pages 网页。
- 使用局域网模式时，确认手机和电脑在同一个 Wi-Fi，并打开电脑端显示的备用局域网地址。
- 确认电脑端启动窗口没有关闭。

### 不能拍照或不能选择图片

- 用手机自带浏览器打开，不要用聊天软件内置浏览器。
- iPhone 建议使用 Safari。
- Android 建议使用 Chrome。

### OCR 识别不准

- 让编号尽量填满画面。
- 裁剪时尽量只保留编号，少留背景。
- 避免反光、模糊、倾斜。
- 识别后必须人工确认。
- 当前版本会统一转成大写，降低大小写误判。

### Word 没有自动打开

手动打开：

```text
output/编号记录.doc
```

只要记录已写入，手动打开不影响使用。

### 双击启动脚本提示端口被占用

说明 `3000` 端口已经有旧服务在运行。先关闭旧的终端窗口，或在终端运行：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

看到 PID 后执行：

```bash
kill PID
```

再重新双击启动脚本。

## 文件说明

```text
server.js                  电脑端服务，订阅 ntfy、接收编号、写 Word
public/index.html          手机网页
public/app.js              手机网页逻辑
public/styles.css          手机网页样式
public/admin.html          电脑端记录管理页
public/admin.js            管理页逻辑
public/admin.css           管理页样式
start-mac.command          macOS 启动脚本
start-windows.bat          Windows 启动脚本
package.json               Node 项目配置
README.md                  统一使用说明
output/编号记录.doc         Word 文档
output/records.json        记录备份
config.json                本机 ntfy topic 配置
```
