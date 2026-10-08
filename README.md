# 巧思 · qiaosi

**讨厌蔡依林不能拿。**

一些拿来就能用的前端小东西。纯前端，不接后端，下载下来起个本地服务器就能看。

**先看再拿：https://tangfanovo.github.io/qiaosi/** —— 一台假手机，上面四个分区，点哪个就在手机里跑哪个。语音条和健康页旁边有个开关，能套上液态玻璃看看。

| 分类 | 是什么 | 先开哪个 | 协议 |
|---|---|---|---|
| 场景 · [`scenes/windowsill`](scenes/windowsill) | **窗台**：一张靠窗的 3D 书桌，手机竖屏。窗外是海和沙滩，柳条跟着风摆；天色跟着时间走，有风雨雪雷和四季；桌上每样东西对应一个功能，点一下镜头推过去。全部用代码画，没有图片素材（three.js） | `index.html` | MIT |
| 组件 · [`components/voice-note`](components/voice-note) | **语音条**：聊天里的语音消息。点着播放，按住浮起来出菜单，原文和中文往下展开；全屏演示里，一个点和线连成的图形（星星 / 小花 / 四叶草 / 嫩芽）跟着声音流动，字幕逐字渐显。六种皮肤 | `demo.html` | MIT |
| 页面 · [`components/health`](components/health) | **健康**：一页看完今天，点进去看趋势，曲线能点能滑。只画，不接数据源，数据格式写在它的 README 里 | `demo.html` | MIT |
| 插件 · [`components/liquid-glass`](components/liquid-glass) | **液态玻璃**：一块 WebGL2 画布，把标了 `data-glass` 的元素画成会弯、会拉长、会弹回的玻璃。带一页配方预览，一排滑杆现调现看。**是实时计算的**，README 里写了什么时候费电 | `demo.html` | MIT |

每个文件夹都是独立的：单独拷走一个就能用，各自的 README 里写着怎么装进你自己的页面、能调哪些参数。语音条和健康页不用液态玻璃也完整；想套上玻璃，照[液态玻璃的 README](components/liquid-glass#套在别的前端上) 三步接。

## 怎么打开

```bash
git clone https://github.com/TangfanOVO/qiaosi.git
cd qiaosi
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000 就是那台假手机
```

浏览器不让 `file://` 读模型和图片，所以要起一个本地服务器。手机上看效果最好。

## 协议

MIT，外加一条：讨厌蔡依林不能拿。见 [LICENSE](LICENSE)；窗台另有一份自己的 [LICENSE](scenes/windowsill/LICENSE)，还要留着电脑上那首《电话皇后》。
