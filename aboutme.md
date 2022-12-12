# About Andy

hello, I am Andy, an backend engineer in Shopee, a e-commerce company. When I were an university student, I used to intern at Baidu and Bytedance. I have worked for three companies in positions that use golang to develop. I have used go language to develop api gate way, wiki  website using micro service. Now I maintain and develop a time series database. I improve the performance of databases, and develop the new feature. I also do some work related with availability for example driving the migration of our services to kubernetes.

Below are the Chinese and English versions of my resume

# **基本信息**

- 姓名：Andy
- 电话：189-xxxx-xxxx
- 邮箱：[wuliwei1998@qq.com](mailto:wuliwei1998@qq.com)
- 求职意向：后端研发工程师

# 技能清单

- 后端：golang, mysql, gorm, redis
- 云原生：kubernetes, kubernetes operator/crd
- 时序数据库：Victoria Metrics, prometheus, grafana

# **教育经历**

## **北京信息科技大学-本科-计算机科学与技术 （2017.9～2021~7）**

- 2019ACM-ICPC国际大学生程序设计竞赛 亚洲区域赛银川站 铜奖
- 第十届蓝桥杯C/C++程序设计 大学B组 全国二等奖
- 2019ACM-ICPC国际大学生程序设计竞赛 全国邀请赛（西安）铜奖
- 英语四级 535分

# **工作经历**

## Shopee- engineer infra-监控平台组-后端工程师（2021.7～2022.12）

在Shopee工作期间，我参与了短链接项目和时序数据库项目的方案设计与工作，使用go语言作为主要开发，技术栈包括http server、k8s、Victoria Metrics，TiDB，redis，kafka。有时候需要和不同语种的同事沟通，因此在这段经历中我提升了英语交流能力，能够处理日常的听说读写。

### Shopee-时序数据库Victoria Metrics

**项目介绍**

Victoria Metrics（vm）是一个开源的高性能分布式时许数据库，是监控平台的核心组件之一。主要包括采集、写入、存储、查询、告警等模块，这些模块分开部署，有着很强的横向拓展能力。我们基于vm的社区版本开发了一系列用于提升vm可靠性的服务，同时修复社区版本存在的bug以及优化性能。

**项目难点**

作为一个公司级别的基础组件，主要难点在于服务的可用性以及时序数据的存储。为了提高服务整体的可用性和更容易运维，我们针对大部分组件开发了kubernetes operator，使得这些组件能够更好地按照租户来进行资源限制，以及提高服务可用性。为了处理时序写入时的高并发问题，我们将原来的写入组件拆分成“生产者+消息队列+消费者”的模式。为了提高告警的响应速度，我们基于otel collector和prometheus开发了实时告警链路。

**主要职责**

- 定期查看并且将社区提的issue在我们的版本中修复。
- 排查并修复SRE反馈的问题。
- 开发新功能，优化查询、告警等组件的性能。
- 开发kubernetes operator，推动各个组件容器化。

### Shopee-短链接项目

**项目介绍**

全公司范围使用的一个将长URL转换成短URL的项目，在内部的使用场景比如监控平台在内部IM发出的告警链接，在外部用于各种活动推广、分享时将长URL转换成短URL。本项目是一个用golang原生库开发的http服务，用redis做缓存，TiDB做持久化存储，同时还有Click House对短链的访问数据进行解析。在大促期间QPS峰值为2w。

**项目难点**

这个项目的难点在于短链key的不重复生成，这里使用的snowflake算法生成ID然后做字符串映射，为了兼容历史数据、使用redis来做重复校验的、同时还有TiDB兜底。

**主要职责**

负责核心模块short url（长链转短链，短链转长链的一个REST API服务）以及短链portal（通过调用short url来生成短链，同时提供一个可视化界面给用户生成短链以及显示历史记录）的开发。

### kubernetes operator for Victoria metrics

**项目介绍**

为了更方便运维、更好灵活地扩缩容以及提升服务可用性，我们针对Victoria Metrics时序数据库的各个组件开发了Custom Resource Definitions和kubernetes operator。让我们的数据库组件运行在k8s上。

**项目难点**

在项目前期需要学习很多k8s和operator开发相关的知识。后期主要需要和监控平台站点的同事沟通，做好租户信息的定义，以便能够定时按照站点里的租户信息创建相关资源。在这期间遇到了http长链接在加pod副本在无法负载均衡的问题，在了解了service的负载均衡后，通过自定义golang的http库的listener接口解决。

**主要职责**

- 定义CRD
- 为VictoriaMetrics的查询组件vmselect, 告警组件vmaler和其他内部自研组件开发operator。

## **字节跳动-头条百科-数据侧 后端研发实习生（2020.4～2021.3）**

