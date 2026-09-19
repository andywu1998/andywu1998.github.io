---
layout: post
title: "Agent Runtime / 工作流工程师岗位要求逐条学习路线"
subtitle: "Codex 个人助理沉淀"
date: 2026-08-30 16:07:34 +0800
tags:
  - "个人助理"
  - "documents"
---

> 来源：`notes/documents/01_岗位要求逐条学习路线.md`
# Agent Runtime / 工作流工程师岗位要求逐条学习路线

## 0. 岗位定位

这是一份根据招聘截图整理的学习笔记。岗位核心不是“会调用大模型”，而是建设一个可靠的 Agent Runtime：它能把任务拆开、调度执行、保存状态、调用工具、处理失败、记录过程，并在需要时让人接管。

截图中的要求拆成 9 条：

1. 任务、会话、状态、上下文和执行记录管理。
2. 分支、并行、超时、重试、暂停恢复和人工确认。
3. 统一调用模型、RAG、API、MCP/函数工具和沙箱。
4. 全链路日志、错误分类、运行回放和版本回滚。
5. 影子运行、建议模式和受限执行。
6. 5 年以上后端、工作流引擎、调度系统或云平台经验。
7. 状态机、队列、幂等、重试补偿和可观测性。
8. LLM 调用的延迟、限流、格式漂移和工具误调用。
9. Python、Java、Go 或 TypeScript 至少一种。

学习这类岗位时，建议把“读资料”转成一个贯穿始终的练习项目：实现一个可以通过 HTTP/API 触发的工作流运行时，支持任务持久化、队列调度、工具调用、人工审批、失败恢复、日志追踪和回放。

# 1. 任务、会话、状态、上下文和执行记录管理

## 1.1 通俗解释要求

系统不能只接收一句用户话术然后直接调用模型。它需要知道：

- 这是哪个用户、哪个会话、哪个任务。
- 任务当前处于排队、运行、等待人工、成功还是失败。
- 前一步输出是什么，下一步需要哪些输入。
- 使用过哪个模型、工具和版本。
- 中途进程重启后，能否从上次进度继续，而不是全部重跑。

可以把它理解成“Agent 的订单系统 + 任务档案 + 工作现场”。建议至少设计 `Task`、`Session`、`Run`、`Step`、`Message`、`Artifact` 六类实体，并为每次执行保留版本号、输入摘要、输出引用、状态变化和时间戳。

## 1.2 相关博客和文档

