# Studio 设置页信息架构 SSOT

这份文档定义 Studio 设置页如何把 App/Framework 的真实投影交给用户。它是
UI 归属和文案的产品 SSOT；安装、启用、可调用、连接和载体关系仍由 App/
Framework projection 负责，Studio 不建立第二份状态。

## 用户任务与页面归属

| 用户要做什么 | 设置页位置 | Studio 读取的 owner projection | 展示规则 |
| --- | --- | --- | --- |
| 登录 OPL Gateway、切换 API Key 或账户 | 账户与访问 | `app_state.settings_control_center.app_settings_read_model` | 未连接、API Key、OPL Gateway 账户三种状态互斥；已登录时只展示账户详情和“更换访问方式” |
| 连接微信、查看绑定状态、扫码或退出 | 资源与连接 | `settings.section` 中 `view_type=channel_access` | 微信是连接/通道能力，不进入智能体目录；操作继续通过 App action 执行 |
| 查看标准智能体和工作流 | 智能体 | `app_state.agent_packages.directory + status_index` | 只显示 `standard_agent` 与 `workflow_profile`；保留“官方 / 全部”筛选；显示安装、启用、调用、启动四个状态轴 |
| 添加自行开发或第三方智能体 | 智能体 | `app_state.actions#install_from_manifest_url` | 输入作者提供的 manifest URL 和明确 trust tier；先 dry-run，用户确认后才执行并刷新目录 |
| 查看 Skills、插件、能力包和模块贡献 | 能力 | 包目录 + `settings.section` 中未归入连接/服务的贡献 | 展示所有 capability package；通用渲染，不硬编码某个包的 ID 或页面 |
| 查看本机 Fleet Agent 的遥测/诊断 | 服务状态 | `settings.section` 中 `view_type=activity_log` | 两个视图归在同一个“已安装模块”区域；这是同一个 `opl-fleet-agent` Package 的两个贡献，不声称等同于独立 macOS App |
| 查看后台服务、运行环境与修复动作 | 服务状态 | `app_state.settings_control_center` + runtime projection | 只展示 owner 提供的状态和 action，不在 Studio 推断服务健康 |
| 查看安装包和数据用量 | 数据与存储 | `app_settings_read_model.storage_lifecycle` | 未盘点/过期/未配置不能显示为 0；刷新只触发 owner inventory action |

## 目录口径

智能体页只接收 `standard_agent` 和 `workflow_profile`。`官方` 是 OPL publisher
提供的基线目录，`全部` 是基线加用户手动安装的标准智能体/工作流；两者的筛选
不能混入 Skills、插件、连接或 capability package。

当前只有官方条目时，“官方”和“全部”结果相同是正确状态，不代表切换失效；Studio
必须明确提示“当前没有自定义智能体”。自定义条目不会因为被安装就自动成为首页
默认快捷入口，是否显示仍由 App 的 exposure preference action 决定。

“添加智能体”只消费 `install_from_manifest_url`。这个 action 必须由 App/Framework
提供 `manifest_url`、`trust_tier`、`dry_run_supported` 和确认要求；Studio 不解析、
下载、安装或维护第二份 Package registry。能力包、Skills、插件和连接模块进入
能力、资源与服务状态页面，由它们各自的 owner projection 提供。

## Fleet Agent 关系边界

`opl-fleet-agent` 在当前投影中是一个 `capability_package`，由一个 Codex
plugin carrier 安装，并声明两个 `settings.section` view：

- `fleet.agent.telemetry-settings` -> `fleet.agent.telemetry`
- `fleet.agent.doctor-settings` -> `fleet.agent.doctor`

这证明的是 Framework Package/贡献投影关系，不足以证明独立 macOS Fleet Agent
App 的安装、进程状态或载体等价。若未来需要显示独立 App，必须由 App/Framework
新增明确的 carrier/runtime projection；Studio 不通过路径、进程名或包 ID 猜测。

## 当前实现与剩余边界

- 已实现：贡献按 view 语义嵌入既有设置页；微信连接视图不再成为顶级设置项；
  Fleet 两个贡献不再生成两个顶级设置导航项；智能体页保留官方/全部筛选并提供
  App-owned 的添加入口。
- 保留：包生命周期动作、连接动作、运行服务动作仍只走 App action contract。
- 未宣称：独立 Fleet App 的安装/运行资格、发布资格或载体替换；这些不是当前
  Studio projection 的证据。
