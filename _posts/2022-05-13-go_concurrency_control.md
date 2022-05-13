---
title: golang并发数控制
date: 2022-05-13 15:27:00
tags: golang

---
---

在vmalert的代码里学到了一种控制并发数量的方法，指定并发数为concurrency，开一个concurrency长度的channel，每个routine执行的时候先往channel里塞空结构体，执行完了就把channel里的东西取出来。当channel满的时候就会塞不进去，就会阻塞住，从而控制了并发数。 

```go
package concurrency

import (
	"fmt"
	"sync"
	"time"
)

type Rule struct {
	ID int
}

type Group struct {
	concurrency int
	currentConcurrency int
	mutex sync.Mutex
	rules []Rule
}

func NewGroup(concurrency int, ruleNum int) Group {
	g := Group{
		concurrency: concurrency,
	}
	for i := 0; i < ruleNum; i++ {
		g.rules = append(g.rules, Rule{ID: i})
	}
	return g
}

func (r *Rule) Run() {
	// do your job
	time.Sleep(time.Second)

}

func (g Group) Start() {
	concurrencyChan := make(chan struct{}, g.concurrency)
	wg := &sync.WaitGroup{}
	for _, rule := range g.rules {
		wg.Add(1)
		go func(wg *sync.WaitGroup, rule2 Rule) {
			defer wg.Done()
			defer func() {
				<- concurrencyChan
			}()
			concurrencyChan <- struct{}{}

			g.mutex.Lock()
			g.currentConcurrency++
			fmt.Printf("%v, start to run %v, concurrency num: %v\n", time.Now(), rule2.ID, g.currentConcurrency)
			g.mutex.Unlock()

			rule2.Run()

			g.mutex.Lock()
			g.currentConcurrency--
			fmt.Printf("%v, finish to run %v, concurrency num: %v\n", time.Now(), rule2.ID, g.currentConcurrency)
			g.mutex.Unlock()

		}(wg, rule)
	}
	wg.Wait()
}
```