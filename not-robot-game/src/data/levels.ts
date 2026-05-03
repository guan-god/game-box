export type LevelMeta = { id:number; title:string; description:string; hints:[string,string] };
export const levels: LevelMeta[] = [
{ id:1,title:'普通但不普通的复选框',description:'靠近会逃跑，别太急。',hints:['有些东西会在你太主动时后退。','等 2 秒或让它逃够 5 次再点。']},
{ id:2,title:'请选择所有含有猫的图片',description:'语言陷阱题。',hints:['题干里的“含有猫”并不等于“字里有猫”。','只选真正的猫和机器人猫。']},
{ id:3,title:'同意按钮逃跑',description:'真正同意来自谨慎。',hints:['先表达拒绝，系统会尊重你。','连续点“不同意”3 次会出现新按钮。']},
{ id:4,title:'阅读协议',description:'至少假装读到底。',hints:['滚到底才算“认真”。','到底后稍等 1 秒。']},
{ id:5,title:'滑块验证',description:'接近终点会回弹。',hints:['90% 已经很努力了。','松手后找小字“其实这样也算”。']},
{ id:6,title:'找出真正的按钮',description:'观察微小差异。',hints:['真按钮很小且不显眼。','文本是“继续 ”（末尾空格）。']},
{ id:7,title:'输入验证码',description:'输入框有自己的脾气。',hints:['先控制输入框，再输入内容。','点“锁定大小写”后输入 HUMAN。']},
{ id:8,title:'反向心理测试',description:'忍住就是胜利。',hints:['有时“不操作”才是操作。','5 秒内别点按钮。']},
{ id:9,title:'拖拽排序',description:'人类的一天并不规律。',hints:['先后悔再努力。','再睡一会儿→后悔→吃饭→学习→发呆→睡觉。']},
{ id:10,title:'真假授权开关',description:'只选合理虚构授权。',hints:['别全选，系统会怀疑你。','只开“虚构数据”和“每天夸我”。']},
{ id:11,title:'看不见的验证码',description:'悬浮查看记忆。',hints:['把鼠标放在验证码区域。','停留更久会更清晰：NOTBOT。']},
{ id:12,title:'最终验证',description:'快不一定对。',hints:['大按钮是诱饵。','角落里有慢速通道。']},
];
