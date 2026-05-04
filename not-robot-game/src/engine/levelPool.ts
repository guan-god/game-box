import { Template } from './levelTypes';
export const pool:Template[]=[
...['我不是机器人','我已满18岁','我确认继续'].map((t,i)=>({id:`c${i}`,name:`复选框 ${i+1}`,type:'checkbox_hunt' as const,task:`勾选“${t}”`,hint:'文字越标准，越可能可信。'})),
...['同意','继续','确认提交','开始验证','进入下一步','提交确认'].map((t,i)=>({id:`b${i}`,name:`按钮洪水 ${i+1}`,type:'button_flood' as const,task:`点击“${t}”`,hint:'太主动靠近你的，通常不可信。'})),
...['滑块到终点','滑块避开陷阱','怀疑值归零'].map((t,i)=>({id:`s${i}`,name:`滑块陷阱 ${i+1}`,type:'slider_trap' as const,task:t,hint:'红色不一定永远危险，观察节奏。'})),
...['输入验证码','输入反向验证码','输入不被篡改验证码'].map((t,i)=>({id:`i${i}`,name:`输入干扰 ${i+1}`,type:'input_corruption' as const,task:t,hint:'问题可能不在你输入了什么。'})),
...['等待并不要点击','等待系统校验','倒计时期间不操作'].map((t,i)=>({id:`p${i}`,name:`耐心测试 ${i+1}`,type:'patience_test' as const,task:t,hint:'等待也是一种操作。'})),
...['选择真正的猫','选择安全项','选择没有错别字的词'].map((t,i)=>({id:`g${i}`,name:`网格选择 ${i+1}`,type:'grid_select' as const,task:t,hint:'别被“像”这个字骗了。'})),
...['排序起床流程','排序写作业流程','排序提交流程'].map((t,i)=>({id:`d${i}`,name:`拖拽排序 ${i+1}`,type:'drag_sort' as const,task:t,hint:'着急验证更容易踩坑。'})),
...['关闭危险授权','清理默认勾选陷阱','只保留安全授权'].map((t,i)=>({id:`m${i}`,name:`授权雷区 ${i+1}`,type:'permission_minefield' as const,task:t,hint:'授权不是越多越好。'})),
...['等待完成按钮冷却','冷却后点击完成验证','按冷却节奏点击'].map((t,i)=>({id:`k${i}`,name:`冷却按钮 ${i+1}`,type:'cooldown_button' as const,task:t,hint:'最后一步常输给手快。'})),
...['绕开陷阱点击目标','避开移动陷阱到达按钮','安全路径点击目标'].map((t,i)=>({id:`a${i}`,name:`路径规避 ${i+1}`,type:'path_avoidance' as const,task:t,hint:'你踩到的是系统画出来的坑。'})),
];
