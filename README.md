# Eight-Dimensional-Space

淮北一中八维空间摄影社网站。

网站：https://alexjiang233.github.io/Eight-Dimensional-Space/

## 开发

需要 Node.js 22 或更新版本，无需安装依赖。

```sh
npm test
npm run build
```

源码在 site/，内容入口为 site/content/catalog.json；已确认可公开的派生图片与字体在 public/。dist/ 为自包含静态产物，部署到 gh-pages 分支根目录。完整视频通过B站在线嵌入播放；首页仅保留18秒静音循环封面。

照片保留完整比例；未知作者不补写，已知拍摄参数保存在内容数据中。素材不因公开访问而放弃著作权；字体授权见 public/fonts/fieldwork/OFL.txt。
