// 同步包：把專案傳到另一台裝置（手機優先用系統分享面板 → AirDrop / LINE 傳給自己；不支援則下載檔案）
import { downloadText } from './download.js'

export async function shareOrDownloadProject(project) {
  const name = `${project.name}.wireplan.json`
  const text = JSON.stringify(project, null, 2)
  const file = typeof File !== 'undefined' ? new File([text], name, { type: 'application/json' }) : null
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadText(name, text, 'application/json')
  return 'downloaded'
}

export const daysSince = (ts) => (ts ? Math.floor((Date.now() - ts) / 86400000) : null)
