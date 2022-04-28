1. 登陆https://nideriji.cn 
2. 打开浏览器的开发者模式，复制auth
3. 把auth粘贴到22行
4. python main.py就可以了，可能需要安装requests包，这个自行用搜索引擎查怎么安装

![ndrj.png](/assets/img/ndrj.png)


```
# This is a sample Python script.

# Press ⌃R to execute it or replace it with your code.
# Press Double ⇧ to search everywhere for classes, files, tool windows, actions, and settings.
import json
import time
import csv

import requests

# 输入你自己的auth
auth = '[连方括号一起去掉然后换成你的auth]'
headers_dict = {"auth": auth}

def get(url):
    resp = requests.get(url, headers=headers_dict)
    time.sleep(0.5)
    return resp
def get_dirary_id(year, month):
    url = "https://nideriji.cn/api/diary/simple_by_month/{}/{}/".format(year, month)
    print(url)
    resp = get(url)
    resp_json = resp.json()
    return resp_json['diaries']

def get_diary_from_id(id):
    url = 'https://nideriji.cn/api/diary/{}'.format(id)
    resp = get(url)
    resp_json = resp.json()
    return resp_json

def get_diary(a):
    global auth
    auth = a
    csvfile = open('eggs1.csv', 'w', newline='\n')

    spamwriter = csv.writer(csvfile, delimiter=',')

    for year in range(2017,2023):
        for month in range(1, 13):
            print(year, month)
            id_map = get_dirary_id(year, month)
            for key in id_map:
                id = id_map[key]
                print(key, id_map[key])
                resp = get_diary_from_id(id)
                print(resp)
                res = json.dumps(resp, ensure_ascii=False)
                csvfile.write(res + '\n')
                csvfile.flush()

def print_hi(name):
    # Use a breakpoint in the code line below to debug your script.
    print(f'Hi, {name}')  # Press ⌘F8 to toggle the breakpoint.
    get_dirary_id(2021, 3)

# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    get_diary()
# See PyCharm help at https://www.jetbrains.com/help/pycharm/

```