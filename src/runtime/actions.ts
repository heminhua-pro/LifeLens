import type { ActionDef } from './types'

export const METRIC_LABELS: Record<string, string> = {
  sleep: '睡眠',
  steps: '步数',
  energy: '活动热量',
  walking_speed: '步行速度',
  headphone_db: '耳机音量'
}

/** 站点动作注册表：agent 按名字调用，runtime 在用户确认后执行 */
export const SITE_ACTIONS: Record<string, ActionDef> = {
  export_analysis: {
    name: 'export_analysis',
    description: '把分析结果导出为本地文件（Markdown 摘要或 PNG 图表）。文件只保存在用户电脑，不上传、不发送给任何服务器。',
    parameters: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          description: '要导出的维度：sleep（睡眠）/ steps（步数）/ energy（活动热量）/ walking_speed（步行速度）/ headphone_db（耳机音量）',
          enum: Object.keys(METRIC_LABELS),
          enumLabels: METRIC_LABELS
        },
        format: {
          type: 'string',
          description: '导出格式：md（Markdown 摘要，含窗口与数据表，默认）或 png（当前已生成的图表）',
          enum: ['md', 'png'],
          enumLabels: { md: 'Markdown 摘要', png: 'PNG 图表' }
        }
      },
      required: ['metric']
    }
  }
}

export function isActionTool(name: string): boolean {
  return name.startsWith('action_')
}

/** 生成"参数摊开给用户看"的确认文案（规范要求：写操作前展示参数并获明确同意） */
export function actionConfirmDetail(action: string, args: Record<string, unknown>): { title: string; detail: string } {
  if (action === 'export_analysis') {
    const metric = String(args.metric || 'sleep')
    const format = String(args.format || 'md')
    return {
      title: '站点动作确认 · 导出分析结果',
      detail: [
        '即将在【你的浏览器本地】执行以下操作：',
        '',
        `动作：导出分析结果（export_analysis）`,
        `维度：${METRIC_LABELS[metric] || metric}（${metric}）`,
        `格式：${format === 'png' ? 'PNG 图片（当前图表）' : 'Markdown 文件（含统计窗口与逐日数据表）'}`,
        '',
        '数据范围：仅站点已加载的统计数据',
        '影响：生成一个下载文件到你的设备；不上传、不发送到任何服务器。',
        '',
        '允许执行吗？'
      ].join('\n')
    }
  }
  return { title: '站点动作确认', detail: `即将执行 ${action}，参数：${JSON.stringify(args)}。允许执行吗？` }
}
