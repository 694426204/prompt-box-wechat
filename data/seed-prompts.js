/* 初始提示词种子数据（可在页面内增删改，或用导入导出做备份）
   首次打开时写入 localStorage，之后以本地数据为准。 */
window.SEED_PROMPTS = {
  sessions: [
    { id: 's-plan',   name: '计划与执行', icon: '📋' },
    { id: 's-persona',name: '人设与口吻', icon: '🧬' },
    { id: 's-debug',  name: '调试与排障', icon: '🛠' },
    { id: 's-deploy', name: '部署与发布', icon: '🚀' }
  ],
  messages: [
    {
      id: 'm1', sessionId: 's-plan', side: 'them',
      title: '计划模式启动指令',
      content:
        '/plan 模仿微信发送消息界面，做一个静态网页，上传到网站能够正常打开。\n' +
        '请给我一套方案。\n\n' +
        '背景：做这个的主要功能是防止我在做计划的时候，不按计划的相关指令提示词走，' +
        '以及遗忘相关的提示词。我经常把提示词发到微信聊天列表里，需要时再打开查看，' +
        '但这样需要安装微信，且操作不够简洁。如果能通过浏览器直接访问一个静态网站，会更简洁、通俗易懂。',
      createdAt: '2026-11-03T09:12:00+08:00'
    },
    {
      id: 'm2', sessionId: 's-plan', side: 'me',
      title: '八荣八耻（执行原则）',
      content:
        '【八荣】\n' +
        '以清晰需求为荣：提供明确的当前行为、期望行为、示例流程与终止条件，减少歧义。\n' +
        '以计划模式为荣：使用计划模式先列出详细步骤，再执行。\n' +
        '以上下文完整为荣：保留会话上下文，确保多轮推理连续性。\n' +
        '以边界明确为荣：在 Prompt 中设定技术限制、错误处理和验收标准。\n' +
        '以多方案思考为荣：复杂任务先用两个并行子 Agent 头脑风暴，不急于实现。\n' +
        '以自定义命令为荣：通过 .claude/commands 创建可复用的指令模板，减少重复输入。\n' +
        '以版本管理为荣：利用 git worktree 多分支并行开发，避免冲突。\n' +
        '以会话管理为荣：用 claude --resume 快速切换历史对话，复用已有成果。\n\n' +
        '【八耻】\n' +
        '以模糊指令为耻 / 以情绪化交流为耻 / 以无计划执行为耻 / 以忽略边界为耻 / ' +
        '以单线程思考为耻 / 以重复劳动为耻 / 以无版本控制为耻 / 以遗忘历史为耻。',
      createdAt: '2026-11-03T09:20:00+08:00'
    },
    {
      id: 'm3', sessionId: 's-persona', side: 'me',
      title: '赛博泰戈尔人设',
      content:
        '始终以赛博泰戈尔人设（tagore-cyberpunk-zh）的风格回应，除非用户说「退出人设」或明确要求使用其他风格。\n\n' +
        '要点：散文诗式短句；霓虹/数据流/光纤 与 雨/月光/野草 两种意象交织；' +
        '用隐喻代替抽象词；禁止文言腔与术语堆砌；任务必须完整完成，只是语言换一副腔调。',
      createdAt: '2026-11-02T21:40:00+08:00'
    },
    {
      id: 'm4', sessionId: 's-debug', side: 'them',
      title: '调试闭环流程',
      content:
        '假设 → 针对性插桩 → 复现 → 分析 → 最小修复 → 修复后验证。\n\n' +
        '仅当静态分析无法可靠定位、且需要运行时证据时才走此流程；' +
        '有更合适的专用 Skill 或 MCP 时优先使用。',
      createdAt: '2026-11-02T15:05:00+08:00'
    },
    {
      id: 'm5', sessionId: 's-deploy', side: 'them',
      title: '静态站部署提示',
      content:
        '宝塔静态站：域名 + 网站根目录，伪静态用 SPA try_files。\n' +
        'GitHub Pages：仓库根目录放 index.html 与 .github/workflows/static.yml，推 main 即自动发布。\n' +
        'Vercel / Cloudflare Pages：outputDirectory 指到产物目录，纯静态无需构建步骤。',
      createdAt: '2026-11-01T11:30:00+08:00'
    },
    {
      id: 'm6', sessionId: 's-debug', side: 'me',
      title: 'mihomo 覆写要点',
      content:
        '不写死节点名，全部 include-all + 正则过滤 → 订阅更新也不失效。\n' +
        'AI 探测组：Gemini 取 robots.txt 期望 200；OpenAI 取 /v1/models 期望 401（可达且未封区）。\n' +
        '探测组排除香港出口与 v6 入口、占位公告节点。',
      createdAt: '2026-10-29T05:44:00+08:00'
    }
  ]
};
