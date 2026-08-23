// 缪斯 Muse · 课程数据
export interface Lesson { id: number; title: string; goal: string }
export interface Unit { id: number; name: string; lessonIds: number[] }

export const UNITS: Unit[] = [
  { id: 1, name: '单元一 · 声音的奥秘', lessonIds: [1, 2, 3, 4] },
  { id: 2, name: '单元二 · 音高与旋律', lessonIds: [5, 6, 7, 8, 9, 10, 11, 12, 13] },
  { id: 3, name: '单元三 · 小小音乐家', lessonIds: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
]

export const LESSONS: Lesson[] = [
  { id: 1, title: '认识琴键', goal: '认识 do re mi 三个白键，听声音、看位置、说名字' },
  { id: 2, title: '声音的高低', goal: '听辨两个音哪个更高，看它们在琴键上的位置' },
  { id: 3, title: '声音的长短', goal: '听辨哪个音更长' },
  { id: 4, title: '声音的强弱', goal: '听辨哪个音更响' },
  { id: 5, title: '认识五线谱', goal: '高音谱号与 do 的位置' },
  { id: 6, title: '二度', goal: '相邻的音' },
  { id: 7, title: '三度', goal: '隔一个白键的音' },
  { id: 8, title: '五度与八度', goal: '稳定与重合' },
  { id: 9, title: '级进与跳进', goal: '旋律的走法' },
  { id: 10, title: '旋律的走向', goal: '上行、下行与同音反复' },
  { id: 11, title: '二拍子与三拍子', goal: '强弱的循环' },
  { id: 12, title: '认识乐器', goal: '四种乐器的音色' },
  { id: 13, title: '单元二复习', goal: '综合练习' },
  { id: 14, title: '高音谱表进阶', goal: '更宽的高音区' },
  { id: 15, title: '认识低音谱表', goal: '低音谱号与 fa 的位置' },
  { id: 16, title: '旋律小乐句', goal: '更长的旋律记忆' },
  { id: 17, title: '附点与节奏进阶', goal: '附点、十六分与休止' },
  { id: 18, title: '音程综合', goal: '更多音程的听辨' },
  { id: 19, title: '大调与小调', goal: '明亮与柔和' },
  { id: 20, title: '变化音', goal: '黑键来了' },
  { id: 21, title: '视唱综合', goal: '看谱唱音' },
  { id: 22, title: '全音域识谱', goal: '高低音谱表混合' },
  { id: 23, title: '毕业音乐会', goal: '全部技能综合' },
]

export const lessonOf = (id: number) => LESSONS.find(l => l.id === id)!

export const INSTRUMENTS = [
  { id: 'piano', name: '钢琴', desc: '音域宽广，力度层次丰富，可同时在多个音区演奏。', img: '/instruments/piano.png' },
  { id: 'violin', name: '小提琴', desc: '四根弦从低到高依次是 sol、re、la、mi，音色接近人声。', img: '/instruments/violin.png' },
  { id: 'flute', name: '长笛', desc: '木管乐器，靠气流在管内振动发声，音色清澈透明。', img: '/instruments/flute.png' },
  { id: 'trumpet', name: '小号', desc: '铜管乐器，靠嘴唇振动发声，音色明亮有力。', img: '/instruments/trumpet.png' },
] as const