- [Temporal: Durable Execution](https://temporal.io/blog/durable-execution-in-distributed-systems)：介绍“持久化执行”的思想。中文摘要：任务执行状态不能只放在进程内存里；系统应把关键进度持久化，使网络故障、进程重启和机器迁移不会让业务从头开始。
- [LangGraph: Persistence](https://langchain-ai.github.io/langgraph/concepts/persistence/)：中文摘要：通过 checkpoint 保存图执行状态，从而支持会话记忆、暂停、恢复、时间旅行调试和人工介入。
- [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)：中文摘要：不要只保存当前状态，也记录导致状态变化的事件；这样可以重建历史、审计行为和定位状态为何变成现在这样。

## 1.3 相关 GitHub 仓库

- [temporalio/temporal](https://github.com/temporalio/temporal)：持久化工作流引擎，适合研究 Workflow、Activity、History 和恢复机制。
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)：面向 Agent 的状态图框架，适合研究 checkpoint、状态节点和人工介入。
- [prefecthq/prefect](https://github.com/PrefectHQ/prefect)：现代 Python 工作流编排平台，适合观察任务、流、状态和运行记录如何组织。

## 1.4 如何学习这一点

1. 先用 PostgreSQL 设计任务表、执行表、步骤表和事件表，明确状态机和主键关系。
2. 实现 `POST /tasks`、`GET /runs/:id`、`POST /runs/:id/resume` 三个接口。
3. 强制每个步骤写入开始、成功、失败和产物引用，不允许只打印日志。
4. 杀掉 Worker 后重新启动，验证任务可以从最后一个成功步骤恢复。
5. 最终产出：ER 图、状态转换图、API 文档和一次故障恢复演示。

# 2. 分支、并行、超时、重试、暂停恢复和人工确认

## 2.1 通俗解释要求

真实工作流不会永远是一条直线。例如：

- 判断用户意图后，走不同分支。
- 同时搜索多个数据源，再汇总结果。
- 某个工具 5 秒没有响应就超时。
- 临时网络错误可以重试，参数错误不能无限重试。
- 风险操作必须暂停，等人批准后继续。

重点是把“流程控制”从模型输出中拿出来，由运行时负责。模型可以提出下一步建议，但超时、重试次数、权限和人工审批必须由确定性的系统代码执行。

## 2.2 相关博客和文档

- [Temporal: Workflows](https://docs.temporal.io/workflows)：中文摘要：工作流应具有确定性，外部副作用放在 Activity 中，并由引擎负责重试、超时和恢复。
- [Celery: Canvas](https://docs.celeryq.dev/en/stable/userguide/canvas.html)：中文摘要：`chain`、`group`、`chord` 等原语可以组合串行、并行和汇聚任务，是理解任务编排的直接材料。
- [AWS Prescriptive Guidance: Retry Backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)：中文摘要：重试应区分可重试错误和永久错误，并使用指数退避与抖动，避免大量任务同时再次打满下游服务。

## 2.3 相关 GitHub 仓库

- [temporalio/samples-go](https://github.com/temporalio/samples-go)：包含重试、信号、定时器和人工审批等工作流示例。
- [celery/celery](https://github.com/celery/celery)：研究队列任务、重试、Canvas 编排和 Worker 模型。
- [dagster-io/dagster](https://github.com/dagster-io/dagster)：研究有依赖关系的任务图、重跑和数据产物管理。

## 2.4 如何学习这一点

1. 实现一个“资料研究工作流”：并行抓取 3 个来源，汇聚后由模型生成总结。
2. 为每个节点定义 `timeout`、`retry_policy`、`fallback` 和 `compensation`。
3. 增加 `human_approval` 节点：运行暂停后由 API 提交批准或拒绝。
4. 编写故障注入测试：超时、重复投递、Worker 崩溃、审批后恢复。
5. 重点理解“重试不是重新执行一切”：副作用步骤必须具备幂等或补偿机制。

# 3. 统一调用模型、RAG、API、MCP/函数工具和沙箱

## 3.1 通俗解释要求

Agent Runtime 像一个“适配器层”。上层流程不应绑定某一个模型供应商或某一种工具格式，而应通过统一接口调用：

- 模型：聊天、结构化输出、流式响应。
- RAG：检索、重排、引用来源。
- API：HTTP、数据库和内部服务。
- MCP/函数工具：发现工具、校验参数、执行调用。
- 沙箱：隔离运行代码、脚本或不可信输入。

统一接口的价值是可替换、可观测、可限流和可审计。它不等于抹平所有差异；模型能力、错误码、上下文长度和工具权限仍需要保留在适配器的能力声明中。

## 3.2 相关博客和文档

- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/latest)：中文摘要：MCP 规定客户端、服务器、工具、资源和提示之间的交互方式，使模型能够以一致协议发现和使用外部能力。
- [OpenAI: Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)：中文摘要：函数调用应把工具定义、参数结构和模型决策分开，应用程序仍负责校验参数并真正执行函数。
- [LlamaIndex: Introduction to RAG](https://docs.llamaindex.ai/en/stable/understanding/rag/)：中文摘要：RAG 把检索步骤接入生成流程，让模型基于外部知识回答；工程上还要处理切分、召回、引用、权限和数据新鲜度。

## 3.3 相关 GitHub 仓库

- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)：MCP 官方/社区服务器示例，适合研究工具暴露方式和权限边界。
- [openai/openai-agents-python](https://github.com/openai/openai-agents-python)：研究 Agent、工具、交接和运行追踪的实现方式。
- [qdrant/qdrant](https://github.com/qdrant/qdrant)：向量数据库，可用于搭建 RAG 检索层。
- [firecracker-microvm/firecracker](https://github.com/firecracker-microvm/firecracker)：轻量虚拟机，适合研究工具执行和代码沙箱的隔离基础。

## 3.4 如何学习这一点

1. 定义统一的 `ModelProvider`、`Retriever`、`Tool`、`Sandbox` 接口。
2. 先接一个模型、一个向量库、两个 HTTP 工具和一个本地只读工具。
3. 为每个工具增加 JSON Schema 参数校验、权限标签、超时和审计记录。
4. 把工具执行放入容器或微型虚拟机，不允许直接继承宿主机全部权限。
5. 最终做一次“替换供应商”演练：只改适配器，不改工作流代码。

# 4. 全链路日志、错误分类、运行回放和版本回滚

## 4.1 通俗解释要求

当 Agent 结果错误时，不能只看到一句“执行失败”。系统应能回答：

- 哪个请求触发了运行？
- 经过了哪些节点？
- 每一步用了什么输入、模型、工具和版本？
- 失败是网络错误、限流、参数错误、权限错误还是模型输出不符合格式？
- 使用同样版本和输入，能否回放这次运行？
- 新版本有问题时，能否切回旧版本？

日志是机器排障材料，运行记录是业务审计材料，Trace 是跨服务时间线。三者要关联到同一个 `run_id`。

## 4.2 相关博客和文档

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)：中文摘要：OpenTelemetry 提供统一的 Trace、Metric 和 Log 采集模型，重点是跨服务传递上下文和使用一致的观测数据。
- [OpenTelemetry: Observability Primer](https://opentelemetry.io/docs/concepts/observability-primer/)：中文摘要：可观测性不是“多打日志”，而是通过系统输出推断内部状态，通常需要指标、日志和链路追踪组合。
- [Martin Fowler: Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)：中文摘要：把发布和启用解耦，用开关控制新版本流量，从而支持灰度、回滚和风险隔离。

## 4.3 相关 GitHub 仓库

- [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector)：研究日志、指标和 Trace 的采集、处理与导出。
- [jaegertracing/jaeger](https://github.com/jaegertracing/jaeger)：分布式 Trace 后端和查询界面。
- [grafana/loki](https://github.com/grafana/loki)：适合研究结构化日志聚合与查询。
- [open-feature/flagd](https://github.com/open-feature/flagd)：研究标准化 Feature Flag 和运行时开关。

## 4.4 如何学习这一点

1. 给每次运行生成 `trace_id`、`run_id`、`workflow_version` 和 `prompt_version`。
2. 让每个节点输出结构化事件，不要把 JSON 拼成普通字符串。
3. 建立错误分类表：可重试、需人工、永久失败、系统故障、策略拒绝。
4. 保存脱敏后的输入、输出和工具调用，做一个按时间线查看 Run 的页面。
5. 发布 v2 工作流时只放 10% 流量；发现错误后切回 v1，并验证历史运行仍可回放。

# 5. 影子运行、建议模式和受限执行

## 5.1 通俗解释要求

这是把 Agent 放进生产系统时的安全分级：

- 影子运行：新版本接收真实请求，但结果不影响用户和真实业务，只比较结果。
- 建议模式：Agent 可以给出方案或生成待执行动作，但必须由人确认。
- 受限执行：允许自动执行，但只能访问白名单工具、目录、数据和额度。

核心思想是先观察，再建议，最后在边界内自动执行，而不是一开始就让模型拥有写库、发消息、转账或执行代码的全部权限。

## 5.2 相关博客和文档

- [OpenFeature: Concepts](https://openfeature.dev/docs/reference/concepts)：中文摘要：通过统一的 Feature Flag 控制功能是否对特定用户、环境或流量生效，可用于灰度和回滚。
- [Google SRE Book: Canarying Releases](https://sre.google/sre-book/canarying-releases/)：中文摘要：金丝雀发布先让小比例流量使用新版本，用指标判断是否扩大范围，是降低发布风险的工程方法。
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)：中文摘要：AI 系统需要持续识别、评估和管理风险；对 Agent 来说，对权限、人工监督、日志和事件响应的要求尤其重要。

## 5.3 相关 GitHub 仓库

- [open-feature/spec](https://github.com/open-feature/spec)：Feature Flag 标准，适合理解开关抽象。
- [argoproj/argo-rollouts](https://github.com/argoproj/argo-rollouts)：支持金丝雀、蓝绿发布和指标驱动回滚。
- [google/gvisor](https://github.com/google/gvisor)：容器运行时隔离技术，适合研究受限执行。
- [open-policy-agent/opa](https://github.com/open-policy-agent/opa)：策略引擎，可用于定义工具、数据和资源访问策略。

## 5.4 如何学习这一点

1. 为工作流增加 `execution_mode`：`shadow`、`suggest`、`restricted`、`full`。
2. 影子模式只保存结果和差异，不产生外部副作用。
3. 建议模式生成待审批动作，人工批准后才进入执行队列。
4. 受限模式使用 OPA 或类似策略校验工具、参数、用户、环境和预算。
5. 设计安全测试：越权工具调用、提示词注入、恶意参数、沙箱逃逸和敏感信息泄露。

# 6. 5 年以上后端、工作流引擎、调度系统或云平台经验

## 6.1 通俗解释要求

这条不是单纯要求“工作年限”，而是要求能承担平台级系统的复杂性。面试官通常希望看到：

- 设计过高并发或异步系统。
- 处理过任务积压、重复消费、服务降级和故障恢复。
- 理解数据库、消息队列、缓存、容器和云服务之间的边界。
- 能把模糊需求拆成协议、状态、数据模型、服务和运维指标。

Agent Runtime 只是新的业务场景，底层仍然是后端平台工程。

## 6.2 相关博客和文档

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)：中文摘要：从服务等级目标、监控、容量、发布、事故响应等方面解释如何运营可靠系统。
- [Designing Data-Intensive Applications](https://dataintensive.net/)：中文摘要：围绕数据模型、复制、分区、事务、批处理和流处理建立分布式系统的整体视角。
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)：中文摘要：通过声明式资源、调度、滚动更新和自愈机制管理容器化服务，是理解云平台运行底座的重要材料。

## 6.3 相关 GitHub 仓库

- [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes)：研究调度、自愈、控制器和声明式 API。
- [etcd-io/etcd](https://github.com/etcd-io/etcd)：研究一致性 KV、租约和分布式协调。
- [nats-io/nats-server](https://github.com/nats-io/nats-server)：研究轻量消息系统和发布订阅。
- [hashicorp/nomad](https://github.com/hashicorp/nomad)：研究任务调度和集群资源编排。

## 6.4 如何学习这一点

1. 选择一个后端主语言，先完成 HTTP、数据库、并发、测试和部署基础。
2. 用 Docker Compose 搭建 API、PostgreSQL、Redis、Worker 和可观测性组件。
3. 设计一次容量实验：逐步增加任务量，记录吞吐、延迟、积压和失败率。
4. 做一次故障演练：杀掉 Worker、断开数据库、让队列堆积，然后写复盘。
5. 把项目文档写成“架构决策记录”，说明为什么选某种队列、存储和一致性方案。

# 7. 状态机、队列、幂等、重试补偿和可观测性

## 7.1 通俗解释要求

这条是岗位要求中的底层基本功：

- 状态机：任务允许从哪些状态转到哪些状态。
- 队列：把生产任务和执行任务解耦，并提供削峰和重试能力。
- 幂等：同一个请求执行两次，结果不能产生两份副作用。
- 重试补偿：失败后重新做，或执行反向动作恢复业务状态。
- 可观测性：通过指标、日志和 Trace 判断系统发生了什么。

Agent 场景里重复执行很常见，因此“幂等键 + 状态机 + 事件记录”比单纯增加重试次数更重要。

## 7.2 相关博客和文档

- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)：中文摘要：客户端为请求提供幂等键，服务端保存第一次结果；重复请求返回同一结果，避免网络重试造成重复扣款等问题。
- [Redis: Streams](https://redis.io/docs/latest/develop/data-types/streams/)：中文摘要：Redis Streams 提供消息追加、消费者组、确认和待处理消息列表，可用于学习队列消费与故障接管。
- [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)：中文摘要：监控应围绕延迟、流量、错误和饱和度等信号，避免只收集大量无法行动的指标。

## 7.3 相关 GitHub 仓库

- [redis/redis](https://github.com/redis/redis)：研究 Streams、队列、锁和缓存。
- [rabbitmq/rabbitmq-server](https://github.com/rabbitmq/rabbitmq-server)：研究消息确认、路由、死信和消费者模型。
- [open-telemetry/opentelemetry-demo](https://github.com/open-telemetry/opentelemetry-demo)：可运行的多服务可观测性演示。

## 7.4 如何学习这一点

1. 实现一个带 `idempotency_key` 的任务提交接口。
2. 设计状态转换校验，禁止任意状态直接覆盖。
3. 为消息消费加入 ack、超时、死信和重放机制。
4. 为外部副作用设计去重表或业务幂等键，并测试重复投递。
5. 画出“请求进入到工具执行”的 Trace，增加任务吞吐、排队时长、成功率和重试次数指标。

# 8. LLM 调用的延迟、限流、格式漂移和工具误调用

## 8.1 通俗解释要求

大模型调用不像普通函数调用那样稳定：

- 首 token 和完整响应有延迟，流式输出也可能中断。
- 供应商有请求数、并发数、Token 或费用限制。
- 同一个提示词不保证每次都返回完全相同的格式。
- 模型可能选择不该调用的工具，或传入语义正确但业务危险的参数。

因此，模型输出必须被视为“不可信的外部输入”。运行时要做超时、限流、结构化校验、重试、降级、工具权限和人工确认。

## 8.2 相关博客和文档

- [OpenAI: Production Best Practices](https://platform.openai.com/docs/guides/production-best-practices)：中文摘要：生产环境需要处理限流、重试、缓存、监控、密钥安全和成本控制，而不是只验证一次调用成功。
- [OpenAI Cookbook: Structured Outputs](https://cookbook.openai.com/examples/structured_outputs_intro)：中文摘要：通过结构化输出约束响应形状，降低解析失败，但不能替代业务校验和权限判断。
- [OpenAI Cookbook: Handling Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits)：中文摘要：限流处理通常需要指数退避、抖动、并发控制和合理的请求排队。

## 8.3 相关 GitHub 仓库

- [openai/openai-cookbook](https://github.com/openai/openai-cookbook)：包含结构化输出、限流、评测和 Agent 工程示例。
- [BerriAI/litellm](https://github.com/BerriAI/litellm)：统一多个模型供应商的调用接口，并提供路由、预算和观测能力。
- [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails)：研究输出校验、重试和安全护栏。
- [pydantic/pydantic](https://github.com/pydantic/pydantic)：用类型和 Schema 校验模型输出与工具参数。

## 8.4 如何学习这一点

1. 建立模型适配器，统一响应、错误、Token 使用量和延迟字段。
2. 对模型输出使用 JSON Schema/Pydantic 校验，失败时有限重试并记录原始响应。
3. 实现令牌桶或并发信号量限流，分别控制用户、模型和供应商维度。
4. 给工具调用增加“模型建议 -> 参数校验 -> 权限校验 -> 执行”的四段式流程。
5. 建立最小评测集，持续测试格式遵循率、工具选择准确率、拒绝危险操作能力和成本。

# 9. Python、Java、Go 或 TypeScript 至少一种

## 9.1 通俗解释要求

岗位并不要求四种语言都精通，而是要求至少有一种语言能够独立完成生产级后端：

- 写清晰的模块和接口。
- 处理并发、网络、错误和超时。
- 连接数据库、消息队列和外部 API。
- 编写测试、日志、配置和部署脚本。
- 能读懂其他语言实现的基础设施组件。

选择建议：Python 适合 Agent、RAG 和快速原型；Go 适合高并发服务、Worker 和基础设施；TypeScript 适合全栈和 Node.js Agent 服务；Java 适合成熟企业后端和大规模平台。

## 9.2 相关博客和文档

- [Python asyncio Documentation](https://docs.python.org/3/library/asyncio.html)：中文摘要：理解协程、事件循环、任务和取消机制，适合构建 I/O 密集型 Agent 服务。
- [A Tour of Go](https://go.dev/tour/)：中文摘要：通过短小练习学习 Go 语法、接口、并发和错误处理。
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)：中文摘要：通过类型系统、泛型和控制流分析减少工具参数、API 数据和状态对象的运行时错误。
- [Java Concurrency Tutorial](https://docs.oracle.com/javase/tutorial/essential/concurrency/)：中文摘要：学习线程、同步、执行器和并发工具，为调度系统和企业后端打基础。

## 9.3 相关 GitHub 仓库

- [tiangolo/fastapi](https://github.com/fastapi/fastapi)：Python 异步 API 和类型校验实践。
- [gin-gonic/gin](https://github.com/gin-gonic/gin)：Go Web 服务实践。
- [spring-projects/spring-boot](https://github.com/spring-projects/spring-boot)：Java 企业级服务实践。
- [nestjs/nest](https://github.com/nestjs/nest)：TypeScript 模块化后端实践。

## 9.4 如何学习这一点

1. 只选一门主语言，使用它完成本项目的 API、Worker、测试和部署。
2. 用同一套接口实现任务提交、状态查询、审批恢复和工具调用。
3. 做并发实验，理解连接池、协程/线程、取消、超时和资源释放。
4. 阅读另两种语言的同类项目，只关注接口、并发模型和错误处理差异。
5. 最终产出一个可以本地一键启动的仓库，并附带测试、架构图和故障演练记录。

# 10. 综合学习路线和建议项目

## 10.1 八周路线

1. 第 1 周：后端服务、PostgreSQL 数据模型、任务状态机。
2. 第 2 周：Redis/RabbitMQ 队列、Worker、ack、死信和幂等。
3. 第 3 周：工作流 DAG、分支、并行、超时和重试。
4. 第 4 周：模型适配器、结构化输出、RAG 和工具协议。
5. 第 5 周：MCP、权限策略、容器/微型虚拟机沙箱。
6. 第 6 周：OpenTelemetry、Trace、结构化日志、运行回放。
7. 第 7 周：影子运行、建议模式、人工审批和灰度发布。
8. 第 8 周：故障注入、压力测试、成本分析和项目文档。

## 10.2 最小可交付项目

实现一个“研究任务 Agent Runtime”：

- 用户提交一个研究主题。
- 系统并行检索多个来源。
- 模型提取结构化结论。
- 需要写入文件或发送消息时进入人工审批。
- 工具执行在受限沙箱内完成。
- 每一步产生 Trace、日志和可回放记录。
- Worker 崩溃后可以恢复。
- 新版本先影子运行，再按比例灰度。

## 10.3 面试前自测问题

- 如果任务执行到一半进程崩溃，如何知道从哪里恢复？
- 同一个支付/发消息工具被投递两次，如何保证不产生重复副作用？
- 什么错误应该重试，什么错误应该立即失败？
- 模型返回了合法 JSON，但工具参数会造成越权，系统如何拦截？
- 如何区分模型慢、队列堵塞、数据库慢和下游 API 慢？
- 如何让新版本 Agent 读取真实流量但不影响真实业务？
- 如何回放一次历史运行，同时避免重新执行真实副作用？

## 10.4 下一步动作

- [ ] 选择主语言：Python、Go、TypeScript 或 Java。
- [ ] 创建 `agent-runtime-lab` 实验仓库。
- [ ] 先完成任务状态机和 `POST /tasks`、`GET /runs/:id` 接口。
- [ ] 加入一个队列和可重启 Worker。
- [ ] 加入一个模型、一个 RAG 检索器和两个受限工具。
- [ ] 用 OpenTelemetry 串起 API、队列、Worker 和工具执行 Trace。
- [ ] 完成一次故障注入并写复盘。
