# context简介
一个用于go routine之间传播取消信号，过期信号和普通变量值的内部库。

# 接口定义：
```go
type Context interface {

	Deadline() (deadline time.Time, ok bool)
	Done() <-chan struct{}
	Err() error
	Value(key any) any
}
```

# 使用
## 1. 上下文传值
```go
package main

import (
	"context"
	"fmt"
	"time"
)

const (
	key = "key"
)

func PrintlnValue(ctx context.Context) {
	fmt.Println("value = ", ctx.Value(key))
}

func TestWithValue() {
	ctx := context.WithValue(context.Background(), key, "hello")

	go PrintlnValue(ctx)
	time.Sleep(time.Second)
}

func main() {

	TestWithValue()
}
```

## 2. 取消go routine
这功能用于一个go routine创建另外一个go routine的时候，父go routine能够取消运行子go routine。
并且，当一个cancel context父节点取消的时候，它的子节点也会取消。

下面的代码创建了一个父context，两个子context，先取消子context 1，context2不自己取消，而是用父context取消，仍然是生效的。

```go
func withCancel(name string, ctx context.Context) {

	ticker := time.Tick(time.Second)
	count := 0
	for {
		select {
		case <-ticker:
			fmt.Printf("%v excute %v times\n", name, count)
			count++
		case <-ctx.Done():
			fmt.Printf("%v canceled\n", name)
			return
		}

	}
}

func TestWithTimeOut() {

	// 新建一个cancle context
	ctx, cancel := context.WithCancel(context.Background())
	// 用上面的ctx当作父节点，创建两个子节点context
	childCtx1, childCancel1 := context.WithCancel(ctx)
	childCtx2, _ := context.WithCancel(ctx)
	go withCancel("parent", ctx)
	go withCancel("child 1", childCtx1)
	go withCancel("child 2", childCtx2)

	// sleep 5s之后取消子节点1，父节点和子节点2仍然运行
	time.Sleep(5 * time.Second)
	childCancel1()

	// 再sleep 5s后取消父context
	time.Sleep(5 * time.Second)

	cancel()

	time.Sleep(5 * time.Second)
}
```

# 四种实现
context接口在context里有四种实现，emptyCtx, 
## emptyCtx
一般用于初始化一个context，不包含任何内容，只是定义了函数。
## cancelCtx
一个cancelCtx可以被取消，当它取消的时候，它的子节点也会被取消。
```go
// A cancelCtx can be canceled. When canceled, it also cancels any children
// that implement canceler.
type cancelCtx struct {
	Context

	mu       sync.Mutex            // protects following fields
	done     atomic.Value          // of chan struct{}, created lazily, closed by first cancel call
	children map[canceler]struct{} // set to nil by the first cancel call
	err      error                 // set to non-nil by the first cancel call
	cause    error                 // set to non-nil by the first cancel call
}
```
一般用WithCancel来构造一个CancelContext，返回值包括一个Context接口和一个CancelFunc，返回的CancelFunc的时候表示这个context取消了。
```go
func WithCancel(parent Context) (ctx Context, cancel CancelFunc) {
	c := withCancel(parent)
	return c, func() { c.cancel(true, Canceled, nil) }
}
```

```go
func withCancel(parent Context) *cancelCtx {
	if parent == nil {
		panic("cannot create context from nil parent")
	}
	c := newCancelCtx(parent)
	propagateCancel(parent, c)
	return c
}

func newCancelCtx(parent Context) *cancelCtx {
	return &cancelCtx{Context: parent}
}
```
## timerCtx
## valueCtx