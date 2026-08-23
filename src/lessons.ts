// 缪斯 Muse · 课程表：3 单元 23 课
import type { InstId } from './theory'

export interface Lesson {
  id: number
  title: string
  unit: number
  goal: string
}

export const UNITS = [
  { id: 1, name: '单元一 · 声音的礼物', range: [1, 4] as const },
  { id: 2, name: '单元二 · 音高与旋律', range: [5, 13] as const },
  { id: 3, name: '单元三 · 读谱与歌唱', range: [14, 23] as const },
]

export const LESSONS: Lesson[] = [
  { id: 1, title: '声音从哪里来', unit: 1, goal: '分辨两个音哪个更高、哪个更低' },
  { id: 2, title: '声音的高低', unit: 1, goal: '听辨高低，并认识音名' },
  { id: 3, title: '声音的长短', unit: 1, goal: '分辨哪个音更长、哪个更短' },
  { id: 4, title: '声音的强弱', unit: 1, goal: '分辨哪个音更响、哪个更轻' },
  { id: 5, title: '认识五线谱', unit: 2, goal: '高音谱表上的 do 到 si' },
  { id: 6, title: '二度音程', unit: 2, goal: '听辨大二度与小二度' },
  { id: 7, title: '三度音程', unit: 2, goal: '听辨大三度与小三度' },
  { id: 8, title: '五度与八度', unit: 2, goal: '听辨纯五度与纯八度' },
  { id: 9, title: '级进与跳进', unit: 2, goal: '分辨旋律是级进还是跳进' },
  { id: 10, title: '旋律的走向', unit: 2, goal: '听出旋律上行、下行还是同音反复' },
  { id: 11, title: '二拍子与三拍子', unit: 2, goal: '听出节奏的拍号' },
  { id: 12, title: '认识乐器', unit: 2, goal: '分辨钢琴、小提琴、长笛、小号' },
  { id: 13, title: '单元二复习', unit: 2, goal: '音程、节奏、旋律综合练习' },
  { id: 14, title: '高音谱表进阶', unit: 3, goal: '识谱范围扩展到两个八度' },
  { id: 15, title: '认识低音谱表', unit: 3, goal: '低音区的音高与识谱' },
  { id: 16, title: '旋律小乐句', unit: 3, goal: '听辨 4 到 5 个音的旋律' },
  { id: 17, title: '附点与节奏进阶', unit: 3, goal: '附点、十六分音符与休止符' },
  { id: 18, title: '音程综合', unit: 3, goal: '六种音程混合听辨' },
  { id: 19, title: '大调与小调', unit: 3, goal: '分辨大调音阶与小调音阶' },
  { id: 20, title: '变化音', unit: 3, goal: '认识黑键与升降记号' },
  { id: 21, title: '视唱综合', unit: 3, goal: '看谱唱准，加旋律听辨' },
  { id: 22, title: '全音域识谱', unit: 3, goal: '含变化音的完整音域' },
  { id: 23, title: '毕业音乐会', unit: 3, goal: '全部题型综合挑战' },
]

export const lessonOf = (id: number) => LESSONS[id - 1]

export interface InstInfo {
  id: InstId
  name: string
  desc: string
  img: string
}

export const INSTRUMENTS: InstInfo[] = [
  { id: 'piano', name: '钢琴', desc: '击弦乐器：琴槌敲击琴弦发声。88 个琴键，频率范围约 27.5 至 4186 赫兹。', img: '/instruments/piano.png' },
  { id: 'violin', name: '小提琴', desc: '弓弦乐器：琴弓摩擦琴弦发声。四根弦分别定为 G3、D4、A4、E5。', img: '/instruments/violin.png' },
  { id: 'flute', name: '长笛', desc: '木管乐器：气流吹入吹孔使管内空气柱振动发声。现代长笛为金属制。', img: '/instruments/flute.png' },
  { id: 'trumpet', name: '小号', desc: '铜管乐器：嘴唇振动带动管内空气柱发声。三个活塞按键改变管长。', img: '/instruments/trumpet.png' },
]