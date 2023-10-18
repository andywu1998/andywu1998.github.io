# context简介
一个用于go routine之间传播取消信号，过期信号和普通变量值的内部库。

context是一个用于在不同的go routine之间传递变量和取消信号的库。

context接口的具体实现可以分为两大类，传值和传取消信号。

1. 传值，用valueCtx来实现，每个valueCtx包含key和value两个interface，还嵌入一个Context接口作为父context。对context写值的方式是context.WithValue(parent, key, value)。其实就是给定一个父context，然后包装一个子context，这个子context的父节点是传进来的context，同时它维护了传给他的key和value作为它的字段。
当我们对一个context做调Value方法的时候，它首先判断当前节点的key是不是要找的key，如果不是的话，继续递归找它的父节点。直到找到根或者找到为止。

2. 传取消信号，传取消信号用cancelCtx来实现。在调用context.WithCancel的时候返回一个包装好的context和一个cancelFunc，当用户调用cancelFunc的时候就传递了取消信号。
在另外一个go routine里，用select监听ctx.Done()，Done的返回值是一个channel，一旦channel收到close信号，就表示收到取消信号。可以取消go routine的运行。

在WithCancel基础之上，还有一个WithCancelCause接口，它返回也是cancelCtx，不过后面跟随的是CancelCauseFunc，CancelCauseFunc和CancelFunc的区别在于CancelCauseFunc允许用户传一个error值。其他go routine可以调用context.Err()来查看这个Error。

在普通的手动取消的实现cancelCtx基础上，还实现了定时取消。定时取消是用timerCtx实现的。timerCtx在继承了cancelCtx的基础上，多了timer和和deadline字段。timer是time.Timer，deadline是time.Time。用于time.Timer来实现定时取消，其实就是定时调用cancelCtx的cancelFunc。

timerCtx对外有两个接口，一个是withDeadline，接受的是一个具体的时间。一个是WithTimeout，withTimeout接收的是一个时间长度，其实也是用当前时间加上时间长度之后直接调用WithDeadline来实现。

总的来说，context分为两大类，一类是传值。用valueCtx来实现。一类是传取消信号，传取消信号又分为手动取消和定时取消两种。手动取消有不接收error的cancelFunc，也有接收error的cancelCauseFunc。定时取消的时间是手动取消的基础上加上定时器和一个时间戳，它对外有两种接口，一种接收时间戳，一种接收时间长度。本质上接收时间长度也会直接用当前时间加上时间长度转成时间戳。

```go
type timerCtx struct {
	*cancelCtx
	timer *time.Timer // Under cancelCtx.mu.

	deadline time.Time
}
```

done     atomic.Value

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

## 3. 设定超时时间和DDL
设置超时时间（时间长度）和设置DDL（时间戳）本质上是一样的。简单来说就是设定一个时间，到时间后ctx.Done()会传入一个close信号。
```go
func TestWithDDL() {
	timeout := 2 * time.Second
	ctxWithDeadLine, _ := context.WithDeadline(context.Background(), time.Now().Add(timeout))
	ctxWithTimeout, _ := context.WithTimeout(context.Background(), timeout)

	go withCancel("ddl", ctxWithDeadLine)
	go withCancel("timeout", ctxWithTimeout)

	time.Sleep(5 * time.Second)
}

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
```go
// A timerCtx carries a timer and a deadline. It embeds a cancelCtx to
// implement Done and Err. It implements cancel by stopping its timer then
// delegating to cancelCtx.cancel.
type timerCtx struct {
	*cancelCtx
	timer *time.Timer // Under cancelCtx.mu.

	deadline time.Time
}
```
timerCtx里面包含了一个cancelCtx，用来实现Done和Err函数。它通过停止计时器来实现取消，然后委托给concelCtx.cancel

## valueCtx
valueCtx实现了携带键值对
```
// A valueCtx carries a key-value pair. It implements Value for that key and
// delegates all other calls to the embedded Context.
type valueCtx struct {
	Context
	key, val any
}
```

这里实现的是“上下文传值”

# 源码解析 ctx.Value
对于valueCtx来说，它实现value的方式是，先看一下当前的ctx的key是不是要找的key，如果是的话直接返回，不是的话则把父Ctx设置为当前ctx，然后继续查找。简单来说就是一层一层往上找。

```go
func (c *valueCtx) Value(key any) any {
	if c.key == key {
		fmt.Println("return in Value")
		return c.val
	}
	return value(c.Context, key)
}

func value(c Context, key any) any {
	i := 0
	for {
		i++
		fmt.Println("i", i)
		switch ctx := c.(type) {
		case *valueCtx:
			fmt.Println("valueCtx")
			if key == ctx.key {
				fmt.Println("return")
				return ctx.val
			}
			c = ctx.Context
		case *cancelCtx:
			fmt.Println("cancelCtx")

			if key == &cancelCtxKey {
				fmt.Println("return")
				return c
			}
			c = ctx.Context
		case *timerCtx:
			fmt.Println("timerCtx")

			if key == &cancelCtxKey {
				fmt.Println("return")
				return ctx.cancelCtx
			}
			c = ctx.Context
		case *emptyCtx:
			fmt.Println("emptyCtx")
			return nil
		default:
			fmt.Println("default")
			return c.Value(key)
		}
	}
}
```

# 源码解析，如何实现父context取消的时候，子context也取消？
在构建cancleCtx的时候，调用propagateCancel来实现父子绑定
```go
func WithCancel(parent Context) (ctx Context, cancel CancelFunc) {
	c := withCancel(parent)
	return c, func() { c.cancel(true, Canceled, nil) }
}
func withCancel(parent Context) *cancelCtx {
	if parent == nil {
		panic("cannot create context from nil parent")
	}
	c := newCancelCtx(parent)
	propagateCancel(parent, c)
	return c
}
```

```go
func propagateCancel(parent Context, child canceler) {
	done := parent.Done()
	if done == nil {
		return // parent is never canceled
	}

	select {
	case <-done:
		// parent is already canceled
		child.cancel(false, parent.Err(), Cause(parent))
		return
	default:
	}

	if p, ok := parentCancelCtx(parent); ok {
		p.mu.Lock()
		if p.err != nil {
			// parent has already been canceled
			child.cancel(false, p.err, p.cause)
		} else {
			if p.children == nil {
				p.children = make(map[canceler]struct{})
			}
			p.children[child] = struct{}{}
		}
		p.mu.Unlock()
	} else {
		goroutines.Add(1)
        // 启动一个go routine来监听parent的Done，如果parent.Done()收到信号，就调用child.cancel
		go func() {
			select {
			case <-parent.Done():
				child.cancel(false, parent.Err(), Cause(parent))
			case <-child.Done():
			}
		}()
	}
}
```

这里用到的parentCancelCtx，在慢慢解析

```go

// parentCancelCtx returns the underlying *cancelCtx for parent.
// It does this by looking up parent.Value(&cancelCtxKey) to find
// the innermost enclosing *cancelCtx and then checking whether
// parent.Done() matches that *cancelCtx. (If not, the *cancelCtx
// has been wrapped in a custom implementation providing a
// different done channel, in which case we should not bypass it.)
func parentCancelCtx(parent Context) (*cancelCtx, bool) {
	done := parent.Done()
	if done == closedchan || done == nil {
		return nil, false
	}
	p, ok := parent.Value(&cancelCtxKey).(*cancelCtx)
	if !ok {
		return nil, false
	}
	pdone, _ := p.done.Load().(chan struct{})
	if pdone != done {
		return nil, false
	}
	return p, true
}


```