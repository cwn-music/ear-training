// 缪斯 Muse · 五线谱字体本地化
// VexFlow 默认从 jsDelivr CDN 加载 Bravura 音乐字体，网络不畅时音符会渲染不出来。
// 这里把字体文件放在本站 /fonts/ 下（已随项目提交），保证稳定加载。
import { Font, VexFlow } from 'vexflow'

Font.HOST_URL = '/fonts/'

let fontPromise: Promise<void> | null = null

export function ensureStaffFont(): Promise<void> {
  if (!fontPromise) {
    fontPromise = VexFlow.loadFonts('Bravura', 'Academico')
      .then(() => undefined)
      .catch(() => undefined)
  }
  return fontPromise
}