在字节跳动实习期间主要参与大数据相关和golang微服务相关的工作。初步了解了微服务架构、大数据技术。参与了数据质量提升、数据看板搭建、以及数据仓库建设等工作。

### **头条百科-低质词条优化**

**项目介绍**

头条百科的词条创建和完善一方面靠机器自动处理简单任务，但大部分还是要靠奖励机制来吸引用户参与编辑和创建，在之前的任务下放主要靠人工在运营后台通过excel表下放任务，现在我们要通过机器把低质词条分类筛选出来，按搜索pv从大到小的顺序下放给任务。比如：无摘要图，摘要图尺寸小，无基本信息等。

数据处理处理流程大致如下：

通过Spark筛选出低质词条并对其进行归类导入到Hive表，如：无摘要图、摘要图尺寸小、无基本信息、摘要或正文包含无用信息等。将要下放的词条与不宜下放词条进行过滤之后形成任务表，通过Hive -> Kafka与线上服务对接进行任务下放。

**项目难点**

第一个难点在于用pySpark来解析词条JSON数据，形成任务表。第二个难点在于任务的下放基于用户创作社区的消费进度做调整，因此Hive SQL任务需要做相应的优化。

**主要职责**

负责离线数据的处理，比如用Spark筛选地址词条，编写Hive SQL生成任务表，用公司内部的数据平台将Hive传送到Kafka。消费Kafka生成线上任务的流程由其他同事开发。

### **无效内链去除**

**项目介绍**

在一个百科词条里存在另外一个词条的链接，我们称之为【内链】，内链在用户编辑时添加。但是随着词条状态的变更，比如一个词条下架，那么原来指向这个词条的内链就会失效，我们称之为【无效内链】。这个项目要做的定时地将无效内链剔除。

通过Spark并行对全量词条进行json解析，可以得到一张内链表，关键列是from ID和to ID，from表示存在内链的词条ID，to表示内链所指向的词条ID。然后通过hive sql来得到每个词条内链所指向的词条的状态，从而筛选出来已经下架的to ID。通过内部数据平台将数据从hive送到Kafka，在golang服务消费，把无效内链去除。

**项目难点**

难点在于解析词条的JSON数据，形成内链表。

**主要职责**

负责离线数据处理部分，用spark解析百科词条，将解析结果存到Hive。再用Hive筛选出来任务传送到Kafka，消费Kafka的部分由其他同事开发。



# Andy Wu, Shopee, Backend engineer
- Tel: (+86) 189-xxxx-xxxx
- email: wuliwei1998@qq.com

# WORK EXPERIENCE

## Back-end Internship in Baidu  (2019.10 ~ 2020.4)

- The main responsibility of our group is the development and maintenance of the back-end architecture of visual services. We assist in the implementation of algorithm models (Face Recognition, OCR, etc.) of various algorithm groups within the department, and provide visual technology support for Baidu Tie Ba, Xiao Du and other teams.
- Participate in the development of API gate way of Baidu visual platform

## Back-end Internship in Bytedance （2020.4～2021.3）

- In the Kuai Dong Bai Ke ([baike.com](http://baike.com)) department.
- The core goal of our group is to improve the quality of encyclopedia data
- I am mainly responsible for data statistics dashboard, data quality improvement, and data warehouse construction

## Back-end Engineer in Shopee

- The main task of the group is to develop and maintain the company's monitoring platform.
- I have been involved in the development of the URL shortener project and the time-series database Victoria Metrics.

# PROJECTS

## Data statistics dashboard in Bytedance

### Background

The daily operation and product design of [baike.com](http://baike.com) needs a lot of data for support. In order to facilitate Product Manager and Operations Manager and Engineer to view the data, we developed a user-friendly data dashboard to visualize the data of production, consumption and word quality of baike.com .

## Main Responsibilities

- develop the entire data chain: online MySQL → Hive → Spark → Hive → Data visualization platform → dash board.
- develop the hive SQL task.
- pySpark task
- making dashboard

## Time series database Victoria Metrics in Shopee

## Background

VictoriaMetrics is a fast, cost-effective and scalable monitoring solution and time series database. That is the core component of the monitoring platform. We develop base on the community version and do many development.

### Main Responsibilities

Regularly review and fix issues raised by the community in our releases. Troubleshoot and fix SRE feedback. Develop new features and drive deployments on kubernetes to improve availability. 

# EDUCATION

## ****Beijing Information Science & Technology University****

- Major: Computer Science
- Education: Bachelor's degree
- GPA: 3.0/5.0
- Passionate about Programming Contest
- The 2019 ICPC Asia Regional Ningxia Broze Medal
- Worked as a back-end engineer intern in Baidu and Bytedance



